import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/users - List users in company
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        createdAt: true,
        manager: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create user (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, managerId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    if (!['employee', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    if (managerId) {
      const manager = await prisma.user.findFirst({
        where: { id: managerId, companyId: req.user.companyId },
        select: { id: true, role: true },
      });

      if (!manager || manager.role !== 'manager') {
        return res.status(400).json({ error: 'Manager must be a user with manager role' });
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        managerId: role === 'employee' ? (managerId || null) : null,
        companyId: req.user.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, managerId } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, companyId: req.user.companyId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (role && ['employee', 'manager', 'admin'].includes(role)) updateData.role = role;

    const nextRole = updateData.role || user.role;
    if (nextRole !== 'employee') {
      updateData.managerId = null;
    } else if (managerId !== undefined) {
      if (managerId) {
        const manager = await prisma.user.findFirst({
          where: { id: managerId, companyId: req.user.companyId },
          select: { id: true, role: true },
        });

        if (!manager || manager.role !== 'manager') {
          return res.status(400).json({ error: 'Manager must be a user with manager role' });
        }
      }
      updateData.managerId = managerId || null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        createdAt: true,
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findFirst({
      where: { id, companyId: req.user.companyId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove manager reference from reports
    await prisma.user.updateMany({
      where: { managerId: id },
      data: { managerId: null },
    });

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
