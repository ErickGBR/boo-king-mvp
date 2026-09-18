// Loads `.env` BEFORE any feature module is imported, exactly like the old
// Express entry (`import 'dotenv/config'` as the first line of src/index.js).
// Feature services read process.env at module scope (mailer templates, Google
// client config), so this import must stay first.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { getAllowedOrigins } from './config/configuration';
import {
  authLimiter,
  authMeLimiter,
  bookingLimiter,
  passwordResetLimiter,
  ticketLimiter,
} from './middleware/rate-limit.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The Express app mounted ONLY `express.json()` (no urlencoded parser) and
    // did so BEFORE the rate limiters. Nest registers its parsers at init(),
    // i.e. AFTER user middleware (limiters would see — and count — bodies that
    // fail to parse, and 400s would carry RateLimit-* headers; urlencoded
    // bodies would be parsed where the original stack saw them raw).
    // With `bodyParser: false` we mount express.json() ourselves in the exact
    // original chain position below.
    bodyParser: false,
  });

  // CORS — same `cors` semantics as Express (`origin: ALLOWED_ORIGINS`, credentials).
  app.enableCors({ origin: getAllowedOrigins(), credentials: true });

  // cookie-parser is not part of Nest: `req.cookies.token` and
  // `res.clearCookie('token')` require it, unchanged from Express.
  // NOTE the exact chain of `src/index.js` is restored here:
  //   cors → express.json() → cookieParser → rate limiters → router
  // `express.json()` (NOT urlencoded — the original never mounted one) parses
  // before the limiters, so a 400/413 from body-parser short-circuits without
  // consuming rate-limit quota or stamping RateLimit-* headers, byte-for-byte
  // like the Express stack.
  app.use(express.json());
  app.use(cookieParser());

  // Rate limiters mounted on the real Express instance in the same order as
  // `src/index.js` (auth → booking → tickets), before Nest's router.
  // D15: /api/auth/me (GET) is served by its own 300/15min bucket; authLimiter
  // skips it, so the 20/15min brute-force budget still covers every
  // login/register/Google/logout/PUT-me call.
  app.use('/api/auth/me', authMeLimiter);
  // Tighter credential-rotation budget, mounted BEFORE (in addition to) the
  // generic auth limiter: a single request counts against both buckets.
  app.use('/api/auth/forgot-password', passwordResetLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/tickets', ticketLimiter);
  app.use('/api/booking', bookingLimiter);

  // All controllers declare paths WITHOUT the prefix (e.g. @Controller('auth')).
  app.setGlobalPrefix('api');

  // Terminal error handling — replica of the Express error middleware.
  app.useGlobalFilters(new AllExceptionsFilter());

  // NOTE (Stage-2 decision 4): the backend no longer serves the frontend from
  // ./public. The API and the SPA are two separate services.
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://0.0.0.0:${port}`);
}

void bootstrap();
