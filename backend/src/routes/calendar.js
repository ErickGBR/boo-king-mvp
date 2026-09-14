import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/events', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const asClient = await prisma.appointment.findMany({
    where: { userId },
    include: { business: true },
  });
  const businessIds = (await prisma.business.findMany({
    where: { userId },
    select: { id: true },
  })).map((b) => b.id);
  const asOwner = await prisma.appointment.findMany({
    where: { businessId: { in: businessIds } },
    include: { business: true },
  });
  const seen = new Set();
  const events = [];
  for (const a of [...asClient, ...asOwner]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    if (a.status !== 'confirmed' && a.status !== 'completed') continue;
    const isClient = a.userId === userId;
    const businessName = a.business?.name ?? '';
    const clientName = a.guestName || '';
    events.push({
      id: a.id,
      title: businessName + (isClient ? ' (cliente)' : (clientName ? ': ' + clientName : '')),
      start: new Date(a.startsAt).toISOString(),
      end: new Date(a.endsAt).toISOString(),
      extendedProps: {
        businessName,
        clientName,
        role: isClient ? 'Cliente' : 'Dueño',
      },
    });
  }
  res.json(events);
}));

export default router;
