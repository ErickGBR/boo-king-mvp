import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { resetDb, categoryIdBySlug, createUser, DEFAULT_PASSWORD } from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { registerAndToken, bearer } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for businesses endpoints #7–#11 (design doc §1.2) including
 * slug generation/dedupe, validation shape and cross-user 404 (never 403).
 */
describe('Businesses API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  let categoryId: number;
  let ownerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    categoryId = await categoryIdBySlug(prisma, 'test-barberia');
    // Registered via prisma to keep the auth limiter quiet; login via API.
    await createUser(prisma, { email: 'biz.owner@test.dev', name: 'Owner' });
    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: 'biz.owner@test.dev', password: DEFAULT_PASSWORD });
    ownerToken = login.body.token;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  const validBusiness = (over: Record<string, any> = {}) => ({
    name: 'Bella Barbería',
    categoryId,
    durationMinutes: 30,
    timezone: 'America/Mexico_City',
    locationType: 'presencial',
    schedule: { 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' } },
    ...over,
  });

  it('401 on every route without a token (router.use auth)', async () => {
    await request(http).get('/api/businesses').expect(401);
    await request(http).post('/api/businesses').send(validBusiness()).expect(401);
    await request(http).get('/api/businesses/1').expect(401);
  });

  it('mount-auth fallback: unknown subpath without a token → 401', async () => {
    const res = await request(http).get('/api/businesses/junk/subpath').expect(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('POST 201 creates the business with a generated slug and schedule (#9)', async () => {
    const res = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Salón Aurora < 2026 >' }))
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({ id: expect.any(Number), name: 'Salón Aurora < 2026 >' }),
    );
    expect(res.body.slug).toBe('saln-aurora--2026-');
    expect(res.body.category).toBeTruthy();
  });

  it('POST dedupes slugs when the name collides', async () => {
    const first = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Same Name' }))
      .expect(201);
    const second = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Same Name' }))
      .expect(201);
    expect(second.body.slug).toBe(`${first.body.slug}-1`);
  });

  it('D17.2 — concurrent creates with the same name retry the suffix instead of 500ing', async () => {
    const name = 'Concurrent Same Name';
    const fire = () =>
      request(http).post('/api/businesses').set(bearer(ownerToken)).send(validBusiness({ name }));

    // Four INSERTs race for the same generated slug. Pre-fix the losers hit
    // Prisma P2002 on the unique index and surfaced as raw 500s.
    const results = await Promise.all(Array.from({ length: 4 }, fire));

    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    const slugs = results.map((r) => r.body.slug);
    expect(new Set(slugs).size).toBe(results.length);
    const rows = await prisma.business.findMany({ where: { name }, select: { slug: true } });
    expect(rows).toHaveLength(results.length);
  });

  it('POST 422 exposes the custom categoryId message', async () => {
    const res = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ categoryId: -5 }))
      .expect(422);
    expect(res.body.errors.map((e: any) => e.msg)).toContain('Invalid categoryId');
  });

  it('POST 422 rejects an out-of-range duration / location type', async () => {
    const res = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ durationMinutes: 7, locationType: 'hologram', timezone: '' }))
      .expect(422);
    expect(res.body.errors.map((e: any) => e.path).sort()).toEqual([
      'durationMinutes',
      'locationType',
      'timezone',
    ]);
  });

  it('POST 422 { error: "Category not found" } for an unknown category', async () => {
    const res = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ categoryId: 999999 }))
      .expect(422);
    expect(res.body).toEqual({ error: 'Category not found' });
  });

  it('GET list returns only the caller\'s businesses (#7)', async () => {
    const res = await request(http)
      .get('/api/businesses')
      .set(bearer(ownerToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const business of res.body) {
      expect(business.category).toBeTruthy();
    }
  });

  it('GET :id returns the business with category + schedules (#8)', async () => {
    const created = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Detail Biz' }))
      .expect(201);

    const res = await request(http)
      .get(`/api/businesses/${created.body.id}`)
      .set(bearer(ownerToken))
      .expect(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.category).toBeTruthy();
    expect(res.body.schedules.length).toBe(2);
  });

  it('GET :id 404 { error: "Not found" } for an unknown id', async () => {
    const res = await request(http)
      .get('/api/businesses/999999')
      .set(bearer(ownerToken))
      .expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('GET/PUT/DELETE a FOREIGN business → 404, never 403 (IDOR, R6)', async () => {
    const intruder = await registerAndToken(http, { email: 'intruder@test.dev', name: 'In' });
    const foreign = await prisma.business.create({
      data: {
        userId: intruder.user.id,
        categoryId,
        name: 'Foreign',
        slug: `foreign-${Date.now()}`,
        durationMinutes: 30,
        timezone: 'UTC',
      },
    });

    await request(http)
      .get(`/api/businesses/${foreign.id}`)
      .set(bearer(ownerToken))
      .expect(404);
    await request(http)
      .put(`/api/businesses/${foreign.id}`)
      .set(bearer(ownerToken))
      .send(validBusiness())
      .expect(404);
    await request(http)
      .delete(`/api/businesses/${foreign.id}`)
      .set(bearer(ownerToken))
      .expect(404);
  });

  it('PUT 200 updates fields and replaces the schedule (#10)', async () => {
    const created = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Update Me' }))
      .expect(201);

    const res = await request(http)
      .put(`/api/businesses/${created.body.id}`)
      .set(bearer(ownerToken))
      .send(
        validBusiness({
          name: 'Updated Name',
          locationType: 'online',
          schedule: { 3: { start: '10:00', end: '12:00' } },
        }),
      )
      .expect(200);

    expect(res.body.name).toBe('Updated Name');
    expect(res.body.locationType).toBe('online');
    expect(res.body.schedules).toHaveLength(1);
    expect(res.body.schedules[0].dayOfWeek).toBe(3);
  });

  it('PUT 422 when the param id is not a positive integer', async () => {
    const res = await request(http)
      .put('/api/businesses/abc')
      .set(bearer(ownerToken))
      .send(validBusiness())
      .expect(422);
    expect(res.body.errors.map((e: any) => e.location)).toContain('params');
  });

  it('DELETE 200 { ok: true } (#11)', async () => {
    const created = await request(http)
      .post('/api/businesses')
      .set(bearer(ownerToken))
      .send(validBusiness({ name: 'Delete Me' }))
      .expect(201);

    const res = await request(http)
      .delete(`/api/businesses/${created.body.id}`)
      .set(bearer(ownerToken))
      .expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});
