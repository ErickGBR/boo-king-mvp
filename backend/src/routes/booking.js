import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { getAvailableSlots, getAvailableSlotsForRange, isSlotAvailableForBusiness } from '../services/bookingSlots.js';
import { sendConfirmationEmail } from '../services/email.js';
import { syncAppointmentToGoogleCalendar } from '../services/google.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/business/:slug', asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug },
    include: { category: true, schedules: true },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const { getAvailableDates } = await import('../services/bookingSlots.js');
  const dates = await getAvailableDates(business);

  // Include active services so the public booking page can load them in a
  // single request (avoids a second unauthenticated /services call).
  const services = await prisma.service.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true, durationMinutes: true },
  });

  res.json({
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      durationMinutes: business.durationMinutes,
      category: business.category,
      timezone: business.timezone,
      logoPath: business.logoPath,
      brandingFont: business.brandingFont,
      brandingHeaderBg: business.brandingHeaderBg,
      brandingHeaderText: business.brandingHeaderText,
    },
    services,
    dates,
  });
}));

/**
 * GET /business/:slug/services — PUBLIC endpoint (no auth required).
 * Returns the active services for a business, used by the public booking
 * page to let guests choose services before reserving.
 */
router.get('/business/:slug/services', asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const services = await prisma.service.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true, durationMinutes: true },
  });
  res.json({ services });
}));

router.get('/business/:slug/slots', asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const date = req.query.date;
  if (!date) return res.status(422).json({ error: 'date required' });
  const slots = await getAvailableSlots(business, date);
  res.json({ slots });
}));

router.get('/business/:slug/calendar-slots', asyncHandler(async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const start = req.query.start;
  const end = req.query.end;
  if (!start || !end) return res.status(422).json({ error: 'start and end required' });
  const events = await getAvailableSlotsForRange(business, start, end);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json(events);
}));

router.post('/business/:slug/reserve', [
  param('slug').exists(),
  body('starts_at').isISO8601().custom((s) => {
    if (new Date(s) <= new Date()) throw new Error('starts_at must be in the future');
    return true;
  }),
  body('ends_at').isISO8601().custom((end, { req }) => {
    if (new Date(end) <= new Date(req.body.starts_at)) throw new Error('ends_at must be after starts_at');
    return true;
  }),
  body('guest_name').trim().isLength({ min: 1, max: 255 }),
  body('guest_email').isEmail(),
  body('guest_phone').optional().isLength({ max: 50 }),
  body('notify_by_email').optional().isBoolean(),
  body('notes').optional().isLength({ max: 500 }),
  body('service_ids').optional().isArray(),
  body('service_ids.*').optional().isInt({ min: 1 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  const startsAt = new Date(req.body.starts_at);
  const endsAt = new Date(req.body.ends_at);
  const available = await isSlotAvailableForBusiness(business, startsAt, endsAt);
  if (!available) {
    return res.status(409).json({ error: 'slot_taken' });
  }

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
      userId: req.user?.id ?? null,
      guestName: req.body.guest_name,
      guestEmail: req.body.guest_email,
      guestPhone: req.body.guest_phone || null,
      startsAt,
      endsAt,
      status: 'confirmed',
      notes: req.body.notes || null,
      notifyByEmail: req.body.notify_by_email !== false,
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
  sendConfirmationEmail(appointment, business).catch(console.error);
  // M2 — mirror the reservation to the owner's Google Calendar when sync is
  // enabled. Fire-and-forget: the background sync must not delay the booking response.
  syncAppointmentToGoogleCalendar(appointment).catch(console.error);
  res.status(201).json({ appointment, success: true });
}));

export default router;
