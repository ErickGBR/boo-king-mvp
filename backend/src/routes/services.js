import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { verifyBusinessOwnership } from '../middleware/ownership.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

/**
 * GET / — lista servicios del negocio (active + inactive, para gestión).
 * Ordenados por name asc.
 */
router.get('/', verifyBusinessOwnership, asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({
    where: { businessId: req.business.id },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      businessId: true,
      name: true,
      price: true,
      durationMinutes: true,
      active: true,
      createdAt: true,
    },
  });
  res.json({ services });
}));

/**
 * POST / — crear servicio.
 * Valida: name string 1-100 requerido, price >= 0 requerido,
 * durationMinutes int opcional > 0, active bool opcional.
 */
router.post('/', verifyBusinessOwnership, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (1-100 chars)'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a number >= 0'),
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Duration must be an integer > 0'),
  body('active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const service = await prisma.service.create({
    data: {
      businessId: req.business.id,
      name: req.body.name.trim(),
      price: Number(req.body.price),
      durationMinutes: req.body.durationMinutes ? Number(req.body.durationMinutes) : null,
      active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    },
  });
  res.status(201).json(service);
}));

/**
 * PUT /:id — actualizar servicio (campos opcionales, al menos uno requerido).
 * Servicio debe pertenecer a req.business (404 si no).
 */
router.put('/:id', verifyBusinessOwnership, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('price').optional().isFloat({ min: 0 }),
  body('durationMinutes').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('active').optional().isBoolean(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const existing = await prisma.service.findFirst({
    where: { id, businessId: req.business.id },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name.trim();
  if (req.body.price !== undefined) data.price = Number(req.body.price);
  if (req.body.durationMinutes !== undefined) {
    data.durationMinutes = req.body.durationMinutes === null ? null : Number(req.body.durationMinutes);
  }
  if (req.body.active !== undefined) data.active = Boolean(req.body.active);

  const updated = await prisma.service.update({ where: { id }, data });
  res.json(updated);
}));

/**
 * DELETE /:id — hard delete. Servicio debe pertenecer a req.business (404 si no).
 */
router.delete('/:id', verifyBusinessOwnership, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const existing = await prisma.service.findFirst({
    where: { id, businessId: req.business.id },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  await prisma.service.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
