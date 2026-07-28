import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATUS_CONFIRMED = 'confirmed';

function parseInTz(dateStr, tz = 'America/Mexico_City') {
  return new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: tz }));
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

function addMinutes(d, m) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + m);
  return x;
}

function formatTime(d) {
  return d.toTimeString().slice(0, 5);
}

function formatForDb(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function getDayOfWeek(d) {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export async function getAvailableSlots(business, dateStr) {
  const tz = business.timezone || 'America/Mexico_City';
  const target = startOfDay(parseInTz(dateStr + ' 12:00', tz));
  const dayOfWeek = getDayOfWeek(target) % 7;

  const schedule = await prisma.businessSchedule.findFirst({
    where: { businessId: business.id, dayOfWeek },
  });
  if (!schedule) return [];

  const startTime = (schedule.startTime || '08:00').slice(0, 5);
  const endTime = (schedule.endTime || '18:00').slice(0, 5);
  const start = new Date(`${dateStr}T${startTime}:00`);
  const end = new Date(`${dateStr}T${endTime}:00`);
  const duration = business.durationMinutes;

  const slots = [];
  let current = new Date(start);
  while (addMinutes(new Date(current), duration) <= end) {
    const slotStart = new Date(current);
    const slotEnd = addMinutes(new Date(current), duration);
    const available = await isSlotAvailable(business.id, slotStart, slotEnd);
    if (available) {
      slots.push({
        start: formatTime(slotStart),
        end: formatTime(slotEnd),
        start_iso: slotStart.toISOString(),
        end_iso: slotEnd.toISOString(),
      });
    }
    current = slotEnd;
  }
  return slots;
}

export async function getAvailableSlotsForRange(business, startDateStr, endDateStr) {
  const tz = business.timezone || 'America/Mexico_City';
  let start = startOfDay(parseInTz(startDateStr, tz));
  let end = endOfDay(parseInTz(endDateStr, tz));
  const events = [];
  let id = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const slots = await getAvailableSlots(business, dateStr);
    for (const slot of slots) {
      events.push({
        id: 'slot-' + (++id),
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
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}

export async function getAvailableDates(business, daysAhead = 30) {
  const tz = business.timezone || 'America/Mexico_City';
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const start = startOfDay(now);
  const end = addMinutes(start, daysAhead * 24 * 60);
  const dates = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const dayOfWeek = getDayOfWeek(cursor) % 7;
    const exists = await prisma.businessSchedule.findFirst({
      where: { businessId: business.id, dayOfWeek },
    });
    if (exists) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function isSlotAvailable(businessId, slotStart, slotEnd) {
  if (slotStart < new Date()) return false;
  const overlap = await prisma.appointment.findFirst({
    where: {
      businessId,
      status: STATUS_CONFIRMED,
      startsAt: { lt: slotEnd },
      endsAt: { gt: slotStart },
    },
  });
  return !overlap;
}

export async function isSlotAvailableForBusiness(business, startsAt, endsAt, excludeAppointmentId) {
  const where = {
    businessId: business.id,
    status: { in: ['confirmed', 'pending'] },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
  };
  if (excludeAppointmentId) {
    where.id = { not: excludeAppointmentId };
  }
  const overlapping = await prisma.appointment.findFirst({ where });
  return !overlapping;
}
