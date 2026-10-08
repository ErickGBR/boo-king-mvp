import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import {
  resetDb,
  categoryIdBySlug,
  createUser,
  createBusiness,
  createAppointment,
  DEFAULT_PASSWORD,
} from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer, loginToken } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for the remaining endpoints: calendar (#25), categories (#26),
 * reports (#27), google (#35–#39) + callback (#36), tickets (#40) and health (#41).
 */
describe('Mixed endpoints (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  let ownerToken: string;
  let outsiderToken: string;
  let businessId: number;
  let foreignBusinessId: number;
  let ticket: { id: number };

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    const categoryId = await categoryIdBySlug(prisma, 'test-dental');

    const owner = await createUser(prisma, { email: 'mix.owner@test.dev' });
    const outsider = await createUser(prisma, { email: 'mix.outsider@test.dev' });
    const business = await createBusiness(prisma, { userId: owner.id, categoryId });
    const foreign = await createBusiness(prisma, { userId: outsider.id, categoryId });
    businessId = business.id;
    foreignBusinessId = foreign.id;

    ticket = await createAppointment(prisma, {
      businessId,
      guestName: 'Ticket Holder',
      guestEmail: 'holder@example.com',
      status: 'confirmed',
    });

    ownerToken = await loginToken(http, 'mix.owner@test.dev');
    outsiderToken = await loginToken(http, 'mix.outsider@test.dev');
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  describe('GET /api/calendar/events (#25)', () => {
    it('401 without a token', async () => {
      await request(http).get('/api/calendar/events').expect(401);
    });

    it('200 with the owner\'s confirmed appointments', async () => {
      const res = await request(http)
        .get('/api/calendar/events')
        .set(bearer(ownerToken))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const event = res.body.find((e: any) => e.id === ticket.id);
      expect(event).toEqual(
        expect.objectContaining({
          id: ticket.id,
          start: expect.any(String),
          end: expect.any(String),
          extendedProps: expect.objectContaining({ role: 'Dueño' }),
        }),
      );
    });
  });

  describe('GET /api/categories (#26 — public)', () => {
    it('200 with the sorted catalog', async () => {
      const res = await request(http).get('/api/categories').expect(200);
      expect(res.body.map((c: any) => c.slug)).toEqual(
        expect.arrayContaining(['test-barberia', 'test-spa', 'test-dental']),
      );
      const sorts = res.body.map((c: any) => c.sort);
      expect([...sorts]).toEqual([...sorts].sort((a, b) => a - b));
    });
  });

  describe('GET /api/reports/summary (#27)', () => {
    it('200 with summary / byStatus / byDay', async () => {
      const res = await request(http)
        .get('/api/reports/summary')
        .set(bearer(ownerToken))
        .set('X-Current-Business-Id', String(businessId))
        .expect(200);
      expect(res.body.summary).toEqual(
        expect.objectContaining({
          today: expect.any(Number),
          last7Days: expect.any(Number),
          last30Days: expect.any(Number),
        }),
      );
      expect(res.body.byStatus).toEqual(
        expect.objectContaining({ confirmed: expect.any(Number) }),
      );
      expect(res.body.byDay).toHaveLength(30);
    });

    it('400 { error: "Select a business" } without the header', async () => {
      const res = await request(http)
        .get('/api/reports/summary')
        .set(bearer(ownerToken))
        .expect(400);
      expect(res.body).toEqual({ error: 'Select a business' });
    });

    it('400 { error: "Invalid date range" } for a malformed range', async () => {
      const res = await request(http)
        .get('/api/reports/summary?start=oops')
        .set(bearer(ownerToken))
        .set('X-Current-Business-Id', String(businessId))
        .expect(400);
      expect(res.body).toEqual({ error: 'Invalid date range' });
    });

    it('400 { error: "Range too large (max 366 days)" } for a wide range', async () => {
      const res = await request(http)
        .get('/api/reports/summary?start=2020-01-01&end=2026-01-01')
        .set(bearer(ownerToken))
        .set('X-Current-Business-Id', String(businessId))
        .expect(400);
      expect(res.body).toEqual({ error: 'Range too large (max 366 days)' });
    });

    it('404 for a foreign business (IDOR)', async () => {
      const res = await request(http)
        .get('/api/reports/summary')
        .set(bearer(ownerToken))
        .set('X-Current-Business-Id', String(foreignBusinessId))
        .expect(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('Google endpoints (#35–#39)', () => {
    it('#35 GET /api/google/auth → 200 { url }', async () => {
      const res = await request(http)
        .get('/api/google/auth')
        .set(bearer(ownerToken))
        .expect(200);
      expect(res.body.url).toContain('accounts.google.com');
    });

    it('#37 GET /api/google/status → 200 { connected:false, syncEnabled:false }', async () => {
      const res = await request(http)
        .get('/api/google/status')
        .set(bearer(ownerToken))
        .expect(200);
      expect(res.body).toEqual({ connected: false, syncEnabled: false });
    });

    it('#38 POST /api/google/sync disabling → 200 { syncEnabled:false, synced:0 }', async () => {
      const res = await request(http)
        .post('/api/google/sync')
        .set(bearer(ownerToken))
        .send({ enabled: false })
        .expect(200);
      expect(res.body).toEqual({ syncEnabled: false, synced: 0 });
    });

    it('#38 POST /api/google/sync enabling without a connection → 400', async () => {
      const res = await request(http)
        .post('/api/google/sync')
        .set(bearer(ownerToken))
        .send({ enabled: true })
        .expect(400);
      expect(res.body).toEqual({ error: 'Connect Google Calendar first' });
    });

    it('#39 DELETE /api/google/disconnect → 200 { ok:true }', async () => {
      const res = await request(http)
        .delete('/api/google/disconnect')
        .set(bearer(ownerToken))
        .expect(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('#36 GET /api/google/callback without code/state → 302 ?google=error', async () => {
      const res = await request(http).get('/api/google/callback').expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/dashboard/calendar?google=error');
    });
  });

  describe('GET /api/tickets/:id (#40)', () => {
    it('200 publicly, hiding guest data and canCheckIn=false; sets RateLimit headers', async () => {
      const res = await request(http).get(`/api/tickets/${ticket.id}`).expect(200);
      expect(res.body.appointment).toEqual(
        expect.objectContaining({
          id: ticket.id,
          ticketNumber: expect.stringMatching(/^BK-\d{6}$/),
          status: 'confirmed',
        }),
      );
      expect(res.body.appointment.guestName).toBeUndefined();
      expect(res.body.canCheckIn).toBe(false);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('200 for the owner exposing the private fields and canCheckIn=true', async () => {
      const res = await request(http)
        .get(`/api/tickets/${ticket.id}`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(res.body.canCheckIn).toBe(true);
      expect(res.body.appointment.guestName).toBe('Ticket Holder');
      expect(res.body.appointment.guestEmail).toBe('holder@example.com');
    });

    it('an invalid token never 401s (optional auth → anonymous)', async () => {
      const res = await request(http)
        .get(`/api/tickets/${ticket.id}`)
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(200);
      expect(res.body.canCheckIn).toBe(false);
    });

    it('404 for an unknown id and for a non-numeric id', async () => {
      await request(http).get('/api/tickets/999999').expect(404);
      await request(http).get('/api/tickets/abc').expect(404);
    });
  });

  describe('GET /api/health (#41)', () => {
    it('200 { ok:true }', async () => {
      const res = await request(http).get('/api/health').expect(200);
      expect(res.body).toEqual({ ok: true });
    });
  });
});
