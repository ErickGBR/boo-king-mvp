import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * JWT helpers — moved VERBATIM from `src/middleware/auth.js` (routes/google.js
 * consumes the same constants for OAuth state signing).
 *
 * The module-level `throw` of the Express version was replaced by the
 * `validateEnv` fail-fast at bootstrap: the process still refuses to boot
 * without JWT_SECRET, but signing/verifying keeps the exact same parameters
 * (HS256, expiresIn 7d, payload { userId }).
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set in environment');
  }
  return secret;
}

export function signToken(payload: object): string {
  return jwt.sign(payload, jwtSecret(), { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export const OAUTH_STATE_PURPOSE = 'google_calendar_oauth';
const OAUTH_STATE_TTL = '10m';

/**
 * Creates a signed OAuth state that binds the authorization request to the
 * authenticated user (CSRF protection). MOVED VERBATIM from `routes/google.js`.
 */
export function createOAuthState(userId: number): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ userId, nonce, purpose: OAUTH_STATE_PURPOSE }, jwtSecret(), {
    algorithm: 'HS256',
    expiresIn: OAUTH_STATE_TTL,
  });
}

/**
 * Validates a signed OAuth state and returns its payload, or null when the
 * state is missing, malformed, expired or has the wrong purpose.
 * MOVED VERBATIM from `routes/google.js`.
 */
export function verifyOAuthState(state: string): { userId: number } | null {
  try {
    // HS256 is pinned explicitly (same as authMiddleware): a token whose header
    // claims another algorithm is rejected instead of being auto-discovered.
    const decoded = jwt.verify(state, jwtSecret(), { algorithms: ['HS256'] }) as any;
    if (decoded?.purpose !== OAUTH_STATE_PURPOSE || !decoded?.userId) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Token extraction identical to the Express middleware:
 *   req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token
 * (Bearer-first, cookie fallback.)
 */
export function extractToken(req: any): string | null {
  const header = req?.headers?.authorization;
  const fromHeader = header ? header.replace('Bearer ', '') : undefined;
  return fromHeader || req?.cookies?.token || null;
}
