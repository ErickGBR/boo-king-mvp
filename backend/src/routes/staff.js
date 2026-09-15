import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { verifyBusinessOwnership } from '../middleware/ownership.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// C3 — every staff endpoint goes through verifyBusinessOwnership: the
// businessId (X-Current-Business-Id header) must belong to req.user.id,
// otherwise the request is rejected with 404 (never 403) to avoid leaking
// whether the target business exists. This closes the IDOR where a user could
// read/mutate the staff of another user's business.

router.get('/', verifyBusinessOwnership, asyncHandler(async (req, res) => {
  const staff = await prisma.businessStaff.findMany({
    where: { businessId: req.business.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.json(staff);
}));

router.post('/', requireRole('owner', 'admin'), verifyBusinessOwnership, [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['staff', 'admin', 'owner']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const { email, role } = req.body;

  // Only owners can assign the 'owner' role
  if (role === 'owner' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owners can assign the owner role' });
  }

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const finalRole = role || 'staff';

  try {
    const member = await prisma.businessStaff.create({
      data: { businessId: req.business.id, userId: target.id, role: finalRole },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.status(201).json(member);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Already a member' });
    throw err;
  }
}));

router.delete('/:id', requireRole('owner', 'admin'), verifyBusinessOwnership, [
  param('id').isInt(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(404).json({ error: 'Not found' });
  const id = Number(req.params.id);
  const member = await prisma.businessStaff.findFirst({ where: { id, businessId: req.business.id } });
  if (!member) return res.status(404).json({ error: 'Not found' });
  await prisma.businessStaff.delete({ where: { id } });
  res.json({ ok: true });
}));

export default router;
