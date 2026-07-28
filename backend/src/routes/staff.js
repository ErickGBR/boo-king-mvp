import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

function getBusinessId(req) {
  return req.headers['x-current-business-id'] ? Number(req.headers['x-current-business-id']) : null;
}

router.get('/', async (req, res) => {
  const businessId = getBusinessId(req);
  if (!businessId) return res.status(400).json({ error: 'Select a business' });
  const staff = await prisma.businessStaff.findMany({
    where: { businessId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.json(staff);
});

router.post('/', requireRole('owner', 'admin'), async (req, res) => {
  const businessId = getBusinessId(req);
  if (!businessId) return res.status(400).json({ error: 'Select a business' });
  const { userId, role } = req.body;
  if (!userId) return res.status(422).json({ error: 'userId required' });
  const existing = await prisma.businessStaff.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });
  if (existing) return res.status(409).json({ error: 'Already a member' });
  const member = await prisma.businessStaff.create({
    data: { businessId, userId, role: role || 'staff' },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.status(201).json(member);
});

router.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const businessId = getBusinessId(req);
  if (!businessId) return res.status(400).json({ error: 'Select a business' });
  const id = Number(req.params.id);
  const member = await prisma.businessStaff.findFirst({ where: { id, businessId } });
  if (!member) return res.status(404).json({ error: 'Not found' });
  await prisma.businessStaff.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
