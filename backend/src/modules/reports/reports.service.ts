import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import {
  addDays,
  endOfDay,
  parseDateParam,
  startOfDay,
  toLocalDateStr,
} from './date.util';

/** `getCurrentBusinessId` of `routes/reports.js` (header ONLY). */
function getCurrentBusinessId(req: any): number | null {
  return req.headers['x-current-business-id']
    ? Number(req.headers['x-current-business-id'])
    : null;
}

/**
 * ReportsService — handler body MOVED VERBATIM from `routes/reports.js`.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** #27 GET /api/reports/summary */
  async summary(req: any, userId: number): Promise<any> {
    const businessId = getCurrentBusinessId(req);
    // Guard against NaN/negative ids: Prisma would reject NaN with a 500, and a
    // non-numeric id can never be a valid business. Ownership is verified below.
    if (!businessId || !Number.isInteger(businessId) || businessId <= 0) {
      throw new ApiError(400, { error: 'Select a business' });
    }

    const business = await this.prisma.business.findFirst({
      where: { id: businessId, userId },
    });
    if (!business) throw new ApiError(404, { error: 'Not found' });

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfDay(addDays(now, -7));
    const monthStart = startOfDay(addDays(now, -30));

    const [todayCount, weekCount, monthCount, byStatus, last30Days] =
      await Promise.all([
        this.prisma.appointment.count({
          where: { businessId, startsAt: { gte: todayStart, lte: todayEnd } },
        }),
        this.prisma.appointment.count({
          where: { businessId, startsAt: { gte: weekStart } },
        }),
        this.prisma.appointment.count({
          where: { businessId, startsAt: { gte: monthStart } },
        }),
        this.prisma.appointment.groupBy({
          by: ['status'],
          where: { businessId, startsAt: { gte: monthStart } },
          _count: { id: true },
        }),
        this.prisma.appointment.findMany({
          where: { businessId, startsAt: { gte: monthStart } },
          select: { startsAt: true, status: true },
        }),
      ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.id]));
    const byDayMap: any = {};
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

    const response: any = {
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
      byDay: Object.values(byDayMap).sort((a: any, b: any) =>
        a.date.localeCompare(b.date),
      ),
    };

    // ── Optional range query ─────────────────────────────────────────────
    const rawStart = req.query.start;
    const rawEnd = req.query.end;
    if (rawStart || rawEnd) {
      const parsedStart = parseDateParam(rawStart);
      const parsedEnd = parseDateParam(rawEnd);

      if ((rawStart && !parsedStart) || (rawEnd && !parsedEnd)) {
        throw new ApiError(400, { error: 'Invalid date range' });
      }

      let rangeStart: Date, rangeEnd: Date;
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
        throw new ApiError(400, { error: 'Range too large (max 366 days)' });
      }

      const rangeAppointments = await this.prisma.appointment.findMany({
        where: { businessId, startsAt: { gte: rangeStart, lte: rangeEnd } },
        include: { appointmentServices: true },
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
      const serviceMap: any = {};
      for (const a of nonCancelled) {
        for (const as of a.appointmentServices) {
          if (!serviceMap[as.name]) {
            serviceMap[as.name] = { name: as.name, count: 0, income: 0 };
          }
          serviceMap[as.name].count += 1;
          serviceMap[as.name].income += as.price;
        }
      }
      const byService = Object.values(serviceMap).sort(
        (a: any, b: any) => b.income - a.income,
      );

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

    return response;
  }
}
