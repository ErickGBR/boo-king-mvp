import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { resetDb } from '../helpers/db';
import { resetLimiters } from '../helpers/rate-limit';
import { bearer, registerAndToken } from '../helpers/api';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GoogleService } from '../../src/modules/google/google.service';
import { ReportsService } from '../../src/modules/reports/reports.service';

/**
 * Regression guard for the ONLY production change of the Jest wave
 * (`src/common/filters/all-exceptions.filter.ts`):
 *
 *   if (status >= 500 && !(exception instanceof ApiError)) body = generic
 *
 * Express's terminal error middleware genericized every 5xx that REACHED it
 * (`{ error: 'Internal server error' }`), but the handlers that answered 5xx
 * explicitly (`res.status(500).json({ error: 'Could not …' })` in
 * `routes/google.js`) never reached it, so their body was emitted verbatim.
 * The filter must reproduce both halves over real HTTP — this file pins them at
 * the transport level, complementing the isolated unit test.
 */
describe('Explicit 5xx bodies (e2e, Express parity)', () => {
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

  it("GET /api/google/auth keeps the handler's explicit 500 body verbatim", async () => {
    const { token } = await registerAndToken(http, { email: 'fivexx-google@example.com' });
    const google = app.get(GoogleService);
    const spy = jest.spyOn(google, 'getAuthUrl').mockImplementation(() => {
      throw new Error('google credentials missing');
    });

    const res = await request(http).get('/api/google/auth').set(bearer(token)).expect(500);

    // Gemelo del `res.status(500).json({error:'Could not generate Google auth URL'})`
    // de `routes/google.js` (que en Express NUNCA pasó por el error middleware).
    expect(res.body).toEqual({ error: 'Could not generate Google auth URL' });
    spy.mockRestore();
  });

  it('a plain Error escaping a handler still degrades to the generic 500 body', async () => {
    const { token } = await registerAndToken(http, { email: 'fivexx-generic@example.com' });
    const reports = app.get(ReportsService);
    const spy = jest.spyOn(reports, 'summary').mockImplementation(() => {
      throw new Error('secret connection string leaked here');
    });

    const res = await request(http)
      .get('/api/reports/summary')
      .set({ ...bearer(token), 'X-Current-Business-Id': '1' })
      .expect(500);

    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    spy.mockRestore();
  });
});
