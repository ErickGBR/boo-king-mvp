import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

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

/**
 * Parse a YYYY-MM-DD (or ISO datetime) query param into a local-midnight Date
 * without the UTC-shift pitfall that `new Date('2026-08-01')` causes.
 */
function parseDateParam(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  if (!m) return null;
  const [_, y, mo, d] = m.map(Number);
  return new Date(y, mo - 1, d); // local midnight
}

/** Format a Date as YYYY-MM-DD using LOCAL component values (no UTC shift). */
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

router.get('/summary', asyncHandler(async (req, res) => {
  const businessId = getCurrentBusinessId(req);
  // Guard against NaN/negative ids: Prisma would reject NaN with a 500, and a
  // non-numeric id can never be a valid business. Ownership is verified below.
  if (!businessId || !Number.isInteger(businessId) || businessId <= 0) {
    return res.status(400).json({ error: 'Select a business' });
  }

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

  const response = {
    summary: {
      today: todayCount,
      last7Days: weekCount,
      last30Days: monthCount,
    },
    byStatus: {
      confirmed: statusMap.confirmed ?? 0,
      cancelled: statusMap.cancelled ?? 0,
      completed: statusMap.completed ?? 0,
      no_show: statusMap.no_show ?? 0,
    },
    byDay: Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date)),
  };

  // ── Optional range query ───────────────────────────────────────────────
  // When start/end query params are provided, compute range-specific stats
  // including totalIncome (from appointmentServices snapshot), avgIncome,
  // noShow count, and byService aggregation.
  const rawStart = req.query.start;
  const rawEnd = req.query.end;
  if (rawStart || rawEnd) {
    const parsedStart = parseDateParam(rawStart);
    const parsedEnd = parseDateParam(rawEnd);

    if ((rawStart && !parsedStart) || (rawEnd && !parsedEnd)) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    let rangeStart, rangeEnd;
    if (parsedStart && parsedEnd) {
      rangeStart = startOfDay(parsedStart);
      rangeEnd = endOfDay(parsedEnd);
    } else if (parsedStart) {
      rangeStart = startOfDay(parsedStart);
      rangeEnd = endOfDay(parsedStart);
    } else {
      rangeStart = startOfDay(parsedEnd);
      rangeEnd = endOfDay(parsedEnd);
    }

    // Reject ranges wider than 366 days
    const diffDays = (rangeEnd.getTime() - rangeStart.getTime()) / 86400000;
    if (diffDays > 366) {
      return res.status(400).json({ error: 'Range too large (max 366 days)' });
    }

    const rangeAppointments = await prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: rangeStart, lte: rangeEnd } },
      include: {
        appointmentServices: true,
      },
      take: 10000,
    });

    const rangeTotal = rangeAppointments.length;
    const rangeCancelled = rangeAppointments.filter((a) => a.status === 'cancelled').length;
    const rangeCompleted = rangeAppointments.filter((a) => a.status === 'completed').length;
    const rangeNoShow = rangeAppointments.filter((a) => a.status === 'no_show').length;
    const rangePresent = rangeAppointments.filter((a) => a.status === 'present').length;

    // Income: sum of appointmentServices.price for non-cancelled appointments
    const nonCancelled = rangeAppointments.filter((a) => a.status !== 'cancelled');
    const totalIncome = nonCancelled.reduce((sum, a) => {
      const aptIncome = a.appointmentServices.reduce((s, as) => s + as.price, 0);
      return sum + aptIncome;
    }, 0);
    const avgIncome = nonCancelled.length > 0 ? totalIncome / nonCancelled.length : 0;

    // byService: group by snapshot name, sum count and income
    const serviceMap = {};
    for (const a of nonCancelled) {
      for (const as of a.appointmentServices) {
        if (!serviceMap[as.name]) {
          serviceMap[as.name] = { name: as.name, count: 0, income: 0 };
        }
        serviceMap[as.name].count += 1;
        serviceMap[as.name].income += as.price;
      }
    }
    const byService = Object.values(serviceMap).sort((a, b) => b.income - a.income);

    response.range = {
      start: toLocalDateStr(rangeStart),
      end: toLocalDateStr(rangeEnd),
      total: rangeTotal,
      completed: rangeCompleted,
      cancelled: rangeCancelled,
      noShow: rangeNoShow,
      present: rangePresent,
      totalIncome: Math.round(totalIncome * 100) / 100,
      avgIncome: Math.round(avgIncome * 100) / 100,
      byService,
    };
  }

  res.json(response);
}));

export default router;
