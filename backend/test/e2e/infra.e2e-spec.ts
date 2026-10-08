import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { resetDb, createUser } from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer, loginToken } from '../helpers/api';
import { authLimiter } from '../../src/middleware/rate-limit.middleware';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Cross-cutting transport contract: the documented unknown-route deviation
 * (§9.3), body-parser limits (R15), malformed JSON, and the rate-limit
 * boundary + header parity (R3). These pin the `main.ts` middleware chain.
 */
describe('Transport / infra (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    resetLimiters();
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  it('unknown /api/* → 404 JSON (documented deviation §9.3)', async () => {
    const res = await request(http).get('/api/no-such-endpoint').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    expect(res.body.message).toContain('Cannot GET /api/no-such-endpoint');
  });

  it('an unmatched subpath of a guarded router still requires auth (mount fallback)', async () => {
    const res = await request(http).get('/api/appointments/junk/elsewhere').expect(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('413 { error: "request entity too large" } for a body > 100 kb (R15)', async () => {
    const res = await request(http)
      .post('/api/auth/logout')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(120_000) }))
      .expect(413);
    expect(res.body).toEqual({ error: 'request entity too large' });
  });

  it('400 { error: <message> } for malformed JSON', async () => {
    const res = await request(http)
      .post('/api/auth/logout')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error).toMatch(/JSON/i);
  });

  it('429 boundary on /api/auth with standard headers and no legacy X-RateLimit-* (R3)', async () => {
    const payload = { email: 'burst@nowhere.dev', password: 'password123' };

    // 20 requests are within the 20/15min window.
    for (let i = 0; i < 20; i += 1) {
      await request(http).post('/api/auth/login').send(payload).expect(401);
    }

    const res = await request(http).post('/api/auth/login').send(payload).expect(429);
    expect(res.body).toEqual({ error: 'Too many requests, try again later' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBe('0');
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(authLimiter).toBeDefined();
  });

  it('D15 — GET /api/auth/me is exempt from the 20/15min auth budget; POST /login still caps', async () => {
    // Fixture creation goes through Prisma (not the API) so it costs no quota.
    const user = await createUser(prisma, { email: 'd15.me@test.dev' });
    // 1 request — this is the valid user's normal session start.
    const token = await loginToken(http, user.email);

    const payload = { email: 'burst@nowhere.dev', password: 'password123' };
    // 19 more login attempts fill the 20-request budget (the first login
    // above already consumed one slot).
    for (let i = 0; i < 19; i += 1) {
      await request(http).post('/api/auth/login').send(payload).expect(401);
    }

    // Brute-force protection is intact: request #21 is rejected.
    const blocked = await request(http)
      .post('/api/auth/login')
      .send(payload)
      .expect(429);
    expect(blocked.body).toEqual({ error: 'Too many requests, try again later' });
    expect(blocked.headers['ratelimit-remaining']).toBe('0');

    // ...while the SPA's session check still succeeds (it used to 429 and log
    // the user out) and is governed by its own 300/15min bucket.
    const me = await request(http)
      .get('/api/auth/me')
      .set(bearer(token))
      .expect(200);
    expect(me.body.user.email).toBe('d15.me@test.dev');
    expect(me.headers['ratelimit-limit']).toBe('300');

    // Unauthenticated /me is still 401 (guard), never a limiter 429.
    await request(http).get('/api/auth/me').expect(401);
  });
});
