import {
  extractToken,
  signToken,
  verifyToken,
  createOAuthState,
  verifyOAuthState,
  OAUTH_STATE_PURPOSE,
} from '../../src/common/auth/token.util';

/**
 * Unit contract for auth token + cookie handling (design doc §3.3 / R8):
 * HS256, `{ userId }` payload, 7d expiry, Bearer-first with cookie fallback, and
 * the signed OAuth state used by the Google callback.
 */
const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe('token.util', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = ORIGINAL_SECRET;
  });

  it('signs a verifiable HS256 token carrying { userId }', () => {
    const token = signToken({ userId: 123 });
    const decoded: any = verifyToken(token);
    expect(decoded.userId).toBe(123);
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });

  it('returns null for a malformed or foreign token', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
    const foreign = require('jsonwebtoken').sign({ userId: 1 }, 'other-secret');
    expect(verifyToken(foreign)).toBeNull();
  });

  describe('extractToken (Bearer first, cookie fallback)', () => {
    it('reads the Authorization: Bearer header', () => {
      expect(
        extractToken({ headers: { authorization: 'Bearer abc.def.ghi' }, cookies: {} }),
      ).toBe('abc.def.ghi');
    });

    it('falls back to the token cookie', () => {
      expect(
        extractToken({ headers: {}, cookies: { token: 'cookie-token' } }),
      ).toBe('cookie-token');
    });

    it('prefers the Bearer header over the cookie', () => {
      expect(
        extractToken({
          headers: { authorization: 'Bearer header-token' },
          cookies: { token: 'cookie-token' },
        }),
      ).toBe('header-token');
    });

    it('returns null when neither is present', () => {
      expect(extractToken({ headers: {}, cookies: {} })).toBeNull();
      expect(extractToken({})).toBeNull();
    });
  });

  describe('OAuth state', () => {
    it('round-trips a signed state bound to the user', () => {
      const state = createOAuthState(55);
      const decoded = verifyOAuthState(state);
      expect(decoded).toMatchObject({ userId: 55, purpose: OAUTH_STATE_PURPOSE });
    });

    it('rejects a token with the wrong purpose', () => {
      const wrong = require('jsonwebtoken').sign(
        { userId: 1, purpose: 'something_else' },
        'unit-test-secret',
        { algorithm: 'HS256' },
      );
      expect(verifyOAuthState(wrong)).toBeNull();
    });

    it('rejects malformed and foreign-signed states', () => {
      expect(verifyOAuthState('garbage')).toBeNull();
      const foreign = require('jsonwebtoken').sign(
        { userId: 1, purpose: OAUTH_STATE_PURPOSE },
        'other-secret',
      );
      expect(verifyOAuthState(foreign)).toBeNull();
    });
  });

  it('throws when JWT_SECRET is not configured (fail-fast)', () => {
    delete process.env.JWT_SECRET;
    expect(() => signToken({ userId: 1 })).toThrow('JWT_SECRET must be set');
  });
});
