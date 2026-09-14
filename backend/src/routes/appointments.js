import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { verifyBusinessOwnership } from '../middleware/ownership.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { getAvailableSlots, getAvailableSlotsForRange } from '../services/bookingSlots.js';
import { sendRescheduleEmail } from '../services/email.js';
import { syncAppointmentToGoogleCalendar, deleteAppointmentGoogleEvent } from '../services/google.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

function getCurrentBusinessId(req) {
  return req.headers['x-current-business-id'] ? Number(req.headers['x-current-business-id']) : null;
}

// C3 — list, create, reschedule and cancel now go through
// verifyBusinessOwnership (see middleware/ownership.js): the businessId from
// the X-Current-Business-Id header must belong to req.user.id, otherwise the
// request is rejected with 404 (never 403) to avoid leaking whether the
// target business exists.

router.get('/', [
  query('filter').optional().isIn(['all', 'today', 'upcoming', 'past']),
], verifyBusinessOwnership, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const businessId = req.business.id;
  const filter = req.query.filter || 'all';
  const q = req.query.q || '';
  const where = { businessId };
  const now = new Date();
  if (filter === 'today') {
    const today = now.toISOString().slice(0, 10);
    where.startsAt = { gte: new Date(today), lt: new Date(new Date(today).getTime() + 86400000) };
  } else if (filter === 'upcoming') {
    where.startsAt = { gte: now };
  } else if (filter === 'past') {
    where.startsAt = { lt: now };
  }
  if (q && q.length <= 100) {
    where.OR = [
      { guestName: { contains: q } },
      { guestEmail: { contains: q } },
      { guestPhone: { contains: q } },
    ];
  }
  const orderDir = filter === 'upcoming' ? 'asc' : 'desc';
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: orderDir },
    include: {
      business: { include: { category: true } },
      appointmentServices: { include: { service: true } },
    },
    take: 20,
  });
  res.json(appointments);
}));

router.get('/calendar-slots', [
  query('start').isISO8601(),
  query('end').isISO8601(),
], asyncHandler(async (req, res) => {
  const businessId = getCurrentBusinessId(req);
  if (!businessId) return res.status(400).json({ error: 'Select a business' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: req.user.id },
    include: { schedules: true },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const events = await getAvailableSlotsForRange(business, req.query.start, req.query.end);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json(events);
}));

router.post(
  '/',
  verifyBusinessOwnership,
  [
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('start').matches(/^\d{2}:\d{2}$/),
    body('guest_name').trim().isLength({ min: 1, max: 255 }),
    body('guest_email').isEmail(),
    body('guest_phone').optional().isLength({ max: 50 }),
    body('notes').optional().isLength({ max: 500 }),
    body('service_ids').optional().isArray(),
    body('service_ids.*').optional().isInt({ min: 1 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    // req.business was set by verifyBusinessOwnership: it is the business of
    // the X-Current-Business-Id header and it belongs to req.user.id.
    const business = req.business;
    const tz = business.timezone || 'America/Mexico_City';
    const dateStr = req.body.date;
    const startStr = req.body.start;
    const slots = await getAvailableSlots(business, dateStr);
    const chosen = slots.find((s) => s.start === startStr);
    if (!chosen) {
      return res.status(422).json({ error: 'That time slot is not available' });
    }
    const startsAt = new Date(chosen.start_iso);
    const endsAt = new Date(chosen.end_iso);

    // Resolve services if service_ids provided
    let serviceSnapshots = [];
    const serviceIds = req.body.service_ids;
    if (serviceIds && serviceIds.length > 0) {
      const uniqueIds = [...new Set(serviceIds.map(Number))];
      const services = await prisma.service.findMany({
        where: { businessId: business.id, id: { in: uniqueIds }, active: true },
      });
      if (services.length !== uniqueIds.length) {
        const foundIds = new Set(services.map((s) => s.id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        return res.status(404).json({ error: 'Service not found', missingIds: missing });
      }
      serviceSnapshots = services.map((s) => ({ serviceId: s.id, name: s.name, price: s.price }));
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        userId: null,
        guestName: req.body.guest_name,
        guestEmail: req.body.guest_email,
        guestPhone: req.body.guest_phone || null,
        startsAt,
        endsAt,
        status: 'confirmed',
        notes: req.body.notes || null,
        notifyByEmail: true,
        ...(serviceSnapshots.length > 0
          ? {
              appointmentServices: {
                create: serviceSnapshots.map((snap) => ({
                  serviceId: snap.serviceId,
                  name: snap.name,
                  price: snap.price,
                })),
              },
            }
          : {}),
      },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
    // M2 — mirror the appointment to the owner's Google Calendar when sync is
    // enabled. Fire-and-forget: the sync runs in the background, so a slow or
    // failing Google API never delays the booking response.
    syncAppointmentToGoogleCalendar(appointment).catch(console.error);
    res.status(201).json(appointment);
  }
));

router.put('/:id/reschedule', verifyBusinessOwnership, [
  body('starts_at').isISO8601(),
  body('ends_at').isISO8601(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.business.id },
    include: { business: true },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  const startsAt = new Date(req.body.starts_at);
  const endsAt = new Date(req.body.ends_at);
  const business = await prisma.business.findUnique({ where: { id: req.business.id }, include: { schedules: true } });
  const { isSlotAvailableForBusiness } = await import('../services/bookingSlots.js');
  const available = await isSlotAvailableForBusiness(business, startsAt, endsAt, id);
  if (!available) {
    return res.status(409).json({ error: 'slot_taken' });
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: { startsAt, endsAt },
    include: { business: { include: { category: true } } },
  });
  sendRescheduleEmail(updated, business).catch(console.error);
  // M2 — keep the mirrored Google Calendar event in sync on reschedule.
  // Fire-and-forget: the background sync must not delay the reschedule response.
  syncAppointmentToGoogleCalendar(updated).catch(console.error);
  res.json(updated);
}));

/**
 * POST /:id/cancel — marks an appointment as cancelled and removes its Google
 * Calendar event (defensive: a Google failure never blocks the cancellation).
 */
router.post('/:id/cancel', verifyBusinessOwnership, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: req.business.id },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelled' },
    include: { business: { include: { category: true } } },
  });
  // M2 — remove the mirrored Google Calendar event in the background; a slow
  // or failing Google API never delays the cancellation response.
  deleteAppointmentGoogleEvent(updated).catch(console.error);
  res.json(updated);
}));

