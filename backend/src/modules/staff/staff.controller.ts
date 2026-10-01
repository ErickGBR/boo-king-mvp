import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessOwnershipGuard } from '../../common/guards/business-ownership.guard';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import {
  createStaffValidation,
  removeStaffValidation,
} from './validation/staff.validation';

/**
 * `routes/staff.js` → StaffController (router.use bearer).
 * Guard order is part of the contract: `requireRole` runs BEFORE
 * `verifyBusinessOwnership` and before validation on POST/DELETE.
 */
@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  /** #28 GET /api/staff */
  @Get()
  @UseGuards(BusinessOwnershipGuard)
  list(@CurrentBusiness() business: any) {
    return this.staff.list(business);
  }

  /** #29 POST /api/staff → 201 */
  @Post()
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard, BusinessOwnershipGuard, new ValidationGuard(createStaffValidation))
  create(@CurrentBusiness() business: any, @CurrentUser() user: any, @Body() body: any) {
    return this.staff.create(business, user, body);
  }

  /**
   * #30 DELETE /api/staff/:id
   * Invalid `id` → 404 {error:'Not found'} (NOT 422) — replicated via the
   * ValidationGuard `onError` override.
   */
  @Delete(':id')
  @Roles('owner', 'admin')
  @UseGuards(
    RolesGuard,
    BusinessOwnershipGuard,
    new ValidationGuard(removeStaffValidation, {
      status: 404,
      body: () => ({ error: 'Not found' }),
    }),
  )
  remove(@CurrentBusiness() business: any, @Param('id') id: string) {
    return this.staff.remove(business, id);
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/staff/junk`) still returned 401
   * for a missing/invalid token BEFORE the router-404. Nest only applies
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
