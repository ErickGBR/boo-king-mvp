import { body } from 'express-validator';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../src/common/guards/optional-auth.guard';
import { ValidationGuard } from '../../src/common/guards/validation.guard';
import { JwtStrategy } from '../../src/common/passport/jwt.strategy';
import { UserNotFoundError } from '../../src/common/auth/user-not-found.error';

/** Minimal ExecutionContext stand-in (only the HTTP request is read). */
function contextWithRequest(req: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

describe('RolesGuard (requireRole replica)', () => {
  function makeGuard(required?: string[]) {
    const reflector = { getAllAndOverride: jest.fn(() => required) };
    return new RolesGuard(reflector as any);
  }

  it('passes through when no roles are required', () => {
    expect(makeGuard(undefined).canActivate(contextWithRequest({}))).toBe(true);
    expect(makeGuard([]).canActivate(contextWithRequest({}))).toBe(true);
  });

  it('401 when unauthenticated', () => {
    const guard = makeGuard(['owner']);
    expect(() => guard.canActivate(contextWithRequest({ user: undefined }))).toThrow();
    const err = (() => {
      try {
        guard.canActivate(contextWithRequest({ user: undefined }));
      } catch (e) {
        return e as any;
      }
    })();
    expect(err.getStatus()).toBe(401);
    expect(err.getResponse()).toEqual({ error: 'Unauthorized' });
  });

  it('403 when the role is not allowed', () => {
    const guard = makeGuard(['owner', 'admin']);
    const err = (() => {
      try {
        guard.canActivate(contextWithRequest({ user: { role: 'staff' } }));
      } catch (e) {
        return e as any;
      }
    })();
    expect(err.getStatus()).toBe(403);
    expect(err.getResponse()).toEqual({ error: 'Forbidden' });
  });

  it('allows when the role matches', () => {
    const guard = makeGuard(['owner', 'admin']);
    expect(guard.canActivate(contextWithRequest({ user: { role: 'owner' } }))).toBe(true);
  });
});

describe('JwtAuthGuard.handleRequest (401 granularity, R5)', () => {
  const guard = new JwtAuthGuard();

  it('user present → returned', () => {
    const user = { id: 1 };
    expect(guard.handleRequest(null, user, {})).toBe(user);
  });

  it('no token → 401 Unauthorized', () => {
    const err: any = (() => {
      try {
        guard.handleRequest(null, null, { message: 'No auth token' });
      } catch (e) {
        return e;
      }
    })();
    expect(err.getStatus()).toBe(401);
    expect(err.getResponse()).toEqual({ error: 'Unauthorized' });
  });

  it('malformed/expired token → 401 Invalid token', () => {
    const err: any = (() => {
      try {
        guard.handleRequest(null, null, { message: 'jwt malformed' });
      } catch (e) {
        return e;
      }
    })();
    expect(err.getResponse()).toEqual({ error: 'Invalid token' });
  });

  it('user row deleted → 401 User not found', () => {
    const err: any = (() => {
      try {
        guard.handleRequest(new UserNotFoundError(), null, {});
      } catch (e) {
        return e;
      }
    })();
    expect(err.getResponse()).toEqual({ error: 'User not found' });
  });

  it('other strategy error → 401 Invalid token', () => {
    const err: any = (() => {
      try {
        guard.handleRequest(new Error('boom'), null, {});
      } catch (e) {
        return e;
      }
    })();
    expect(err.getResponse()).toEqual({ error: 'Invalid token' });
  });
});

describe('OptionalAuthGuard.handleRequest', () => {
  it('never throws: missing user → undefined', () => {
    const guard = new OptionalAuthGuard();
    expect(guard.handleRequest(null, null, {})).toBeUndefined();
    expect(guard.handleRequest(new Error('x'), null, {})).toBeUndefined();
  });

  it('returns the user when present', () => {
    const guard = new OptionalAuthGuard();
    const user = { id: 9 };
    expect(guard.handleRequest(null, user, {})).toBe(user);
  });
});

describe('ValidationGuard', () => {
  it('returns true when validation passes', async () => {
    const guard = new ValidationGuard([body('email').isEmail()]);
    const req = { body: { email: 'a@b.com' }, query: {}, params: {}, cookies: {}, headers: {} };
    await expect(guard.canActivate(contextWithRequest(req))).resolves.toBe(true);
  });

  it('propagates the 422 ApiError on failure', async () => {
    const guard = new ValidationGuard([body('email').isEmail()]);
    const req = { body: { email: 'nope' }, query: {}, params: {}, cookies: {}, headers: {} };
    const error = await guard.canActivate(contextWithRequest(req)).catch((e) => e);
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse().errors).toHaveLength(1);
  });
});

describe('JwtStrategy.validate', () => {
  let prisma: any;
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(prisma);
  });

  it('throws when the payload has no userId (Invalid token)', async () => {
    await expect(strategy.validate({})).rejects.toThrow('Invalid token');
  });

  it('returns the projected user when found', async () => {
    const user = { id: 3, name: 'A', email: 'a@b.com', role: 'owner', avatar: null };
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(strategy.validate({ userId: 3 })).resolves.toBe(user);
  });

  it('throws UserNotFoundError when the row is gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate({ userId: 999 })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
