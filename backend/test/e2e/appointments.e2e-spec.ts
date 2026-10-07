import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import {
  resetDb,
  categoryIdBySlug,
  createUser,
  createBusiness,
  createService,
  createAppointment,
  addStaff,
  upsertSchedule,
  DEFAULT_PASSWORD,
} from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer, loginToken } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for appointments endpoints #12–#19 (design doc §1.3, R6/R7/R17).
 * Exercises the guard order (ownership before validation), the staff-or-owner
 * authorization (404 never 403) and idempotent status transitions.
 */
describe('Appointments API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  let ownerToken: string;
  let staffToken: string;
  let outsiderToken: string;
  let businessId: number;
  let foreignBusinessId: number;
  let serviceId: number;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    const categoryId = await categoryIdBySlug(prisma, 'test-barberia');

    const owner = await createUser(prisma, { email: 'apt.owner@test.dev' });
    const staff = await createUser(prisma, { email: 'apt.staff@test.dev', role: 'staff' });
    const outsider = await createUser(prisma, { email: 'apt.outsider@test.dev' });
    const business = await createBusiness(prisma, {
      userId: owner.id,
      categoryId,
      durationMinutes: 30,
      timezone: 'UTC',
    });
    const foreign = await createBusiness(prisma, { userId: outsider.id, categoryId });
    businessId = business.id;
    foreignBusinessId = foreign.id;
    for (let day = 0; day <= 6; day++) {
      await upsertSchedule(prisma, businessId, day, '08:00', '10:00');
    }
    serviceId = (await createService(prisma, businessId, { name: 'Corte', price: 120 })).id;
    await addStaff(prisma, businessId, staff.id);

    ownerToken = await loginToken(http, 'apt.owner@test.dev');
    staffToken = await loginToken(http, 'apt.staff@test.dev');
    outsiderToken = await loginToken(http, 'apt.outsider@test.dev');
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  const own = (token = ownerToken, id = businessId) => ({
    ...bearer(token),
    'X-Current-Business-Id': String(id),
  });

  describe('GET /api/appointments (#12)', () => {
    it('200 with the list for the owned business', async () => {
      const res = await request(http).get('/api/appointments').set(own()).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 { error: "Select a business" } without the header', async () => {
      const res = await request(http).get('/api/appointments').set(bearer(ownerToken)).expect(400);
      expect(res.body).toEqual({ error: 'Select a business' });
    });

    it('404 "Business not found" for a foreign business (IDOR)', async () => {
      const res = await request(http)
        .get('/api/appointments')
        .set(own(ownerToken, foreignBusinessId))
        .expect(404);
      expect(res.body).toEqual({ error: 'Business not found' });
    });

    it('422 for an invalid filter (ownership passes first)', async () => {
      const res = await request(http)
        .get('/api/appointments?filter=bogus')
        .set(own())
        .expect(422);
      expect(res.body.errors[0].path).toBe('filter');
    });
  });

  describe('GET /api/appointments/calendar-slots (#13)', () => {
    it('400 "Select a business" wins over validation (inline check first)', async () => {
      const res = await request(http)
        .get('/api/appointments/calendar-slots')
        .set(bearer(ownerToken))
        .expect(400);
      expect(res.body).toEqual({ error: 'Select a business' });
    });

    it('422 when start/end are missing but a business is selected', async () => {
      const res = await request(http)
        .get('/api/appointments/calendar-slots')
        .set(own())
        .expect(422);
      expect(res.body.errors.map((e: any) => e.path).sort()).toEqual(['end', 'start']);
    });

    it('200 with events and the Cache-Control header (R12)', async () => {
      const res = await request(http)
        .get('/api/appointments/calendar-slots?start=2099-08-01&end=2099-08-01')
        .set(own())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.headers['cache-control']).toBe(
        'no-store, no-cache, must-revalidate, max-age=0',
      );
    });
  });

  describe('POST /api/appointments (#14)', () => {
    const body = (over: Record<string, any> = {}) => ({
      date: '2099-09-01',
      start: '08:00',
      guest_name: 'Walk In',
      guest_email: 'walkin@example.com',
      service_ids: [serviceId],
      ...over,
    });

    it('201 persists userId:null, notifyByEmail:true, status confirmed', async () => {
      const res = await request(http)
        .post('/api/appointments')
        .set(own())
        .send(body())
        .expect(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          userId: null,
          status: 'confirmed',
          notifyByEmail: true,
          guestName: 'Walk In',
        }),
      );
    });

    it('D16 — two truly concurrent creates for the same slot yield one 201 and one 422, one row', async () => {
      const payload = body({
        date: '2099-10-10',
        start: '08:00',
        guest_email: 'd16.race@example.com',
      });
      const fire = () =>
        request(http).post('/api/appointments').set(own()).send(payload);

      // Dispatched in the same tick: without the atomic check-then-create (D16)
      // both used to return 201 and persist two rows.
      const [first, second] = await Promise.all([fire(), fire()]);

      // Pre-existing contract of POST /api/appointments for a taken slot is a
      // 422 (NOT the /reserve 409 slot_taken) — see the non-slot-start test.
      expect([first.status, second.status].sort()).toEqual([201, 422]);
      const loser = first.status === 422 ? first : second;
      const winner = first.status === 201 ? first : second;
      expect(loser.body).toEqual({ error: 'That time slot is not available' });

      const rows = await prisma.appointment.count({
        where: { businessId, startsAt: new Date(winner.body.startsAt) },
      });
      expect(rows).toBe(1);
    });

    it('422 for a malformed date', async () => {
      const res = await request(http)
        .post('/api/appointments')
        .set(own())
        .send(body({ date: '01-09-2099' }))
        .expect(422);
      expect(res.body.errors.map((e: any) => e.path)).toContain('date');
    });

    it('422 { error: "That time slot is not available" } for a non-slot start', async () => {
      const res = await request(http)
        .post('/api/appointments')
        .set(own())
        .send(body({ date: '2099-09-02', start: '03:00' }))
        .expect(422);
      expect(res.body).toEqual({ error: 'That time slot is not available' });
    });

    it('404 { error: "Service not found", missingIds } for an unknown service', async () => {
      const res = await request(http)
        .post('/api/appointments')
        .set(own())
        .send(body({ date: '2099-09-03', service_ids: [999999] }))
        .expect(404);
      expect(res.body).toEqual({ error: 'Service not found', missingIds: [999999] });
    });
  });

  describe('PUT /api/appointments/:id/reschedule (#15)', () => {
    it('200 reschedules into a free slot', async () => {
      const apt = await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-07-01T08:00:00.000Z'),
        endsAt: new Date('2099-07-01T08:30:00.000Z'),
      });
      const res = await request(http)
        .put(`/api/appointments/${apt.id}/reschedule`)
        .set(own())
        .send({ starts_at: '2099-07-02T09:00:00.000Z', ends_at: '2099-07-02T09:30:00.000Z' })
        .expect(200);
      expect(new Date(res.body.startsAt).toISOString()).toBe('2099-07-02T09:00:00.000Z');
    });

    it('404 { error: "Appointment not found" } for an unknown id', async () => {
      const res = await request(http)
        .put('/api/appointments/999999/reschedule')
        .set(own())
        .send({ starts_at: '2099-07-02T09:00:00.000Z', ends_at: '2099-07-02T09:30:00.000Z' })
        .expect(404);
      expect(res.body).toEqual({ error: 'Appointment not found' });
    });

    it('409 { error: "slot_taken" } when the target slot overlaps', async () => {
      const a = await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-07-10T08:00:00.000Z'),
        endsAt: new Date('2099-07-10T08:30:00.000Z'),
      });
      await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-07-10T09:00:00.000Z'),
        endsAt: new Date('2099-07-10T09:30:00.000Z'),
      });
      const res = await request(http)
        .put(`/api/appointments/${a.id}/reschedule`)
        .set(own())
        .send({ starts_at: '2099-07-10T09:00:00.000Z', ends_at: '2099-07-10T09:30:00.000Z' })
        .expect(409);
      expect(res.body).toEqual({ error: 'slot_taken' });
    });

    it('D17.1 — two concurrent reschedules to the same free slot: one 200, one 409, one row', async () => {
      const a = await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-12-01T08:00:00.000Z'),
        endsAt: new Date('2099-12-01T08:30:00.000Z'),
        guestEmail: 'd17.a@example.com',
      });
      const b = await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-12-02T08:00:00.000Z'),
        endsAt: new Date('2099-12-02T08:30:00.000Z'),
        guestEmail: 'd17.b@example.com',
      });
      const target = {
        starts_at: '2099-12-03T08:00:00.000Z',
        ends_at: '2099-12-03T08:30:00.000Z',
      };
      const fire = (id: number) =>
        request(http).put(`/api/appointments/${id}/reschedule`).set(own()).send(target);

      // Two DIFFERENT appointments race for one destination slot: pre-fix both
      // checks passed and both rows landed there (double booking).
      const [first, second] = await Promise.all([fire(a.id), fire(b.id)]);

      expect([first.status, second.status].sort()).toEqual([200, 409]);
      const loser = first.status === 409 ? first : second;
      expect(loser.body).toEqual({ error: 'slot_taken' });

      const rows = await prisma.appointment.count({
        where: { businessId, startsAt: new Date(target.starts_at) },
      });
      expect(rows).toBe(1);
    });

    it('D17.1 — a reschedule racing a public /reserve on the same slot: one winner, one 409, one row', async () => {
      const apt = await createAppointment(prisma, {
        businessId,
        startsAt: new Date('2099-12-04T08:00:00.000Z'),
        endsAt: new Date('2099-12-04T08:30:00.000Z'),
      });
      const target = {
        starts_at: '2099-12-05T08:00:00.000Z',
        ends_at: '2099-12-05T08:30:00.000Z',
      };
      const businessRow = await prisma.business.findUnique({ where: { id: businessId } });

      const [rescheduled, reserved] = await Promise.all([
        request(http)
          .put(`/api/appointments/${apt.id}/reschedule`)
          .set(own())
          .send(target),
        request(http)
          .post(`/api/booking/business/${businessRow!.slug}/reserve`)
          .send({
            ...target,
            guest_name: 'D17 Reserve Racer',
            guest_email: 'd17.reserve@example.com',
          }),
      ]);

      // Winner is either the reschedule (200) or the reservation (201); the
      // loser must get this codebase's shared taken-slot contract, 409.
      const statuses = [rescheduled.status, reserved.status].sort();
      expect(statuses[1]).toBe(409);
      expect([200, 201]).toContain(statuses[0]);
      const loser = rescheduled.status === 409 ? rescheduled : reserved;
      expect(loser.body).toEqual({ error: 'slot_taken' });

      const rows = await prisma.appointment.count({
        where: { businessId, startsAt: new Date(target.starts_at) },
      });
      expect(rows).toBe(1);
    });

    it('422 when starts_at is missing', async () => {
      const apt = await createAppointment(prisma, { businessId });
      const res = await request(http)
        .put(`/api/appointments/${apt.id}/reschedule`)
        .set(own())
        .send({ ends_at: '2099-07-02T09:30:00.000Z' })
        .expect(422);
      expect(res.body.errors.map((e: any) => e.path)).toContain('starts_at');
    });
  });

  describe('POST /api/appointments/:id/cancel (#16)', () => {
    it('200 sets status cancelled', async () => {
      const apt = await createAppointment(prisma, { businessId });
      const res = await request(http)
        .post(`/api/appointments/${apt.id}/cancel`)
        .set(own())
        .expect(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('404 for an unknown appointment', async () => {
      const res = await request(http)
        .post('/api/appointments/999999/cancel')
        .set(own())
        .expect(404);
      expect(res.body).toEqual({ error: 'Appointment not found' });
    });
  });

  describe('POST /api/appointments/:id/checkin (#17)', () => {
    it('200 confirmed → present and is idempotent', async () => {
      const apt = await createAppointment(prisma, { businessId });
      const first = await request(http)
        .post(`/api/appointments/${apt.id}/checkin`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(first.body.status).toBe('present');

      const second = await request(http)
        .post(`/api/appointments/${apt.id}/checkin`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(second.body.status).toBe('present');
    });

    it('400 { error: "Invalid status transition" } from cancelled', async () => {
      const apt = await createAppointment(prisma, { businessId, status: 'cancelled' });
      const res = await request(http)
        .post(`/api/appointments/${apt.id}/checkin`)
        .set(bearer(ownerToken))
        .expect(400);
      expect(res.body).toEqual({ error: 'Invalid status transition' });
    });

    it('staff of the business can check in (authorization)', async () => {
      const apt = await createAppointment(prisma, { businessId });
      await request(http)
        .post(`/api/appointments/${apt.id}/checkin`)
        .set(bearer(staffToken))
        .expect(200);
    });

    it('404 for a non-numeric id', async () => {
      const res = await request(http)
        .post('/api/appointments/abc/checkin')
        .set(bearer(ownerToken))
        .expect(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('POST /api/appointments/:id/no-show (#18)', () => {
    it('200 confirmed → no_show and is idempotent', async () => {
      const apt = await createAppointment(prisma, { businessId });
      const first = await request(http)
        .post(`/api/appointments/${apt.id}/no-show`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(first.body.status).toBe('no_show');

      const second = await request(http)
        .post(`/api/appointments/${apt.id}/no-show`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(second.body.status).toBe('no_show');
    });
  });

  describe('GET /api/appointments/:id (#19 — owner or staff, else 404)', () => {
    it('200 for the owner', async () => {
      const apt = await createAppointment(prisma, { businessId });
      await request(http)
        .get(`/api/appointments/${apt.id}`)
        .set(bearer(ownerToken))
        .expect(200);
    });

    it('200 for a staff member', async () => {
      const apt = await createAppointment(prisma, { businessId });
      await request(http)
        .get(`/api/appointments/${apt.id}`)
        .set(bearer(staffToken))
        .expect(200);
    });

    it('404 for an unrelated authenticated user (never 403)', async () => {
      const apt = await createAppointment(prisma, { businessId });
      const res = await request(http)
        .get(`/api/appointments/${apt.id}`)
        .set(bearer(outsiderToken))
        .expect(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });
});
