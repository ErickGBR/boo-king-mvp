import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BookingService } from './booking.service';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { reserveValidation } from './validation/booking.validation';

/**
 * `routes/booking.js` → BookingController.
 * NOTE: the Express booking router mounted NO auth middleware, so `req.user`
 * is always undefined here and `reserve` persists `userId: null`. We keep it
 * that way (no OptionalAuthGuard) to preserve behavior exactly.
 */
@Controller('booking')
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  /** #20 GET /api/booking/business/:slug */
  @Get('business/:slug')
  businessBySlug(@Param('slug') slug: string) {
    return this.booking.businessBySlug(slug);
  }

  /** #21 GET /api/booking/business/:slug/services */
  @Get('business/:slug/services')
  services(@Param('slug') slug: string) {
    return this.booking.services(slug);
  }

  /** #22 GET /api/booking/business/:slug/slots */
  @Get('business/:slug/slots')
  slots(@Param('slug') slug: string, @Query('date') date?: string) {
    return this.booking.daySlots(slug, date);
  }

  /** #23 GET /api/booking/business/:slug/calendar-slots */
  @Get('business/:slug/calendar-slots')
  async calendarSlots(
    @Param('slug') slug: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const events = await this.booking.calendarSlots(slug, start, end);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return events;
  }

  /** #24 POST /api/booking/business/:slug/reserve → 201 */
  @Post('business/:slug/reserve')
  @UseGuards(new ValidationGuard(reserveValidation))
  reserve(@Param('slug') slug: string, @Body() body: any, @Req() req: Request) {
    return this.booking.reserve(slug, body, (req as any).user?.id);
  }
}
