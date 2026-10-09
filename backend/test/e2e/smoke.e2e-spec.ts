import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { resetLimiters } from '../helpers/rate-limit';

/**
 * Infrastructure smoke test — proves the test harness itself (app bootstrap,
 * throwaway DB, global path, error filter, unknown-route contract) before the
 * full 41-endpoint matrix exercises it.
 */
describe('Harness smoke (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    resetLimiters();
  });

  it('GET /api/health → 200 {ok:true}', async () => {
    const res = await request(http).get('/api/health').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /api/categories is public and returns the seeded catalog', async () => {
    const res = await request(http).get('/api/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((c: any) => c.slug)).toEqual(
      expect.arrayContaining(['test-barberia', 'test-spa', 'test-dental']),
    );
  });

  it('unknown /api/* → Nest JSON 404 (documented deviation §9.3)', async () => {
    const res = await request(http).get('/api/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    expect(res.body.message).toContain('Cannot GET /api/does-not-exist');
  });
});
