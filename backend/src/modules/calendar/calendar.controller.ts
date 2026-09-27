import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** `routes/calendar.js` → CalendarController (router.use bearer). */
@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly prisma: PrismaService) {}

  /** #25 GET /api/calendar/events */
  @Get('events')
  async events(@CurrentUser() user: any) {
    const userId = user.id;
    const asClient = await this.prisma.appointment.findMany({
      where: { userId },
      include: { business: true },
    });
    const businessIds = (
      await this.prisma.business.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map((b) => b.id);
    const asOwner = await this.prisma.appointment.findMany({
      where: { businessId: { in: businessIds } },
      include: { business: true },
    });
    const seen = new Set<number>();
    const events: any[] = [];
    for (const a of [...asClient, ...asOwner]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.status !== 'confirmed' && a.status !== 'completed') continue;
      const isClient = a.userId === userId;
      const businessName = a.business?.name ?? '';
      const clientName = a.guestName || '';
      events.push({
        id: a.id,
        title:
          businessName +
          (isClient ? ' (cliente)' : clientName ? ': ' + clientName : ''),
        start: new Date(a.startsAt).toISOString(),
        end: new Date(a.endsAt).toISOString(),
        extendedProps: {
          businessName,
          clientName,
          role: isClient ? 'Cliente' : 'Dueño',
        },
      });
    }
    return events;
  }

  /**
   * MOUNT-AUTH FALLBACK — Express ran `router.use(authMiddleware)` on the whole
   * router, so an unmatched subpath (e.g. `/api/calendar/junk`) still returned
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
