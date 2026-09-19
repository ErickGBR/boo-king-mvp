import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client. The Express code instantiated `new PrismaClient()`
 * 14 times (one per route/middleware/service file), each opening its own
 * connection pool. This service replaces all of them: same query semantics,
 * one connection pool (bug fix, no behavior change).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
