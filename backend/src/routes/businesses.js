import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

function maxBusinesses(plan) {
  return 100;
}

router.get('/', async (req, res) => {
  const businesses = await prisma.business.findMany({
    where: { userId: req.user.id },
    include: { category: true },
  });
  res.json(businesses);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const business = await prisma.business.findFirst({
    where: { id, userId: req.user.id },
    include: { category: true, schedules: true },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  res.json(business);
});

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('categoryId').isInt(),
    body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
    body('timezone').isLength({ min: 1, max: 50 }),
    body('locationType').isIn(['presencial', 'online']),
  ],
  async (req, res) => {
    const count = await prisma.business.count({ where: { userId: req.user.id } });
    if (count >= maxBusinesses(req.user.subscriptionPlan)) {
      return res.status(403).json({ error: 'Maximum businesses reached for your plan' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const slug = req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let finalSlug = slug;
    let n = 0;
    while (await prisma.business.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = slug + '-' + (++n);
    }
    const business = await prisma.business.create({
      data: {
        userId: req.user.id,
        name: req.body.name,
        slug: finalSlug,
        categoryId: Number(req.body.categoryId),
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
  }
);

router.put(
  '/:id',
  [
    param('id').isInt(),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('categoryId').isInt(),
    body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
    body('timezone').isLength({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    const id = Number(req.params.id);
    const business = await prisma.business.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!business) return res.status(404).json({ error: 'Not found' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    await prisma.business.update({
      where: { id },
      data: {
        name: req.body.name,
        categoryId: Number(req.body.categoryId),
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
  }
);

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const business = await prisma.business.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!business) return res.status(404).json({ error: 'Not found' });
  await prisma.business.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
