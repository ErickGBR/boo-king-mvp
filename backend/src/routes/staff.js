import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { verifyBusinessOwnership } from '../middleware/ownership.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// C3 — every staff endpoint goes through verifyBusinessOwnership: the
// businessId (X-Current-Business-Id header) must belong to req.user.id,
// otherwise the request is rejected with 404 (never 403) to avoid leaking
// whether the target business exists. This closes the IDOR where a user could
// read/mutate the staff of another user's business.

router.get('/', verifyBusinessOwnership, async (req, res) => {
  const staff = await prisma.businessStaff.findMany({
    where: { businessId: req.business.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.json(staff);
});

router.post('/', requireRole('owner', 'admin'), verifyBusinessOwnership, [
  body('userId').isInt(),
  body('role').optional().isIn(['owner', 'admin', 'staff']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const { userId, role } = req.body;
  if (!userId) return res.status(422).json({ error: 'userId required' });
  const existing = await prisma.businessStaff.findUnique({
    where: { businessId_userId: { businessId: req.business.id, userId } },
  });
  if (existing) return res.status(409).json({ error: 'Already a member' });
  const member = await prisma.businessStaff.create({
    data: { businessId: req.business.id, userId, role: role || 'staff' },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.status(201).json(member);
});

router.delete('/:id', requireRole('owner', 'admin'), verifyBusinessOwnership, [
  param('id').isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(404).json({ error: 'Not found' });
  const id = Number(req.params.id);
  const member = await prisma.businessStaff.findFirst({ where: { id, businessId: req.business.id } });
  if (!member) return res.status(404).json({ error: 'Not found' });
  await prisma.businessStaff.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
