import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnershipGuard } from '../../common/guards/business-ownership.guard';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import {
  createServiceValidation,
  updateServiceValidation,
} from './validation/service.validation';

/** `routes/services.js` → ServicesController (router.use bearer). */
@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  /** #31 GET /api/services */
  @Get()
  @UseGuards(BusinessOwnershipGuard)
  list(@CurrentBusiness() business: any) {
    return this.services.list(business);
  }

  /** #32 POST /api/services → 201 */
  @Post()
  @UseGuards(BusinessOwnershipGuard, new ValidationGuard(createServiceValidation))
  create(@CurrentBusiness() business: any, @Body() body: any) {
    return this.services.create(business, body);
  }

  /** #33 PUT /api/services/:id */
  @Put(':id')
  @UseGuards(BusinessOwnershipGuard, new ValidationGuard(updateServiceValidation))
  update(
    @CurrentBusiness() business: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.services.update(business, id, body);
  }

  /** #34 DELETE /api/services/:id → 200 {success:true} (NOT {ok:true}) */
  @Delete(':id')
  @UseGuards(BusinessOwnershipGuard)
  remove(@CurrentBusiness() business: any, @Param('id') id: string) {
    return this.services.remove(business, id);
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/services/junk`) still returned
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
