import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { getAuthUrl, exchangeCode, getOAuth2ClientForUser } from '../services/google.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/auth', (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Code required' });
  try {
    const tokens = await exchangeCode(code);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { googleRefreshToken: tokens.refresh_token || null, googleCalendarSync: true },
    });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendar?google=connected`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendar?google=error`);
  }
});

router.get('/status', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { googleRefreshToken: true, googleCalendarSync: true },
  });
  res.json({
    connected: !!user?.googleRefreshToken,
    syncEnabled: user?.googleCalendarSync || false,
  });
});

router.post('/sync', async (req, res) => {
  const { enabled } = req.body;
  await prisma.user.update({
    where: { id: req.user.id },
    data: { googleCalendarSync: enabled === true },
  });
  res.json({ ok: true });
});

router.delete('/disconnect', async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { googleRefreshToken: null, googleCalendarSync: false },
  });
  res.json({ ok: true });
});

export default router;
