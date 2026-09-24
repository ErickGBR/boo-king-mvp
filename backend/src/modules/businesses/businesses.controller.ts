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
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  createBusinessValidation,
  updateBusinessValidation,
} from './validation/business.validation';

/** `routes/businesses.js` → BusinessesController (router.use bearer). */
@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** #7 GET /api/businesses */
  @Get()
  list(@CurrentUser() user: any) {
    return this.businesses.list(user.id);
  }

  /** #8 GET /api/businesses/:id */
  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.businesses.get(user.id, id);
  }

  /** #9 POST /api/businesses → 201 */
  @Post()
  @UseGuards(new ValidationGuard(createBusinessValidation))
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.businesses.create(user.id, body);
  }

  /** #10 PUT /api/businesses/:id */
  @Put(':id')
  @UseGuards(new ValidationGuard(updateBusinessValidation))
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.businesses.update(user.id, id, body);
  }

  /** #11 DELETE /api/businesses/:id */
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.businesses.remove(user.id, id);
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/businesses/junk`) still returned
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
