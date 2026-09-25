import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  All,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnershipGuard } from '../../common/guards/business-ownership.guard';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentBusiness } from '../../common/decorators/current-user.decorator';
import {
  createValidation,
  listValidation,
  rescheduleValidation,
} from './validation/appointment.validation';

/** `routes/appointments.js` → AppointmentsController (router.use bearer). */
@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  /**
   * #12 GET /api/appointments
   * Guard order mirrors Express (`validators` collect first, then
   * verifyBusinessOwnership responds, then the handler emits 422).
   */
  @Get()
  @UseGuards(BusinessOwnershipGuard, new ValidationGuard(listValidation))
  list(
    @CurrentBusiness() business: any,
    @Query('filter') filter?: string,
    @Query('q') q?: string,
  ) {
    return this.appointments.list(business, filter, q);
  }

  /** #13 GET /api/appointments/calendar-slots — declared BEFORE `:id`. */
  @Get('calendar-slots')
  async calendarSlots(
    @Req() req: Request,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const events = await this.appointments.calendarSlots(req, user.id);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return events;
  }

  /** #14 POST /api/appointments → 201 */
  @Post()
  @UseGuards(BusinessOwnershipGuard, new ValidationGuard(createValidation))
  create(@CurrentBusiness() business: any, @CurrentUser() user: any, @Body() body: any) {
    return this.appointments.create(business, user.id, body);
  }

  /** #15 PUT /api/appointments/:id/reschedule */
  @Put(':id/reschedule')
  @UseGuards(BusinessOwnershipGuard, new ValidationGuard(rescheduleValidation))
  reschedule(
    @CurrentBusiness() business: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.appointments.reschedule(business, id, body);
  }

  /** #16 POST /api/appointments/:id/cancel → 200 */
  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(BusinessOwnershipGuard)
  cancel(@CurrentBusiness() business: any, @Param('id') id: string) {
    return this.appointments.cancel(business, id);
  }

  /** #17 POST /api/appointments/:id/checkin → 200 */
  @Post(':id/checkin')
  @HttpCode(200)
  checkin(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointments.checkin(user.id, id);
  }

  /** #18 POST /api/appointments/:id/no-show → 200 */
  @Post(':id/no-show')
  @HttpCode(200)
  noShow(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointments.noShow(user.id, id);
  }

  /** #19 GET /api/appointments/:id */
  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointments.getById(user.id, id);
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/appointments/../businesses`)
   * still returned 401 for a missing/invalid token BEFORE the router-404. Nest
   * only applies controller guards to MATCHED routes; this terminal wildcard
   * restores that contract. With a valid token it 404s in the documented Nest
   * JSON shape (§8.3: Nest JSON 404 instead of the Express default HTML 404).
   */
  @All('*')
  @UseGuards(JwtAuthGuard)
  expressMountAuthFallback(@Req() req: Request): never {
    throw new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
  }
}
