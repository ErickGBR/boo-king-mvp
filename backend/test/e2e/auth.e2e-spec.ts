import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { resetDb, DEFAULT_PASSWORD } from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { registerAndToken } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MailerService } from '../../src/modules/mailer/mailer.service';

/**
 * Contract tests for auth endpoints #1–#6 (design doc §1.1, R2/R5/R8).
 */
describe('Auth API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  describe('POST /api/auth/register (#1)', () => {
    it('201 with { user, token } and no password field', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: 'Ana', email: 'ana.reg@test.dev', password: DEFAULT_PASSWORD })
        .expect(201);

      expect(res.body.user).toEqual(
        expect.objectContaining({ id: expect.any(Number), name: 'Ana', email: 'ana.reg@test.dev', role: 'owner' }),
      );
      expect(res.body.user.password).toBeUndefined();
      expect(typeof res.body.token).toBe('string');

      const me = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);
      expect(me.body.user.email).toBe('ana.reg@test.dev');
    });

    it('422 with the express-validator error array shape', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: '', email: 'not-an-email', password: 'short' })
        .expect(422);

      expect(Array.isArray(res.body.errors)).toBe(true);
      for (const item of res.body.errors) {
        expect(item).toEqual(
          expect.objectContaining({
            type: expect.any(String),
            msg: expect.any(String),
            path: expect.any(String),
            location: 'body',
          }),
        );
      }
      const paths = res.body.errors.map((e: any) => e.path);
      expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });

    it('422 { error: "Email already registered" } on a duplicate email', async () => {
      await request(http)
        .post('/api/auth/register')
        .send({ name: 'Dup', email: 'dup@test.dev', password: DEFAULT_PASSWORD })
        .expect(201);

      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: 'Dup2', email: 'dup@test.dev', password: DEFAULT_PASSWORD })
        .expect(422);
      expect(res.body).toEqual({ error: 'Email already registered' });
    });

    it('D17.3 — two concurrent registrations for the same email: one 201, one 422, one user', async () => {
      const payload = {
        name: 'Race',
        email: 'race.conc@test.dev',
        password: DEFAULT_PASSWORD,
      };
      const fire = () => request(http).post('/api/auth/register').send(payload);

      // Both requests pass the findUnique fast-path before either INSERT lands
      // (bcrypt widens the window); pre-fix the loser got a raw 500 from P2002.
      const [first, second] = await Promise.all([fire(), fire()]);

      expect([first.status, second.status].sort()).toEqual([201, 422]);
      const loser = first.status === 422 ? first : second;
      expect(loser.body).toEqual({ error: 'Email already registered' });

      const count = await prisma.user.count({ where: { email: payload.email } });
      expect(count).toBe(1);
    });

    it('normalizes the email before persisting (R2)', async () => {
      const res = await request(http)
        .post('/api/auth/register')
        .send({ name: 'Gmail', email: 'User.Name+tag@Gmail.com', password: DEFAULT_PASSWORD })
        .expect(201);
      expect(res.body.user.email).toBe('username@gmail.com');
    });
  });

  describe('POST /api/auth/login (#2)', () => {
    beforeAll(async () => {
      await request(http)
        .post('/api/auth/register')
        .send({ name: 'Log', email: 'login@test.dev', password: DEFAULT_PASSWORD });
    });

    it('200 with { user, token } on valid credentials', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ email: 'login@test.dev', password: DEFAULT_PASSWORD })
        .expect(200);
      expect(res.body.user).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Log',
          email: 'login@test.dev',
          role: 'owner',
          avatar: null,
        }),
      );
      expect(typeof res.body.token).toBe('string');
    });

    it('401 { error: "Invalid credentials" } on a bad password', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ email: 'login@test.dev', password: 'wrong-password' })
        .expect(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    it('422 on an invalid email (validation runs before the handler)', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ email: 'nope', password: 'x' })
        .expect(422);
      expect(res.body.errors[0].path).toBe('email');
    });
  });

  describe('POST /api/auth/logout (#3)', () => {
    it('200 { ok: true } and clears the token cookie', async () => {
      const res = await request(http).post('/api/auth/logout').expect(200);
      expect(res.body).toEqual({ ok: true });
      const setCookie = res.headers['set-cookie']?.join(';') ?? '';
      expect(setCookie).toContain('token=;');
      expect(setCookie).toContain('Expires=');
    });
  });

  describe('GET /api/auth/me (#4)', () => {
    let token: string;
    let userId: number;

    beforeAll(async () => {
      const created = await registerAndToken(http, { email: 'me@test.dev', name: 'Me' });
      token = created.token;
      userId = created.user.id;
    });

    it('200 with the user when authenticated via Bearer', async () => {
      const res = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.user.email).toBe('me@test.dev');
    });

    it('200 when authenticated via the token cookie (fallback, R8)', async () => {
      const res = await request(http)
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`)
        .expect(200);
      expect(res.body.user.email).toBe('me@test.dev');
    });

    it('Bearer takes precedence over an invalid cookie (R8)', async () => {
      const res = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', 'token=not-a-jwt')
        .expect(200);
      expect(res.body.user.email).toBe('me@test.dev');
    });

    it('401 { error: "Unauthorized" } without a token', async () => {
      const res = await request(http).get('/api/auth/me').expect(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('401 { error: "Invalid token" } for a malformed token', async () => {
      const res = await request(http)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('401 { error: "User not found" } when the token user row is gone', async () => {
      const temp = await registerAndToken(http, { email: 'ghost@test.dev', name: 'Ghost' });
      await prisma.user.delete({ where: { id: temp.user.id } });

      const res = await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${temp.token}`)
        .expect(401);
      expect(res.body).toEqual({ error: 'User not found' });
    });

    it('the fixture user still exists (sanity)', async () => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.email).toBe('me@test.dev');
    });
  });

  describe('PUT /api/auth/me (#5)', () => {
    let token: string;

    beforeAll(async () => {
      const created = await registerAndToken(http, { email: 'update@test.dev', name: 'Old' });
      token = created.token;
    });

    it('200 updates the name', async () => {
      const res = await request(http)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body.user.name).toBe('New Name');
    });

    it('400 { error: "Nothing to update" } with an empty body', async () => {
      const res = await request(http)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      expect(res.body).toEqual({ error: 'Nothing to update' });
    });

    it('422 for a too-short password', async () => {
      const res = await request(http)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'short' })
        .expect(422);
      expect(res.body.errors[0].path).toBe('password');
    });
  });

  describe('POST /api/auth/google (#6)', () => {
    it('422 { error: "Google authorization code required" } without a code', async () => {
      const res = await request(http).post('/api/auth/google').send({}).expect(422);
      expect(res.body).toEqual({ error: 'Google authorization code required' });
    });
  });

  describe('POST /api/auth/forgot-password (#7)', () => {
    let mailer: MailerService;
    let sendSpy: jest.SpyInstance;

    beforeAll(() => {
      // The mailer is global; spy so the suite never opens an SMTP socket.
      mailer = app.get(MailerService);
      sendSpy = jest
        .spyOn(mailer, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);
    });

    afterAll(() => {
      sendSpy.mockRestore();
    });

    it('200 {ok:true} and rotates the password to a bcrypt hash for a known email', async () => {
      const created = await registerAndToken(http, {
        email: 'forgot@test.dev',
        name: 'Forgetful',
      });
      const before = await prisma.user.findUnique({ where: { id: created.user.id } });

      const res = await request(http)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@test.dev' })
        .expect(200);

      expect(res.body).toEqual({ ok: true });

      const after = await prisma.user.findUnique({ where: { id: created.user.id } });
      expect(after?.password).not.toBe(before?.password);
      expect(after?.password).toMatch(/^\$2[aby]\$/); // bcrypt, not SHA256

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [to, plain] = sendSpy.mock.calls[0];
      expect(to).toBe('forgot@test.dev');
      expect(plain.length).toBeGreaterThanOrEqual(12);
      expect(plain).not.toBe(after?.password);
      expect(await bcrypt.compare(plain, after?.password as string)).toBe(true);

      // The clear-text password must never travel in the HTTP response.
      expect(JSON.stringify(res.body)).not.toContain(plain);
    });

    it('200 {ok:true} for an unknown email (no account enumeration) and sends nothing', async () => {
      const res = await request(http)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@test.dev' })
        .expect(200);

      expect(res.body).toEqual({ ok: true });
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('422 with the validator error shape for an invalid email', async () => {
      const res = await request(http)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(422);

      expect(res.body.errors[0].path).toBe('email');
    });

    it('keeps JWT sessions valid after the rotation (login still works with the emailed one)', async () => {
      const created = await registerAndToken(http, {
        email: 'forgot.login@test.dev',
        name: 'Rotated',
      });
      const oldToken = created.token;

      await request(http)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot.login@test.dev' })
        .expect(200);

      // Existing JWT is untouched by the password rotation...
      await request(http)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(200);

      // ...and the newly generated password is the one that now logs in.
      const plain = sendSpy.mock.calls[0][1];
      const login = await request(http)
        .post('/api/auth/login')
        .send({ email: 'forgot.login@test.dev', password: plain })
        .expect(200);
      expect(login.body.user.email).toBe('forgot.login@test.dev');
    });

    it('429 after 5 requests in the window (dedicated password-reset bucket)', async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(http)
          .post('/api/auth/forgot-password')
          .send({ email: `rate${i}@test.dev` })
          .expect(200);
      }
      const res = await request(http)
        .post('/api/auth/forgot-password')
        .send({ email: 'rate-blocked@test.dev' })
        .expect(429);
      expect(res.body).toEqual({ error: 'Too many requests, try again later' });
    });
  });
});
