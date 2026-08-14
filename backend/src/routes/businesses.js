import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

/**
 * Builds a URL-safe slug from a business name (QA fix — degenerate slug).
 * - trims the name BEFORE slugifying (a name of only whitespace would produce
 *   an empty slug)
 * - strips everything that is not [a-z0-9-]
 * - falls back to a time-based slug when nothing remains (e.g. "ÑóÑó" → "")
 * so the UNIQUE `slug` column never receives an empty value and the request
 * is never rejected by a duplicate/empty slug crash.
 * @param {string} name - raw business name
 * @returns {string} non-empty slug
 */
function buildSlug(name) {
  const slug = String(name).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return slug || `negocio-${Date.now()}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const businesses = await prisma.business.findMany({
    where: { userId: req.user.id },
    include: { category: true },
  });
  res.json(businesses);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const business = await prisma.business.findFirst({
    where: { id, userId: req.user.id },
    include: { category: true, schedules: true },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  res.json(business);
}));

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    // CRITICAL (QA): only positive integers are valid category ids. The old
    // isInt() accepted 0 (Number('') === 0) and any non-existent integer; the
    // resulting Prisma P2003 foreign-key rejection then crashed the server.
    body('categoryId').isInt({ gt: 0 }).withMessage('Invalid categoryId'),
    body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
    body('timezone').isLength({ min: 1, max: 50 }),
    body('locationType').isIn(['presencial', 'online']),
  ],
  // asyncHandler (QA): a rejected promise can never escape to an unhandled
  // rejection. The internal try/catch is double protection that delegates to
  // next(err) explicitly (see catch below).
  asyncHandler(async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
      const categoryId = Number(req.body.categoryId);
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) return res.status(422).json({ error: 'Category not found' });
      const slug = buildSlug(req.body.name);
      let finalSlug = slug;
      let n = 0;
      while (await prisma.business.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${++n}`;
      }
      const business = await prisma.business.create({
        data: {
          userId: req.user.id,
          name: req.body.name,
          slug: finalSlug,
          categoryId,
          description: req.body.description || null,
          durationMinutes: Number(req.body.durationMinutes),
          locationType: req.body.locationType || 'presencial',
          address: req.body.address || null,
          meetingUrl: req.body.meetingUrl || null,
          timezone: req.body.timezone || 'America/Mexico_City',
        },
        include: { category: true },
      });
      const schedule = req.body.schedule || {};
      for (const [day, hours] of Object.entries(schedule)) {
        const d = Number(day);
        if (d < 0 || d > 6) continue;
        const start = hours.start?.slice(0, 5);
        const end = hours.end?.slice(0, 5);
        if (start && end && end > start) {
          await prisma.businessSchedule.create({
            data: { businessId: business.id, dayOfWeek: d, startTime: start, endTime: end },
          });
        }
      }
      res.status(201).json(business);
    } catch (err) {
      next(err);
    }
  })
);

router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('categoryId').isInt({ gt: 0 }).withMessage('Invalid categoryId'),
    body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
    body('timezone').isLength({ min: 1, max: 50 }),
  ],
  asyncHandler(async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
      const id = Number(req.params.id);
      const business = await prisma.business.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!business) return res.status(404).json({ error: 'Not found' });
      const categoryId = Number(req.body.categoryId);
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) return res.status(422).json({ error: 'Category not found' });
      await prisma.business.update({
        where: { id },
        data: {
          name: req.body.name,
          categoryId,
          description: req.body.description ?? business.description,
          durationMinutes: Number(req.body.durationMinutes),
          locationType: req.body.locationType ?? business.locationType,
          address: req.body.address ?? business.address,
          meetingUrl: req.body.meetingUrl ?? business.meetingUrl,
          timezone: req.body.timezone || business.timezone,
          brandingFont: req.body.brandingFont ?? business.brandingFont,
          brandingHeaderBg: req.body.brandingHeaderBg ?? business.brandingHeaderBg,
          brandingHeaderText: req.body.brandingHeaderText ?? business.brandingHeaderText,
        },
      });
      await prisma.businessSchedule.deleteMany({ where: { businessId: id } });
      const schedule = req.body.schedule || {};
      for (const [day, hours] of Object.entries(schedule)) {
        const d = Number(day);
        if (d < 0 || d > 6) continue;
        const start = hours.start?.slice(0, 5);
        const end = hours.end?.slice(0, 5);
        if (start && end && end > start) {
          await prisma.businessSchedule.create({
            data: { businessId: id, dayOfWeek: d, startTime: start, endTime: end },
          });
        }
      }
      const updated = await prisma.business.findUnique({
        where: { id },
        include: { category: true, schedules: true },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  })
);

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const business = await prisma.business.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  await prisma.business.delete({ where: { id } });
  res.json({ ok: true });
}));

export default router;
