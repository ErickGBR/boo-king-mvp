import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** `routes/reports.js` → ReportsController (router.use bearer). */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** #27 GET /api/reports/summary */
  @Get('summary')
  summary(@Req() req: Request, @CurrentUser() user: any) {
    return this.reports.summary(req, user.id);
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/reports/junk`) still returned
   * 401 for a missing/invalid token BEFORE the router-404. Nest only applies
   * controller guards to MATCHED routes; this terminal wildcard restores that
   * contract. With a valid token it 404s in the documented Nest JSON shape
   * (§8.3: Nest JSON 404 instead of the Express default HTML 404).
   */
  @All('*')
  @UseGuards(JwtAuthGuard)
  expressMountAuthFallback(@Req() req: Request): never {
    throw new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
  }
}
