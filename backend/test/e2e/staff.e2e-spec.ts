import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import {
  resetDb,
  categoryIdBySlug,
  createUser,
  createBusiness,
  DEFAULT_PASSWORD,
} from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer, loginToken } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Contract tests for staff endpoints #28–#30 (design doc §1.5, R7). The guard
 * ORDER is part of the contract: `requireRole` → `verifyBusinessOwnership` →
 * validation, so a role failure always wins over a missing/foreign business.
 */
describe('Staff API (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let prisma: PrismaService;
  let businessId: number;
  let adminBusinessId: number;
  let ownerToken: string;
  let adminToken: string;
  let staffToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    const categoryId = await categoryIdBySlug(prisma, 'test-barberia');

    const owner = await createUser(prisma, { email: 'staff.owner@test.dev', role: 'owner' });
    const admin = await createUser(prisma, { email: 'staff.admin@test.dev', role: 'admin' });
    await createUser(prisma, { email: 'staff.plain@test.dev', role: 'staff' });
    await createUser(prisma, { email: 'staff.invitee@test.dev', role: 'owner' });
    const business = await createBusiness(prisma, { userId: owner.id, categoryId });
    const adminBusiness = await createBusiness(prisma, { userId: admin.id, categoryId });
    businessId = business.id;
    adminBusinessId = adminBusiness.id;

    ownerToken = await loginToken(http, 'staff.owner@test.dev');
    adminToken = await loginToken(http, 'staff.admin@test.dev');
    staffToken = await loginToken(http, 'staff.plain@test.dev');
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  const ownHeader = (token: string) => ({
    ...bearer(token),
    'X-Current-Business-Id': String(businessId),
  });

  it('GET 200 lists the staff of the business (#28)', async () => {
    const res = await request(http)
      .get('/api/staff')
      .set(ownHeader(ownerToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET 400 "Select a business" without the header', async () => {
    const res = await request(http)
      .get('/api/staff')
      .set(bearer(ownerToken))
      .expect(400);
    expect(res.body).toEqual({ error: 'Select a business' });
  });

  it('POST 201 adds a member (#29)', async () => {
    const res = await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'staff.invitee@test.dev', role: 'staff' })
      .expect(201);
    expect(res.body.user).toEqual(
      expect.objectContaining({ email: 'staff.invitee@test.dev' }),
    );
  });

  it('POST 409 { error: "Already a member" } on a duplicate invite', async () => {
    await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'staff.admin@test.dev' })
      .expect(201);
    const res = await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'staff.admin@test.dev' })
      .expect(409);
    expect(res.body).toEqual({ error: 'Already a member' });
  });

  it('POST 404 { error: "User not found" } for an unknown email', async () => {
    const res = await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'nobody@nowhere.dev' })
      .expect(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  it('POST 422 for an invalid email', async () => {
    const res = await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'not-an-email' })
      .expect(422);
    expect(res.body.errors[0].path).toBe('email');
  });

  it('POST 403 Forbidden when the caller role is not owner/admin (R7 order)', async () => {
    // Role check runs BEFORE ownership/validation: even a forged business id
    // returns 403, never 404.
    const res = await request(http)
      .post('/api/staff')
      .set(bearer(staffToken))
      .set('X-Current-Business-Id', String(businessId))
      .send({ email: 'staff.invitee@test.dev' })
      .expect(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('POST 403 "Only owners can assign the owner role" for a business-owning admin', async () => {
    const res = await request(http)
      .post('/api/staff')
      .set(bearer(adminToken))
      .set('X-Current-Business-Id', String(adminBusinessId))
      .send({ email: 'staff.invitee@test.dev', role: 'owner' })
      .expect(403);
    expect(res.body).toEqual({ error: 'Only owners can assign the owner role' });
  });

  it('DELETE 200 { ok: true } (#30)', async () => {
    const created = await request(http)
      .post('/api/staff')
      .set(ownHeader(ownerToken))
      .send({ email: 'staff.plain@test.dev' })
      .expect(201);

    const res = await request(http)
      .delete(`/api/staff/${created.body.id}`)
      .set(ownHeader(ownerToken))
      .expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('DELETE invalid id → 404 { error: "Not found" } (onError override, not 422)', async () => {
    const res = await request(http)
      .delete('/api/staff/not-a-number')
      .set(ownHeader(ownerToken))
      .expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
