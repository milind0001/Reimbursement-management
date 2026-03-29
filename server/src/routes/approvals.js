import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function isApproverTurn(targetRecord, allRecords) {
  const currentStepOrder = targetRecord.step?.stepOrder;
  const previousRecords = allRecords.filter(r => r.step?.stepOrder < currentStepOrder);
  return previousRecords.every(r => r.status === 'approved');
}

// GET /api/approvals - Get pending approvals for current user
router.get('/', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    let pendingRecords;

    if (req.user.role === 'admin') {
      // Admin sees all pending records in their company
      pendingRecords = await prisma.approvalRecord.findMany({
        where: {
          status: 'pending',
          expense: { companyId: req.user.companyId },
        },
        include: {
          expense: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              lines: true,
            },
          },
          step: { select: { approverRoleLabel: true, stepOrder: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { expense: { createdAt: 'desc' } },
      });
    } else {
      // Managers only see records assigned to them + where it's their turn
      pendingRecords = await prisma.approvalRecord.findMany({
        where: {
          approverId: req.user.id,
          status: 'pending',
        },
        include: {
          expense: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              lines: true,
              records: {
                orderBy: { step: { stepOrder: 'asc' } },
                include: { step: true },
              },
            },
          },
          step: { select: { approverRoleLabel: true, stepOrder: true } },
        },
        orderBy: { expense: { createdAt: 'desc' } },
      });

      // Filter to only show records where it's actually this approver's turn
      pendingRecords = pendingRecords.filter(record => {
        const allRecords = record.expense.records;
        const currentStepOrder = record.step.stepOrder;

        // Check if all previous steps are approved
        const previousRecords = allRecords.filter(r => r.step.stepOrder < currentStepOrder);
        return previousRecords.every(r => r.status === 'approved');
      });
    }

    res.json(pendingRecords);
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// POST /api/approvals/:recordId/approve - Approve expense
router.post('/:recordId/approve', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { comments } = req.body;

    const record = await prisma.approvalRecord.findUnique({
      where: { id: recordId },
      include: {
        expense: {
          include: {
            records: {
              include: { step: true },
              orderBy: { step: { stepOrder: 'asc' } },
            },
            workflow: {
              include: { rules: { include: { specificApprover: true } } },
            },
          },
        },
        step: true,
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (record.expense.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Not authorized for this company expense' });
    }

    if (record.status !== 'pending') {
      return res.status(400).json({ error: 'This approval step is already processed' });
    }

    if (record.expense.status === 'approved' || record.expense.status === 'rejected') {
      return res.status(400).json({ error: 'Expense is already finalized' });
    }

    const isAssignedApprover = record.approverId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const canApproveNow = isApproverTurn(record, record.expense.records);

    // Managers must be assigned approver and can only approve when it is their turn.
    if (!isAdmin && (!isAssignedApprover || !canApproveNow)) {
      return res.status(403).json({ error: 'Not authorized to approve this expense' });
    }

    // Update the record
    await prisma.approvalRecord.update({
      where: { id: recordId },
      data: {
        status: 'approved',
        comments: comments || null,
        actedAt: new Date(),
      },
    });

    // Check conditional approval rules
    const allRecords = record.expense.records;
    const updatedRecords = allRecords.map(r =>
      r.id === recordId ? { ...r, status: 'approved' } : r
    );

    const approvedCount = updatedRecords.filter(r => r.status === 'approved').length;
    const totalSteps = updatedRecords.length;

    let autoApprove = false;

    // Check rules
    if (record.expense.workflow?.rules) {
      for (const rule of record.expense.workflow.rules) {
        if (rule.ruleType === 'percentage' && rule.percentageThreshold) {
          const percentage = (approvedCount / totalSteps) * 100;
          if (percentage >= rule.percentageThreshold) {
            autoApprove = true;
            break;
          }
        }
        if (rule.ruleType === 'specific_approver' && rule.specificApproverId) {
          if (rule.specificApproverId === req.user.id) {
            autoApprove = true;
            break;
          }
        }
        if (rule.ruleType === 'hybrid') {
          const percentage = (approvedCount / totalSteps) * 100;
          const percentageMet = rule.percentageThreshold && percentage >= rule.percentageThreshold;
          const specificMet = rule.specificApproverId === req.user.id;
          if (percentageMet || specificMet) {
            autoApprove = true;
            break;
          }
        }
      }
    }

    if (autoApprove) {
      // Auto-approve all remaining steps
      await prisma.approvalRecord.updateMany({
        where: {
          expenseId: record.expenseId,
          status: 'pending',
        },
        data: {
          status: 'approved',
          comments: 'Auto-approved by conditional rule',
          actedAt: new Date(),
        },
      });

      await prisma.expense.update({
        where: { id: record.expenseId },
        data: { status: 'approved', currentStep: totalSteps },
      });
    } else if (approvedCount === totalSteps) {
      // All steps approved
      await prisma.expense.update({
        where: { id: record.expenseId },
        data: { status: 'approved', currentStep: totalSteps },
      });
    } else {
      // Move to next step
      await prisma.expense.update({
        where: { id: record.expenseId },
        data: { currentStep: approvedCount },
      });
    }

    const updated = await prisma.expense.findUnique({
      where: { id: record.expenseId },
      include: {
        records: {
          include: {
            approver: { select: { id: true, name: true } },
            step: { select: { approverRoleLabel: true, stepOrder: true } },
          },
        },
      },
    });

    res.json({ message: 'Expense approved', expense: updated });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve expense' });
  }
});

// POST /api/approvals/:recordId/reject - Reject expense
router.post('/:recordId/reject', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { comments } = req.body;

    if (!comments) {
      return res.status(400).json({ error: 'Comments are required for rejection' });
    }

    const record = await prisma.approvalRecord.findUnique({
      where: { id: recordId },
      include: {
        expense: {
          include: {
            records: {
              include: { step: true },
            },
          },
        },
        step: true,
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (record.expense.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Not authorized for this company expense' });
    }

    if (record.status !== 'pending') {
      return res.status(400).json({ error: 'This approval step is already processed' });
    }

    if (record.expense.status === 'approved' || record.expense.status === 'rejected') {
      return res.status(400).json({ error: 'Expense is already finalized' });
    }

    const isAssignedApprover = record.approverId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const canRejectNow = isApproverTurn(record, record.expense.records);

    // Managers must be assigned approver and can only reject when it is their turn.
    if (!isAdmin && (!isAssignedApprover || !canRejectNow)) {
      return res.status(403).json({ error: 'Not authorized to reject this expense' });
    }

    // Update the record
    await prisma.approvalRecord.update({
      where: { id: recordId },
      data: {
        status: 'rejected',
        comments,
        actedAt: new Date(),
      },
    });

    // Reject the entire expense
    await prisma.expense.update({
      where: { id: record.expenseId },
      data: { status: 'rejected' },
    });

    res.json({ message: 'Expense rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject expense' });
  }
});

// POST /api/approvals/expenses/:expenseId/override - Admin override final decision
router.post('/expenses/:expenseId/override', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { action, comments } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    if (action === 'reject' && !comments) {
      return res.status(400).json({ error: 'Comments are required for rejection override' });
    }

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, companyId: req.user.companyId },
      include: {
        records: {
          include: {
            approver: { select: { id: true, name: true } },
            step: { select: { approverRoleLabel: true, stepOrder: true } },
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.status === 'approved' || expense.status === 'rejected') {
      return res.status(400).json({ error: 'Expense is already finalized' });
    }

    const actedAt = new Date();
    const totalSteps = expense.records.length;

    if (action === 'approve') {
      await prisma.approvalRecord.updateMany({
        where: { expenseId, status: 'pending' },
        data: {
          status: 'approved',
          comments: comments || 'Approved by admin override',
          actedAt,
        },
      });

      await prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: 'approved',
          currentStep: totalSteps,
        },
      });
    } else {
      await prisma.approvalRecord.updateMany({
        where: { expenseId, status: 'pending' },
        data: {
          status: 'rejected',
          comments,
          actedAt,
        },
      });

      await prisma.expense.update({
        where: { id: expenseId },
        data: { status: 'rejected' },
      });
    }

    const updatedExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        records: {
          include: {
            approver: { select: { id: true, name: true } },
            step: { select: { approverRoleLabel: true, stepOrder: true } },
          },
          orderBy: { step: { stepOrder: 'asc' } },
        },
      },
    });

    res.json({ message: `Expense ${action}d by admin override`, expense: updatedExpense });
  } catch (error) {
    console.error('Admin override error:', error);
    res.status(500).json({ error: 'Failed to override approval' });
  }
});

// POST /api/approvals/expenses/:expenseId/override - Admin force override
router.post('/expenses/:expenseId/override', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { status, comments } = req.body; // status should be 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { records: true },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Update all pending records to the new status
    await prisma.approvalRecord.updateMany({
      where: {
        expenseId,
        status: 'pending',
      },
      data: {
        status,
        comments: comments || `Admin override: ${status}`,
        actedAt: new Date(),
      },
    });

    const totalSteps = expense.records.length;
    // Update expense overall status
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status,
        currentStep: status === 'approved' ? totalSteps : expense.currentStep,
      },
      include: {
        records: {
          include: {
            approver: { select: { id: true, name: true } },
            step: { select: { approverRoleLabel: true, stepOrder: true } },
          },
        },
      },
    });

    res.json({ message: `Expense overridden to ${status}`, expense: updated });
  } catch (error) {
    console.error('Override error:', error);
    res.status(500).json({ error: 'Failed to override expense' });
  }
});

export default router;
