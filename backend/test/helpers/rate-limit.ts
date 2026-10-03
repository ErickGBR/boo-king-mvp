import {
  authLimiter,
  authMeLimiter,
  bookingLimiter,
  passwordResetLimiter,
  ticketLimiter,
} from '../../src/middleware/rate-limit.middleware';

/**
 * The rate limiters from `main.ts` are module-level singletons, so their
 * in-memory counters survive across test files in the same worker (the suite
 * runs with `maxWorkers: 1`). Resetting them before every test keeps the rate
 * limits deterministic and prevents one suite's traffic from turning another
 * suite's assertions into flaky 429s.
 *
 * express-rate-limit's default key generator normalizes IPv4-mapped IPv6
 * (`::ffff:127.0.0.1` → `127.0.0.1`), so the candidate set below covers every
 * loopback form a supertest request can present as `req.ip`.
 */
const LOOPBACK_KEYS = ['127.0.0.1', '::1', '::', '::ffff:127.0.0.1'];

export function resetLimiters(): void {
  for (const limiter of [
    authLimiter,
    authMeLimiter,
    bookingLimiter,
    passwordResetLimiter,
    ticketLimiter,
  ]) {
    for (const key of LOOPBACK_KEYS) {
      limiter.resetKey(key);
    }
  }
}
