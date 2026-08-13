import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { getAuthUrl, exchangeCode } from '../services/google.js';

const router = Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// All Google Calendar endpoints require an authenticated user.
router.use(authMiddleware);

/**
 * GET /api/google/auth — returns the Google OAuth2 authorization URL.
 */
router.get('/auth', (_req, res) => {
  try {
    res.json({ url: getAuthUrl() });
  } catch (err) {
    console.error('Error generating Google auth URL:', err);
    res.status(500).json({ error: 'Could not generate Google auth URL' });
  }
});

/**
 * GET /api/google/callback?code=... — exchanges the OAuth2 code, stores the
 * refresh token and redirects the user back to the calendar page.
 */
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${FRONTEND_URL}/dashboard/calendar?google=error`);
    }
    const tokens = await exchangeCode(code);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { googleRefreshToken: tokens.refresh_token || null, googleCalendarSync: true },
    });
    res.redirect(`${FRONTEND_URL}/dashboard/calendar?google=connected`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${FRONTEND_URL}/dashboard/calendar?google=error`);
  }
});

/**
 * GET /api/google/status — returns whether Google Calendar is connected and sync enabled.
 */
router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { googleRefreshToken: true, googleCalendarSync: true },
    });
    res.json({
      connected: !!user?.googleRefreshToken,
      syncEnabled: user?.googleCalendarSync || false,
    });
  } catch (err) {
    console.error('Google status error:', err);
    res.status(500).json({ error: 'Could not fetch Google status' });
  }
});

/**
 * POST /api/google/sync — enables or disables automatic Calendar sync.
 * Body: { enabled: boolean }
 */
router.post('/sync', async (req, res) => {
  try {
    const { enabled } = req.body || {};
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { googleCalendarSync: !!enabled },
      select: { googleCalendarSync: true },
    });
    res.json({ syncEnabled: user.googleCalendarSync });
  } catch (err) {
    console.error('Google sync error:', err);
    res.status(500).json({ error: 'Could not update Google sync' });
  }
});

/**
 * DELETE /api/google/disconnect — removes the refresh token and disables sync.
 */
router.delete('/disconnect', async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { googleRefreshToken: null, googleCalendarSync: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Google disconnect error:', err);
    res.status(500).json({ error: 'Could not disconnect Google' });
  }
});

export default router;
