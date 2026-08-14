import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';
import {
  getAuthUrl,
  exchangeCode,
  verifyGoogleToken,
  syncAllUpcomingAppointments,
} from '../services/google.js';

const router = Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// C1 — JWT_SECRET is imported (validated, no 'dev-secret' fallback) from
// middleware/auth.js, which throws at startup when it is not set. This module
// never initializes the OAuth state signing with an insecure default.

const OAUTH_STATE_PURPOSE = 'google_calendar_oauth';
const OAUTH_STATE_TTL = '10m';

/**
 * Creates a signed OAuth state that binds the authorization request to the
 * authenticated user (CSRF protection, see M1/C2). The state is a short-lived
 * JWT carrying userId + nonce, signed with JWT_SECRET.
 * @param {number} userId - user id from the authenticated session
 * @returns {string} signed state
 */
function createOAuthState(userId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ userId, nonce, purpose: OAUTH_STATE_PURPOSE }, JWT_SECRET, {
    expiresIn: OAUTH_STATE_TTL,
  });
}

/**
 * Validates a signed OAuth state and returns its payload, or null when the
 * state is missing, malformed, expired or has the wrong purpose.
 * @param {string} state - state received on the callback
 * @returns {{ userId: number }|null} decoded payload or null
 */
function verifyOAuthState(state) {
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    if (decoded?.purpose !== OAUTH_STATE_PURPOSE || !decoded?.userId) return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * GET /api/google/auth — returns the Google OAuth2 authorization URL bound to
 * the current user via a signed state. Requires authentication.
 */
router.get('/auth', authMiddleware, (req, res) => {
  try {
    res.json({ url: getAuthUrl({ state: createOAuthState(req.user.id) }) });
  } catch (err) {
    console.error('Error generating Google auth URL:', err);
    res.status(500).json({ error: 'Could not generate Google auth URL' });
  }
});

/**
 * GET /api/google/callback?code=...&state=... — PUBLIC endpoint invoked by
 * Google's redirect, therefore it CANNOT require an Authorization header
 * (see C2). It validates the signed state to identify the user, exchanges the
 * code, verifies that the authorized Google account email matches the user's
 * email (M1), stores the refresh token and redirects back to the frontend.
 */
router.get('/callback', async (req, res) => {
  const redirectTo = (flag) => res.redirect(`${FRONTEND_URL}/dashboard/calendar?google=${flag}`);
  try {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string' || !state) {
      return redirectTo('error');
    }
    const decoded = verifyOAuthState(state);
    if (!decoded) {
      return redirectTo('error');
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return redirectTo('error');
    }
    const tokens = await exchangeCode(code);
    // M1 — the authorized Google account must belong to the same user. The ID
    // token is MANDATORY in the Calendar flow: without it (or when it fails
    // verification, or when it carries a different email) the association is
    // refused with ?google=error and the refresh token is NEVER persisted.
    if (!tokens?.id_token) {
      return redirectTo('error');
    }
    const payload = await verifyGoogleToken(tokens.id_token);
    if (!payload?.email || !user.email) {
      return redirectTo('error');
    }
    if (payload.email.toLowerCase() !== user.email.toLowerCase()) {
      return redirectTo('error');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleRefreshToken: tokens.refresh_token || user.googleRefreshToken,
        googleCalendarSync: true,
      },
    });
    return redirectTo('connected');
  } catch (err) {
    console.error('Google callback error:', err);
    return redirectTo('error');
  }
});

/**
 * GET /api/google/status — returns whether Google Calendar is connected and sync enabled.
 */
router.get('/status', authMiddleware, async (req, res) => {
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
 * When enabling, performs a REAL synchronization: all upcoming confirmed
 * appointments of the user's businesses that are not yet mirrored are pushed
 * to Google Calendar and their googleEventId is persisted (see M2).
 */
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const enabled = !!req.body?.enabled;
    // Validate BEFORE mutating: enabling sync without a connected Google
    // account returns 400 WITHOUT persisting googleCalendarSync=true, which
    // would leave the user in a contradictory state (see L-review).
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { googleRefreshToken: true },
    });
    if (enabled && !user?.googleRefreshToken) {
      return res.status(400).json({ error: 'Connect Google Calendar first' });
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { googleCalendarSync: enabled },
      select: { googleCalendarSync: true },
    });
    if (!updated.googleCalendarSync) {
      return res.json({ syncEnabled: false, synced: 0 });
    }
    const synced = await syncAllUpcomingAppointments(req.user.id);
    res.json({ syncEnabled: true, synced });
  } catch (err) {
    console.error('Google sync error:', err);
    res.status(500).json({ error: 'Could not update Google sync' });
  }
});

/**
 * DELETE /api/google/disconnect — removes the refresh token and disables sync.
 */
router.delete('/disconnect', authMiddleware, async (req, res) => {
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