/**
 * GET /:id — CRITICAL (C2): the appointment is looked up via its business
 * relation scoped to req.user.id, so a user can only read appointments of
 * businesses they own. A missing or foreign appointment returns 404 (never
 * 403) to avoid leaking its existence.
 */
/**
 * Authorize a request as either the business owner or a staff member.
 * Returns the appointment with business included, or null if not found / not
 * authorized (caller should respond 404).
 */
async function findAppointmentForStaffOrOwner(appointmentId, userId) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId },
    include: { business: true },
  });
  if (!appointment) return null;

  // Owner?
  if (appointment.business.userId === userId) return appointment;

  // Staff?
  const staff = await prisma.businessStaff.findFirst({
    where: { businessId: appointment.businessId, userId },
  });
  return staff ? appointment : null;
}

/**
 * POST /:id/checkin — marks an appointment as 'present'. Requires auth +
 * authorization (owner or staff of the appointment's business).
 * Idempotent: if already 'present', returns the appointment unchanged (200).
 * If 'cancelled', returns 400.
 */
router.post('/:id/checkin', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Not found' });

  const appointment = await findAppointmentForStaffOrOwner(id, req.user.id);
  if (!appointment) return res.status(404).json({ error: 'Not found' });

  // Only confirmed → present is allowed. Idempotent if already present.
  if (appointment.status === 'present') {
    const updated = await prisma.appointment.findFirst({
      where: { id },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
    return res.json(updated);
  }
  if (appointment.status !== 'confirmed') {
    return res.status(400).json({ error: 'Invalid status transition' });
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'present' },
    include: {
      business: { include: { category: true } },
      appointmentServices: { include: { service: true } },
    },
  });

  res.json(updated);
}));

/**
 * POST /:id/no-show — marks an appointment as 'no_show' (client didn't arrive).
 * Same authorization pattern as checkin (owner or staff).
 * Only confirmed → no_show is allowed.
 * Idempotent: if already 'no_show', returns the appointment unchanged (200).
 */
router.post('/:id/no-show', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Not found' });

  const appointment = await findAppointmentForStaffOrOwner(id, req.user.id);
  if (!appointment) return res.status(404).json({ error: 'Not found' });

  // Only confirmed → no_show is allowed. Idempotent if already no_show.
  if (appointment.status === 'no_show') {
    const updated = await prisma.appointment.findFirst({
      where: { id },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
    return res.json(updated);
  }
  if (appointment.status !== 'confirmed') {
    return res.status(400).json({ error: 'Invalid status transition' });
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'no_show' },
    include: {
      business: { include: { category: true } },
      appointmentServices: { include: { service: true } },
    },
  });

  res.json(updated);
}));

/**
 * GET /:id — F3: authorize as owner OR staff (same as checkin / no-show).
 * Keeps the full include set (business.category + appointmentServices) so the
 * Attendance UI can render all appointment details.
 * Missing or unauthorized → 404 (never 403) to avoid leaking existence.
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Not found' });

  const appointment = await prisma.appointment.findFirst({
    where: { id },
    include: {
      business: { include: { category: true } },
      appointmentServices: { include: { service: true } },
    },
  });
  if (!appointment) return res.status(404).json({ error: 'Not found' });

  // Owner?
  if (appointment.business.userId === req.user.id) return res.json(appointment);

  // Staff?
  const staff = await prisma.businessStaff.findFirst({
    where: { businessId: appointment.businessId, userId: req.user.id },
  });
  if (!staff) return res.status(404).json({ error: 'Not found' });

  res.json(appointment);
}));

export default router;
