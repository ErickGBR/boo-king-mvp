import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * The three `express-rate-limit` instances of the original `src/index.js`,
 * kept unchanged (windowMs / max / standardHeaders / legacyHeaders / message)
 * and mounted on the real Express instance in `main.ts` — identical
 * `RateLimit-*` standard headers, no legacy `X-RateLimit-*`, identical 429 body
 * `{ error: 'Too many requests, try again later' }`.
 *
 * `@nestjs/throttler` was rejected because it emits the legacy headers, which
 * would break the header contract.
 *
 * D15 — `GET /api/auth/me` is a safe, idempotent read that the SPA performs on
 * every navigation/session check. Counting it against the 20/15min brute-force
 * budget silently logged valid users out (the SPA clears the token on 429), and
 * behind a shared/NAT IP the cap could be exhausted by unrelated users. It is
 * therefore EXEMPT from `authLimiter` (`skip` below) and governed by its own
 * generous `authMeLimiter` (300/15min per IP) so it is still DoS-bounded.
 * Every state-changing/credential endpoint — POST register/login/google/logout,
 * PUT me — keeps the original 20/15min budget. No brute-force protection is
 * weakened.
 */

const RATE_LIMIT_BODY = { error: 'Too many requests, try again later' };

/**
 * True only for `GET /api/auth/me` (with or without a trailing slash / query).
 *
 * Both forms are checked because the limiter is mounted either on the whole
 * `/api/auth` prefix (where Express exposes `req.path === '/me'`) or directly on
 * the `/me` router; `originalUrl` always carries the full path.
 */
export function isOwnProfileRead(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return path === '/me' || path === '/me/' || path === '/api/auth/me' || path === '/api/auth/me/';
}

/** 300 requests / 15 min per IP — the budget for the exempt `GET /me` read. */
export const authMeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_BODY,
});

/** 20 requests / 15 min per IP, everything under `/api/auth` except GET /me. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_BODY,
  skip: (req) => isOwnProfileRead(req),
});

/**
 * 5 requests / 15 min per IP for `POST /api/auth/forgot-password`.
 *
 * This endpoint rotates the account password and sends an e-mail (bcrypt + SMTP
 * work per request), so it gets a tighter budget than the generic auth limiter.
 * It is mounted IN ADDITION to `authLimiter` (which already caps every
 * `/api/auth` route at 20/15min): both counters apply.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_BODY,
});

export const ticketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_BODY,
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_BODY,
});
