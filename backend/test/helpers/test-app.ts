import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import {
  authLimiter,
  authMeLimiter,
  bookingLimiter,
  passwordResetLimiter,
  ticketLimiter,
} from '../../src/middleware/rate-limit.middleware';

/**
 * Boots the REAL application graph exactly like `src/main.ts` — same middleware
 * chain order (`express.json` → cookieParser → rate limiters), same global
 * prefix, same terminal error filter — but WITHOUT `listen()`. Supertest drives
 * the returned HTTP server in-process.
 *
 * Keeping this a faithful copy of the bootstrap is the point: the e2e suite is
 * the API contract test for the 41 endpoints (docs/migration/stage2-nestjs-design.md §1).
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
  });

  // Same chain as main.ts: express.json() before the limiters, then cookieParser.
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth/me', authMeLimiter);
  app.use('/api/auth/forgot-password', passwordResetLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/tickets', ticketLimiter);
  app.use('/api/booking', bookingLimiter);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

/** Releases the DB connection then the app (keeps the shared SQLite file free). */
export async function closeTestApp(app: INestApplication): Promise<void> {
  try {
    await app.get(PrismaService).$disconnect();
  } catch {
    /* already disconnected */
  }
  await app.close();
}
