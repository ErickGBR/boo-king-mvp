import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingSlotsService } from './booking-slots.service';
import { MailerService } from '../mailer/mailer.service';
import { GoogleService } from '../google/google.service';
import { ApiError } from '../../common/errors/api-error';

/**
 * BookingService — handler bodies MOVED VERBATIM from `routes/booking.js`.
 * All endpoints are PUBLIC (no auth middleware in Express either).
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: BookingSlotsService,
    private readonly mailer: MailerService,
    private readonly google: GoogleService,
  ) {}

  /** #20 GET /api/booking/business/:slug */
  async businessBySlug(slug: string): Promise<any> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      include: { category: true, schedules: true },
    });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    const dates = await this.slots.getAvailableDates(business);

    // Include active services so the public booking page can load them in a
    // single request (avoids a second unauthenticated /services call).
    const services = await this.prisma.service.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });

    return {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        description: business.description,
        durationMinutes: business.durationMinutes,
        category: business.category,
        timezone: business.timezone,
        logoPath: business.logoPath,
        brandingFont: business.brandingFont,
        brandingHeaderBg: business.brandingHeaderBg,
        brandingHeaderText: business.brandingHeaderText,
      },
      services,
      dates,
    };
  }

  /** #21 GET /api/booking/business/:slug/services */
  async services(slug: string): Promise<any> {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    const services = await this.prisma.service.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    return { services };
  }

  /** #22 GET /api/booking/business/:slug/slots */
  async daySlots(slug: string, date?: string): Promise<any> {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    if (!date) throw new ApiError(422, { error: 'date required' });
    const slots = await this.slots.getAvailableSlots(business, date);
    return { slots };
  }

  /** #23 GET /api/booking/business/:slug/calendar-slots */
  async calendarSlots(slug: string, start?: string, end?: string): Promise<any> {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    if (!start || !end) throw new ApiError(422, { error: 'start and end required' });
    const events = await this.slots.getAvailableSlotsForRange(business, start, end);
    return events;
  }

  /** #24 POST /api/booking/business/:slug/reserve → 201 */
  async reserve(slug: string, body: any, userId?: number): Promise<any> {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    const startsAt = new Date(body.starts_at);
    const endsAt = new Date(body.ends_at);

    // D13 — atomic reservation. The original check-then-create was a TOCTOU
    // race: two concurrent requests both read "free" and both INSERTed. The
    // whole decision + write now runs in ONE interactive transaction. Prisma's
    // SQLite connector serializes concurrent writer transactions (verified
    // empirically: the second transaction blocks until the first commits and
    // then sees its row), so a competing reserve() gets the SAME 409
    // `slot_taken` body the sequential path returns. The overlap read MUST use
    // `tx` (not the pooled `this.prisma`), otherwise it would run outside the
    // transaction/lock and the race would remain.
    const appointment = await this.prisma.$transaction(async (tx) => {
      const available = await this.slots.isSlotAvailableForBusiness(
        business,
        startsAt,
        endsAt,
        undefined,
        tx,
      );
      if (!available) {
        throw new ApiError(409, { error: 'slot_taken' });
      }

      // Resolve services if service_ids provided (inside the transaction so the
      // 409-before-404 precedence of the original handler is preserved and the
      // snapshot matches what the availability check saw).
      let serviceSnapshots: any[] = [];
      const serviceIds = body.service_ids;
      if (serviceIds && serviceIds.length > 0) {
        const uniqueIds = [...new Set<number>(serviceIds.map(Number))];
        const services = await tx.service.findMany({
          where: { businessId: business.id, id: { in: uniqueIds }, active: true },
        });
        if (services.length !== uniqueIds.length) {
          const foundIds = new Set(services.map((s) => s.id));
          const missing = uniqueIds.filter((id) => !foundIds.has(id));
          throw new ApiError(404, { error: 'Service not found', missingIds: missing });
        }
        serviceSnapshots = services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          price: s.price,
        }));
      }

      return tx.appointment.create({
        data: {
          businessId: business.id,
          userId: userId ?? null,
          guestName: body.guest_name,
          guestEmail: body.guest_email,
          guestPhone: body.guest_phone || null,
          startsAt,
          endsAt,
          status: 'confirmed',
          notes: body.notes || null,
          notifyByEmail: body.notify_by_email !== false,
          ...(serviceSnapshots.length > 0
            ? {
                appointmentServices: {
                  create: serviceSnapshots.map((snap) => ({
                    serviceId: snap.serviceId,
                    name: snap.name,
                    price: snap.price,
                  })),
                },
              }
            : {}),
        },
        include: {
          business: { include: { category: true } },
          appointmentServices: { include: { service: true } },
        },
      });
    });
    this.mailer.sendConfirmationEmail(appointment, business).catch(console.error);
    // M2 — fire-and-forget sync; a slow/failing Google API never delays the response.
    this.google.syncAppointmentToGoogleCalendar(appointment).catch(console.error);
    return { appointment, success: true };
  }
}
