import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const STATUS_CONFIRMED = 'confirmed';

/**
 * BookingSlotsService — MOVED VERBATIM from `src/services/bookingSlots.js`.
 * Every date/timezone helper (`parseInTz`, `startOfDay`, `endOfDay`,
 * `addMinutes`, `formatTime`, `formatForDb`, `getDayOfWeek`) and the slot math
 * is byte-for-byte identical; the only change is the module-level
 * `new PrismaClient()` → injected `PrismaService`.
 */
@Injectable()
export class BookingSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseInTz(dateStr: string, tz = 'America/Mexico_City'): Date {
    return new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: tz }));
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  private addMinutes(d: Date, m: number): Date {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() + m);
    return x;
  }

  private formatTime(d: Date): string {
    return d.toTimeString().slice(0, 5);
  }

  private getDayOfWeek(d: Date): number {
    const day = d.getDay();
    return day === 0 ? 7 : day;
  }

  async getAvailableSlots(
    business: any,
    dateStr: string,
    /**
     * Query executor. Defaults to the shared client; write paths (create /
     * reserve) pass their transaction client so the availability read and the
     * subsequent INSERT run under the same lock (D13/D16 TOCTOU fix).
     */
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<any[]> {
    const tz = business.timezone || 'America/Mexico_City';
    const target = this.startOfDay(this.parseInTz(dateStr + ' 12:00', tz));
    const dayOfWeek = this.getDayOfWeek(target) % 7;

    const schedule = await this.prisma.businessSchedule.findFirst({
      where: { businessId: business.id, dayOfWeek },
    });
    if (!schedule) return [];

    const startTime = (schedule.startTime || '08:00').slice(0, 5);
    const endTime = (schedule.endTime || '18:00').slice(0, 5);
    const start = new Date(`${dateStr}T${startTime}:00`);
    const end = new Date(`${dateStr}T${endTime}:00`);
    const duration = business.durationMinutes;

    // Collect all slot time ranges first, then check availability in parallel
    const slotRanges: { slotStart: Date; slotEnd: Date }[] = [];
    let current = new Date(start);
    while (this.addMinutes(new Date(current), duration) <= end) {
      const slotStart = new Date(current);
      const slotEnd = this.addMinutes(new Date(current), duration);
      slotRanges.push({ slotStart, slotEnd });
      current = slotEnd;
    }

    const availability = await Promise.all(
      slotRanges.map(({ slotStart, slotEnd }) =>
        this.isSlotAvailable(business.id, slotStart, slotEnd, client),
      ),
    );

    const slots: any[] = [];
    for (let i = 0; i < slotRanges.length; i++) {
      if (availability[i]) {
        slots.push({
          start: this.formatTime(slotRanges[i].slotStart),
          end: this.formatTime(slotRanges[i].slotEnd),
          start_iso: slotRanges[i].slotStart.toISOString(),
          end_iso: slotRanges[i].slotEnd.toISOString(),
        });
      }
    }
    return slots;
  }

  async getAvailableSlotsForRange(
    business: any,
    startDateStr: string,
    endDateStr: string,
  ): Promise<any[]> {
    const tz = business.timezone || 'America/Mexico_City';
    const start = this.startOfDay(this.parseInTz(startDateStr, tz));
    const end = this.endOfDay(this.parseInTz(endDateStr, tz));

    // Collect all date strings first
    const dateStrings: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dateStrings.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fetch slots for all days in parallel
    const allDaySlots = await Promise.all(
      dateStrings.map((dateStr) => this.getAvailableSlots(business, dateStr)),
    );

    const events: any[] = [];
    let id = 0;
    for (let i = 0; i < dateStrings.length; i++) {
      const dateStr = dateStrings[i];
      for (const slot of allDaySlots[i]) {
        events.push({
          id: 'slot-' + ++id,
          title: 'Disponible',
          start: slot.start_iso,
          end: slot.end_iso,
          extendedProps: {
            date: dateStr,
            startTime: slot.start,
            endTime: slot.end,
          },
        });
      }
    }
    return events;
  }

  async getAvailableDates(business: any, daysAhead = 30): Promise<string[]> {
    const tz = business.timezone || 'America/Mexico_City';
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const start = this.startOfDay(now);
    const end = this.addMinutes(start, daysAhead * 24 * 60);
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const dayOfWeek = this.getDayOfWeek(cursor) % 7;
      const exists = await this.prisma.businessSchedule.findFirst({
        where: { businessId: business.id, dayOfWeek },
      });
      if (exists) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  private async isSlotAvailable(
    businessId: number,
    slotStart: Date,
    slotEnd: Date,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    if (slotStart < new Date()) return false;
    const overlap = await client.appointment.findFirst({
      where: {
        businessId,
        status: STATUS_CONFIRMED,
        startsAt: { lt: slotEnd },
        endsAt: { gt: slotStart },
      },
    });
    return !overlap;
  }

  async isSlotAvailableForBusiness(
    business: any,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId?: number,
    /**
     * Query executor. Defaults to the shared client (read-only callers); the
     * booking transaction passes its `tx` so the overlap check runs on the SAME
     * connection/lock as the subsequent INSERT. Reading through `this.prisma`
     * inside a transaction would hit another pooled connection and defeat the
     * serialization that closes the reserve() check-then-create race (D13).
     */
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const where: any = {
      businessId: business.id,
      status: { in: ['confirmed', 'pending'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    };
    if (excludeAppointmentId) {
      where.id = { not: excludeAppointmentId };
    }
    const overlapping = await client.appointment.findFirst({ where });
    return !overlapping;
  }
}
