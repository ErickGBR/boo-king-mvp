import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', asyncHandler(async (_, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sort: 'asc' },
  });
  res.json(categories);
}));

export default router;
