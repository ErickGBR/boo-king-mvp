import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

function getCurrentBusinessId(req) {
  return req.headers['x-current-business-id'] ? Number(req.headers['x-current-business-id']) : null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

router.get('/summary', async (req, res) => {
  const businessId = getCurrentBusinessId(req);
  if (!businessId) return res.status(400).json({ error: 'Select a business' });

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: req.user.id },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfDay(addDays(now, -7));
  const monthStart = startOfDay(addDays(now, -30));

  const [todayCount, weekCount, monthCount, byStatus, last30Days] = await Promise.all([
    prisma.appointment.count({
      where: { businessId, startsAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.appointment.count({
      where: { businessId, startsAt: { gte: weekStart } },
    }),
    prisma.appointment.count({
      where: { businessId, startsAt: { gte: monthStart } },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { businessId, startsAt: { gte: monthStart } },
      _count: { id: true },
    }),
    prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: monthStart } },
      select: { startsAt: true, status: true },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.id]));
  const byDayMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = addDays(now, -i);
    const key = d.toISOString().slice(0, 10);
    byDayMap[key] = { date: key, total: 0, confirmed: 0, cancelled: 0, completed: 0 };
  }
  for (const apt of last30Days) {
    const key = new Date(apt.startsAt).toISOString().slice(0, 10);
    if (byDayMap[key]) {
      byDayMap[key].total += 1;
      if (apt.status === 'confirmed') byDayMap[key].confirmed += 1;
      else if (apt.status === 'cancelled') byDayMap[key].cancelled += 1;
      else if (apt.status === 'completed') byDayMap[key].completed += 1;
    }
  }

  res.json({
    summary: {
      today: todayCount,
      last7Days: weekCount,
      last30Days: monthCount,
    },
    byStatus: {
      confirmed: statusMap.confirmed ?? 0,
      cancelled: statusMap.cancelled ?? 0,
      completed: statusMap.completed ?? 0,
    },
    byDay: Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

export default router;
