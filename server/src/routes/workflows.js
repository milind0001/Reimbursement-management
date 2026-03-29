import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/workflows - List workflows
router.get('/', authenticate, async (req, res) => {
  try {
    const workflows = await prisma.approvalWorkflow.findMany({
      where: { companyId: req.user.companyId },
      include: {
        steps: {
          where: { stepOrder: { gt: 0 } },
          orderBy: { stepOrder: 'asc' },
          include: { approver: { select: { id: true, name: true, email: true } } },
        },
        rules: {
          include: { specificApprover: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(workflows);
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// POST /api/workflows - Create workflow (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, isDefault, steps, rules } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.approvalWorkflow.updateMany({
        where: { companyId: req.user.companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        name,
        companyId: req.user.companyId,
        isDefault: isDefault || false,
        steps: steps && steps.length > 0 ? {
          create: steps.map((step, index) => ({
            stepOrder: step.stepOrder || index + 1,
            approverId: step.approverId,
            approverRoleLabel: step.approverRoleLabel || `Step ${index + 1}`,
          })),
        } : undefined,
        rules: rules && rules.length > 0 ? {
          create: rules.map(rule => ({
            companyId: req.user.companyId,
            ruleType: rule.ruleType,
            percentageThreshold: rule.percentageThreshold ? parseFloat(rule.percentageThreshold) : null,
            specificApproverId: rule.specificApproverId || null,
          })),
        } : undefined,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: { approver: { select: { id: true, name: true } } },
        },
        rules: {
          include: { specificApprover: { select: { id: true, name: true } } },
        },
      },
    });

    res.status(201).json(workflow);
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isDefault, steps, rules } = req.body;

    const workflow = await prisma.approvalWorkflow.findFirst({
      where: { id, companyId: req.user.companyId },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (isDefault) {
      await prisma.approvalWorkflow.updateMany({
        where: { companyId: req.user.companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Delete existing steps and rules, recreate
    await prisma.approvalStep.deleteMany({ where: { workflowId: id } });
    await prisma.approvalRule.deleteMany({ where: { workflowId: id } });

    const updated = await prisma.approvalWorkflow.update({
      where: { id },
      data: {
        name: name || workflow.name,
        isDefault: isDefault !== undefined ? isDefault : workflow.isDefault,
        steps: steps && steps.length > 0 ? {
          create: steps.map((step, index) => ({
            stepOrder: step.stepOrder || index + 1,
            approverId: step.approverId,
            approverRoleLabel: step.approverRoleLabel || `Step ${index + 1}`,
          })),
        } : undefined,
        rules: rules && rules.length > 0 ? {
          create: rules.map(rule => ({
            companyId: req.user.companyId,
            ruleType: rule.ruleType,
            percentageThreshold: rule.percentageThreshold ? parseFloat(rule.percentageThreshold) : null,
            specificApproverId: rule.specificApproverId || null,
          })),
        } : undefined,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: { approver: { select: { id: true, name: true } } },
        },
        rules: {
          include: { specificApprover: { select: { id: true, name: true } } },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.approvalWorkflow.delete({ where: { id } });
    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
