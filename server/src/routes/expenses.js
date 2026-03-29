import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { convertCurrency } from '../lib/currency.js';
import { getSupabase } from '../lib/supabase.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const prisma = new PrismaClient();

// Setup file uploads (in-memory for Supabase cloud storage)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });


// GET /api/expenses - List expenses
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const where = { companyId: req.user.companyId };

    // Role-based filtering
    if (req.user.role === 'employee') {
      where.userId = req.user.id;
    } else if (req.user.role === 'manager') {
      // Managers see their own + team expenses
      const teamMembers = await prisma.user.findMany({
        where: { managerId: req.user.id },
        select: { id: true },
      });
      const teamIds = teamMembers.map(m => m.id);
      teamIds.push(req.user.id);
      where.userId = { in: teamIds };
    }
    // Admin sees all

    if (status) where.status = status;
    if (category) where.category = category;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          lines: true,
          records: {
            include: {
              approver: { select: { id: true, name: true } },
              step: { select: { approverRoleLabel: true, stepOrder: true } },
            },
            orderBy: { step: { stepOrder: 'asc' } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({ expenses, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/expenses/stats - Dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const where = { companyId: req.user.companyId };

    if (req.user.role === 'employee') {
      where.userId = req.user.id;
    } else if (req.user.role === 'manager') {
      const teamMembers = await prisma.user.findMany({
        where: { managerId: req.user.id },
        select: { id: true },
      });
      const teamIds = teamMembers.map(m => m.id);
      teamIds.push(req.user.id);
      where.userId = { in: teamIds };
    }

    const [total, pending, approved, rejected] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.count({ where: { ...where, status: 'pending' } }),
      prisma.expense.count({ where: { ...where, status: 'approved' } }),
      prisma.expense.count({ where: { ...where, status: 'rejected' } }),
    ]);

    const inReview = await prisma.expense.count({ where: { ...where, status: 'in_review' } });

    // Total amounts
    const approvedExpenses = await prisma.expense.findMany({
      where: { ...where, status: 'approved' },
      select: { convertedAmount: true },
    });
    const totalApprovedAmount = approvedExpenses.reduce((sum, e) => sum + e.convertedAmount, 0);

    const pendingExpenses = await prisma.expense.findMany({
      where: { ...where, status: { in: ['pending', 'in_review'] } },
      select: { convertedAmount: true },
    });
    const totalPendingAmount = pendingExpenses.reduce((sum, e) => sum + e.convertedAmount, 0);

    // Recent expenses
    const recent = await prisma.expense.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      total,
      pending: pending + inReview,
      approved,
      rejected,
      totalApprovedAmount: Math.round(totalApprovedAmount * 100) / 100,
      totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
      recent,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/expenses/:id - Single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: {
        user: { select: { id: true, name: true, email: true, managerId: true } },
        lines: true,
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approver: { select: { id: true, name: true } } } } } },
        records: {
          include: {
            approver: { select: { id: true, name: true, email: true } },
            step: { select: { approverRoleLabel: true, stepOrder: true } },
          },
          orderBy: { step: { stepOrder: 'asc' } },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// POST /api/expenses - Submit expense
router.post('/', authenticate, upload.single('receipt'), async (req, res) => {
  try {
    const {
      amount, currencyCode, category, description,
      expenseDate, isManagerApprover, workflowId, lines
    } = req.body;

    if (!amount || !currencyCode || !category || !description || !expenseDate) {
      return res.status(400).json({ error: 'Amount, currency, category, description, and date are required' });
    }

    // Get company currency
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
    });

    // Convert currency
    let convertedAmount = parseFloat(amount);
    let exchangeRate = 1;

    if (currencyCode !== company.currencyCode) {
      const conversion = await convertCurrency(parseFloat(amount), currencyCode, company.currencyCode, prisma);
      convertedAmount = conversion.convertedAmount;
      exchangeRate = conversion.exchangeRate;
    }

    // Get default workflow if not specified
    let wfId = workflowId;
    if (!wfId) {
      const defaultWf = await prisma.approvalWorkflow.findFirst({
        where: { companyId: req.user.companyId, isDefault: true },
      });
      if (defaultWf) wfId = defaultWf.id;
    }

    let receiptPath = null;
    if (req.file) {
      const supabase = getSupabase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(uniqueName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        console.error('Supabase upload error:', error);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(data.path);
        receiptPath = publicUrlData.publicUrl;
      }
    }

    // Parse expense lines
    let expenseLines = [];
    if (lines) {
      try {
        expenseLines = typeof lines === 'string' ? JSON.parse(lines) : lines;
      } catch (e) {
        expenseLines = [];
      }
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.id,
        amount: parseFloat(amount),
        currencyCode,
        convertedAmount,
        exchangeRate,
        category,
        description,
        receiptPath,
        expenseDate,
        isManagerApprover: isManagerApprover === 'true' || isManagerApprover === true,
        workflowId: wfId || null,
        status: 'pending',
        lines: expenseLines.length > 0 ? {
          create: expenseLines.map(l => ({
            description: l.description,
            amount: parseFloat(l.amount),
            category: l.category || category,
          })),
        } : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lines: true,
      },
    });

    // Create approval records based on workflow + manager approver
    await createApprovalRecords(expense, req.user, prisma);

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

async function createApprovalRecords(expense, submitter, prisma) {
  const records = [];
  const addedApproverIds = new Set();

  let workflowSteps = [];
  if (expense.workflowId) {
    workflowSteps = await prisma.approvalStep.findMany({
      where: {
        workflowId: expense.workflowId,
        stepOrder: { gt: 0 },
      },
      orderBy: { stepOrder: 'asc' },
    });
  }

  // Step 0: Manager approval if enabled
  if (expense.isManagerApprover) {
    const user = await prisma.user.findUnique({
      where: { id: submitter.id },
      select: { managerId: true },
    });

    if (user?.managerId) {
      const managerUser = await prisma.user.findFirst({
        where: {
          id: user.managerId,
          companyId: submitter.companyId,
        },
        select: { id: true, role: true },
      });

      if (managerUser && managerUser.role === 'manager') {
        const managerAlreadyInWorkflow = workflowSteps.some(step => step.approverId === managerUser.id);

        if (!managerAlreadyInWorkflow) {
          // Reuse/create internal manager step only when workflow doesn't already assign this manager.
          let managerStep = await prisma.approvalStep.findFirst({
            where: {
              workflowId: expense.workflowId,
              approverRoleLabel: 'Manager',
              approverId: managerUser.id,
            },
          });

          if (!managerStep && expense.workflowId) {
            managerStep = await prisma.approvalStep.create({
              data: {
                workflowId: expense.workflowId,
                stepOrder: 0,
                approverId: managerUser.id,
                approverRoleLabel: 'Manager',
              },
            });
          }

          if (managerStep) {
            records.push({
              expenseId: expense.id,
              stepId: managerStep.id,
              approverId: managerUser.id,
              status: 'pending',
            });
            addedApproverIds.add(managerUser.id);
          }
        }
      }
    }
  }

  // Workflow steps
  if (workflowSteps.length > 0) {
    for (const step of workflowSteps) {
      if (addedApproverIds.has(step.approverId)) {
        continue;
      }

      records.push({
        expenseId: expense.id,
        stepId: step.id,
        approverId: step.approverId,
        status: 'pending',
      });
      addedApproverIds.add(step.approverId);
    }
  }

  if (records.length > 0) {
    await prisma.approvalRecord.createMany({ data: records });
    await prisma.expense.update({
      where: { id: expense.id },
      data: { status: 'in_review', currentStep: 0 },
    });
  }
}

export default router;
