import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import {
  resetDb,
  categoryIdBySlug,
  createUser,
  createBusiness,
  createService,
  upsertSchedule,
} from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for the PUBLIC booking endpoints #20–#24 (design doc §1.4).
 * No auth guard is mounted on the booking router, so `reserve` must persist
 * `userId: null` even for a request that carries a token.
 */
describe('Booking API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  const SLUG = 'booking-public-fixture';
  const FUTURE_DATE = '2099-02-01';
  let businessId: number;
  let serviceId: number;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    const categoryId = await categoryIdBySlug(prisma, 'test-spa');
    const owner = await createUser(prisma, { email: 'booking.owner@test.dev' });
    const business = await createBusiness(prisma, {
      userId: owner.id,
      categoryId,
      slug: SLUG,
      durationMinutes: 30,
      timezone: 'UTC',
    });
    businessId = business.id;
    // A schedule on every weekday so any requested date yields slots.
    for (let day = 0; day <= 6; day++) {
      await upsertSchedule(prisma, businessId, day, '08:00', '10:00');
    }
    const service = await createService(prisma, businessId, {
      name: 'Corte',
      price: 120,
      durationMinutes: 30,
    });
    serviceId = service.id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  // The mailer is fire-and-forget and points at a dead SMTP port in tests;
  // its expected ECONNREFUSED noise is silenced so failures stay visible.
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('GET /api/booking/business/:slug (#20)', () => {
    it('200 with { business, services, dates }', async () => {
      const res = await request(http).get(`/api/booking/business/${SLUG}`).expect(200);
      expect(res.body.business).toEqual(
        expect.objectContaining({ id: businessId, slug: SLUG, durationMinutes: 30 }),
      );
      expect(res.body.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: serviceId, name: 'Corte', price: 120 }),
        ]),
      );
      expect(res.body.dates.length).toBeGreaterThan(0);
    });

    it('404 { error: "Not found" } for an unknown slug', async () => {
      const res = await request(http)
        .get('/api/booking/business/does-not-exist')
        .expect(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('GET /api/booking/business/:slug/services (#21)', () => {
    it('200 with the active services projection', async () => {
      const res = await request(http)
        .get(`/api/booking/business/${SLUG}/services`)
        .expect(200);
      expect(res.body.services[0]).toEqual(
        expect.objectContaining({ id: serviceId, name: 'Corte', price: 120, durationMinutes: 30 }),
      );
    });

    it('404 for an unknown slug', async () => {
      await request(http).get('/api/booking/business/nope/services').expect(404);
    });
  });

  describe('GET /api/booking/business/:slug/slots (#22)', () => {
    it('422 { error: "date required" } without a date', async () => {
      const res = await request(http)
        .get(`/api/booking/business/${SLUG}/slots`)
        .expect(422);
      expect(res.body).toEqual({ error: 'date required' });
    });

    it('200 with the available slots for a date', async () => {
      const res = await request(http)
        .get(`/api/booking/business/${SLUG}/slots?date=${FUTURE_DATE}`)
        .expect(200);
      expect(res.body.slots).toHaveLength(4);
      expect(res.body.slots.map((s: any) => s.start)).toEqual([
        '08:00',
        '08:30',
        '09:00',
        '09:30',
      ]);
    });

    it('404 for an unknown slug', async () => {
      await request(http).get(`/api/booking/business/nope/slots?date=${FUTURE_DATE}`).expect(404);
    });
  });

  describe('GET /api/booking/business/:slug/calendar-slots (#23)', () => {
    it('422 { error: "start and end required" } without a range', async () => {
      const res = await request(http)
        .get(`/api/booking/business/${SLUG}/calendar-slots`)
        .expect(422);
      expect(res.body).toEqual({ error: 'start and end required' });
    });

    it('200 with events and the exact Cache-Control header (R12)', async () => {
      const res = await request(http)
        .get(`/api/booking/business/${SLUG}/calendar-slots?start=${FUTURE_DATE}&end=${FUTURE_DATE}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.headers['cache-control']).toBe(
        'no-store, no-cache, must-revalidate, max-age=0',
      );
      expect(res.body[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), title: 'Disponible' }),
      );
    });
  });

  describe('POST /api/booking/business/:slug/reserve (#24)', () => {
    const reserveBody = (over: Record<string, any> = {}) => ({
      starts_at: '2099-03-01T08:00:00.000Z',
      ends_at: '2099-03-01T08:30:00.000Z',
      guest_name: 'Public Guest',
      guest_email: 'public.guest@example.com',
      service_ids: [serviceId],
      ...over,
    });

    it('201 { appointment, success: true } with userId NULL (public, no auth)', async () => {
      const res = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(reserveBody())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.appointment).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          userId: null,
          guestName: 'Public Guest',
          status: 'confirmed',
          notifyByEmail: true,
        }),
      );
    });

    it('409 { error: "slot_taken" } for an overlapping reservation', async () => {
      const body = reserveBody({
        starts_at: '2099-04-01T09:00:00.000Z',
        ends_at: '2099-04-01T09:30:00.000Z',
      });
      await request(http).post(`/api/booking/business/${SLUG}/reserve`).send(body).expect(201);
      const res = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(body)
        .expect(409);
      expect(res.body).toEqual({ error: 'slot_taken' });
    });

    it('D13 — two truly concurrent reserves for the same slot yield exactly one 201 and one 409 slot_taken', async () => {
      const body = reserveBody({
        starts_at: '2099-10-01T08:00:00.000Z',
        ends_at: '2099-10-01T08:30:00.000Z',
        guest_email: 'd13.race@example.com',
      });
      const fire = () =>
        request(http).post(`/api/booking/business/${SLUG}/reserve`).send(body);

      // Both requests are dispatched in the same tick: without the atomic
      // check-then-create (D13) both used to return 201 and persist 2 rows.
      const [first, second] = await Promise.all([fire(), fire()]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      const loser = first.status === 409 ? first : second;
      const winner = first.status === 201 ? first : second;
      expect(loser.body).toEqual({ error: 'slot_taken' });
      expect(winner.body.success).toBe(true);

      const rows = await prisma.appointment.count({
        where: {
          businessId,
          startsAt: new Date(body.starts_at),
          endsAt: new Date(body.ends_at),
        },
      });
      expect(rows).toBe(1);
    });

    it('a cancelled appointment frees the slot for a new reservation', async () => {
      const body = reserveBody({
        starts_at: '2099-11-01T08:00:00.000Z',
        ends_at: '2099-11-01T08:30:00.000Z',
      });
      const created = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(body)
        .expect(201);

      // Cancelling only changes `status`; the availability query ignores it.
      await prisma.appointment.update({
        where: { id: created.body.appointment.id },
        data: { status: 'cancelled' },
      });

      const rebooked = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(body)
        .expect(201);
      expect(rebooked.body.appointment.id).not.toBe(created.body.appointment.id);
    });

    it('422 for a starts_at in the past', async () => {
      const res = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(reserveBody({ starts_at: '2000-01-01T08:00:00.000Z', ends_at: '2000-01-01T08:30:00.000Z' }))
        .expect(422);
      expect(res.body.errors.map((e: any) => e.path)).toContain('starts_at');
    });

    it('422 when ends_at is not after starts_at', async () => {
      const res = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(
          reserveBody({
            starts_at: '2099-05-01T10:00:00.000Z',
            ends_at: '2099-05-01T09:00:00.000Z',
          }),
        )
        .expect(422);
      expect(res.body.errors.map((e: any) => e.path)).toContain('ends_at');
    });

    it('404 { error: "Service not found", missingIds } for an unknown service', async () => {
      const res = await request(http)
        .post(`/api/booking/business/${SLUG}/reserve`)
        .send(
          reserveBody({
            starts_at: '2099-06-01T08:00:00.000Z',
            ends_at: '2099-06-01T08:30:00.000Z',
            service_ids: [999999],
          }),
        )
        .expect(404);
      expect(res.body).toEqual({ error: 'Service not found', missingIds: [999999] });
    });

    it('404 { error: "Not found" } for an unknown slug', async () => {
      const res = await request(http)
        .post('/api/booking/business/nope/reserve')
        .send(reserveBody())
        .expect(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });
});
