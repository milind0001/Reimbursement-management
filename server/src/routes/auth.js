import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword, generateToken } from '../lib/auth.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/signup - Create company + admin
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, companyName, country, currencyCode, currencySymbol } = req.body;

    if (!name || !email || !password || !companyName || !country || !currencyCode) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    // Transaction: create company + admin user
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          country,
          currencyCode,
          currencySymbol: currencySymbol || currencyCode,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'admin',
          companyId: company.id,
        },
      });

      // Create default approval workflow
      await tx.approvalWorkflow.create({
        data: {
          name: 'Default Workflow',
          companyId: company.id,
          isDefault: true,
        },
      });

      return { company, user };
    });

    const token = generateToken(result.user);

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        companyId: result.user.companyId,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
        country: result.company.country,
        currencyCode: result.company.currencyCode,
        currencySymbol: result.company.currencySymbol,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        managerId: user.managerId,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        country: user.company.country,
        currencyCode: user.company.currencyCode,
        currencySymbol: user.company.currencySymbol,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

    const token = authHeader.split(' ')[1];
    const { verifyToken } = await import('../lib/auth.js');
    const decoded = verifyToken(token);

    if (!decoded) return res.status(401).json({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { company: true, manager: { select: { id: true, name: true, email: true } } },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        managerId: user.managerId,
        manager: user.manager,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        country: user.company.country,
        currencyCode: user.company.currencyCode,
        currencySymbol: user.company.currencySymbol,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
});

export default router;
