import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { ApiError } from '../../common/errors/api-error';

/**
 * `routes/tickets.js` → TicketsController (limiter `/api/tickets` 30/60s).
 * `optionalAuth`: a missing OR invalid token never 401s — the request
 * continues as anonymous (private guest fields are only added for the business
 * owner or a BusinessStaff member).
 */
@Controller('tickets')
export class TicketsController {
  constructor(private readonly prisma: PrismaService) {}

  /** #40 GET /api/tickets/:id */
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async get(@Param('id') rawId: string, @Req() req: Request) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(404, { error: 'Not found' });
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!appointment) {
      throw new ApiError(404, { error: 'Not found' });
    }

    // Public layer — always returned, never exposes guest personal data
    const publicAppointment: any = {
      id: appointment.id,
      ticketNumber: 'BK-' + String(appointment.id).padStart(6, '0'),
      status: appointment.status,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      business: {
        id: appointment.business.id,
        name: appointment.business.name,
        address: appointment.business.address,
        locationType: appointment.business.locationType,
        durationMinutes: appointment.business.durationMinutes,
        timezone: appointment.business.timezone,
      },
    };

    let canCheckIn = false;

    // Private layer — only if authenticated AND is owner or staff of the business
    const user = (req as any).user;
    if (user) {
      const isOwner = appointment.business.userId === user.id;
      if (isOwner) {
        canCheckIn = true;
      } else {
        const staffMember = await this.prisma.businessStaff.findUnique({
          where: {
            businessId_userId: {
              businessId: appointment.business.id,
              userId: user.id,
            },
          },
        });
        if (staffMember) {
          canCheckIn = true;
        }
      }

      if (canCheckIn) {
        publicAppointment.guestName = appointment.guestName;
        publicAppointment.guestEmail = appointment.guestEmail;
        publicAppointment.guestPhone = appointment.guestPhone;
        publicAppointment.notes = appointment.notes;
      }
    }

    return { appointment: publicAppointment, canCheckIn };
  }
}
