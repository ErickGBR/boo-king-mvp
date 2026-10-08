import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import {
  resetDb,
  categoryIdBySlug,
  createUser,
  createBusiness,
  createService,
  DEFAULT_PASSWORD,
} from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for services endpoints #31–#34 (design doc §1.5).
 * Note #34 returns `{ success: true }` — NOT `{ ok: true }`.
 */
describe('Services API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: number;
  let foreignBusinessId: number;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    const categoryId = await categoryIdBySlug(prisma, 'test-spa');

    const owner = await createUser(prisma, { email: 'svc.owner@test.dev', name: 'Owner' });
    const other = await createUser(prisma, { email: 'svc.other@test.dev', name: 'Other' });
    const business = await createBusiness(prisma, { userId: owner.id, categoryId });
    const foreign = await createBusiness(prisma, { userId: other.id, categoryId });
    businessId = business.id;
    foreignBusinessId = foreign.id;

    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: 'svc.owner@test.dev', password: DEFAULT_PASSWORD });
    ownerToken = login.body.token;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  const auth = () => ({ ...bearer(ownerToken), 'X-Current-Business-Id': String(businessId) });

  it('GET 200 { services: [...] } (#31)', async () => {
    const res = await request(http).get('/api/services').set(auth()).expect(200);
    expect(res.body).toEqual({ services: expect.any(Array) });
  });

  it('GET 400 "Select a business" without the business header', async () => {
    const res = await request(http)
      .get('/api/services')
      .set(bearer(ownerToken))
      .expect(400);
    expect(res.body).toEqual({ error: 'Select a business' });
  });

  it('GET 404 "Business not found" for a foreign business (IDOR)', async () => {
    const res = await request(http)
      .get('/api/services')
      .set(bearer(ownerToken))
      .set('X-Current-Business-Id', String(foreignBusinessId))
      .expect(404);
    expect(res.body).toEqual({ error: 'Business not found' });
  });

  it('POST 201 creates a service (#32)', async () => {
    const res = await request(http)
      .post('/api/services')
      .set(auth())
      .send({ name: 'Corte premium', price: 250.5, durationMinutes: 45 })
      .expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({ id: expect.any(Number), name: 'Corte premium', price: 250.5, durationMinutes: 45, active: true }),
    );
  });

  it('POST 422 exposes the custom validation messages', async () => {
    const res = await request(http)
      .post('/api/services')
      .set(auth())
      .send({ name: '', price: -3, durationMinutes: 0 })
      .expect(422);
    const msgs = res.body.errors.map((e: any) => e.msg);
    expect(msgs).toEqual(
      expect.arrayContaining([
        'Name is required (1-100 chars)',
        'Price must be a number >= 0',
        'Duration must be an integer > 0',
      ]),
    );
  });

  it('PUT 200 updates an existing service (#33)', async () => {
    const created = await createService(prisma, businessId, { name: 'To Update', price: 100 });
    const res = await request(http)
      .put(`/api/services/${created.id}`)
      .set(auth())
      .send({ name: 'Updated', price: 999, active: false })
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ id: created.id, name: 'Updated', price: 999, active: false }),
    );
  });

  it('PUT 404 "Not found" for an unknown id', async () => {
    const res = await request(http)
      .put('/api/services/999999')
      .set(auth())
      .send({ name: 'X' })
      .expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('DELETE 200 { success: true } (#34 — not { ok:true })', async () => {
    const created = await createService(prisma, businessId, { name: 'To Delete' });
    const res = await request(http)
      .delete(`/api/services/${created.id}`)
      .set(auth())
      .expect(200);
    expect(res.body).toEqual({ success: true });
  });

  it('DELETE 404 "Not found" for an unknown id', async () => {
    const res = await request(http)
      .delete('/api/services/999999')
      .set(auth())
      .expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
