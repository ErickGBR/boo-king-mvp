import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingSlotsService } from '../booking/booking-slots.service';
import { MailerService } from '../mailer/mailer.service';
import { GoogleService } from '../google/google.service';
import { ApiError } from '../../common/errors/api-error';
import { runValidation } from '../../common/validation/run-validation';
import { calendarSlotsValidation } from './validation/appointment.validation';

/** `getCurrentBusinessId` of `routes/appointments.js` (header ONLY). */
function getCurrentBusinessId(req: any): number | null {
  return req.headers['x-current-business-id']
    ? Number(req.headers['x-current-business-id'])
    : null;
}

/**
 * AppointmentsService — handler bodies MOVED VERBATIM from
 * `routes/appointments.js`. Guard order (ownership → validation) and the
 * inline business check of `calendar-slots` are preserved so the observable
 * status precedence is identical to Express.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: BookingSlotsService,
    private readonly mailer: MailerService,
    private readonly google: GoogleService,
  ) {}

  /** #12 GET /api/appointments */
  async list(business: any, filter?: string, q?: string): Promise<any> {
    const businessId = business.id;
    const effectiveFilter = filter || 'all';
    const effectiveQ = q || '';
    const where: any = { businessId };
    const now = new Date();
    if (effectiveFilter === 'today') {
      const today = now.toISOString().slice(0, 10);
      where.startsAt = {
        gte: new Date(today),
        lt: new Date(new Date(today).getTime() + 86400000),
      };
    } else if (effectiveFilter === 'upcoming') {
      where.startsAt = { gte: now };
    } else if (effectiveFilter === 'past') {
      where.startsAt = { lt: now };
    }
    if (effectiveQ && effectiveQ.length <= 100) {
      where.OR = [
        { guestName: { contains: effectiveQ } },
        { guestEmail: { contains: effectiveQ } },
        { guestPhone: { contains: effectiveQ } },
      ];
    }
    const orderDir = effectiveFilter === 'upcoming' ? 'asc' : 'desc';
    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: orderDir },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
      take: 20,
    });
    return appointments;
  }

  /** #13 GET /api/appointments/calendar-slots */
  async calendarSlots(req: any, userId: number): Promise<any[]> {
    const businessId = getCurrentBusinessId(req);
    // Express evaluated this inline check BEFORE validationResult → 400 wins.
    if (!businessId) throw new ApiError(400, { error: 'Select a business' });
    await runValidation(req, calendarSlotsValidation);
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, userId },
      include: { schedules: true },
    });
    if (!business) throw new ApiError(404, { error: 'Not found' });
    const events = await this.slots.getAvailableSlotsForRange(
      business,
      req.query.start,
      req.query.end,
    );
    return events;
  }

  /** #14 POST /api/appointments → 201 */
  async create(business: any, userId: number, body: any): Promise<any> {
    const dateStr = body.date;
    const startStr = body.start;

    // D16 — atomic appointment creation, same fix as D13 on the public reserve
    // endpoint. The original flow computed `getAvailableSlots()` (read) and then
    // INSERTed with no transaction, so two concurrent requests for one slot both
    // saw it free and both persisted. The slot computation, service validation
    // and INSERT now run in ONE interactive transaction, and every read uses
    // `tx` (the pooled `this.prisma` would read outside the lock). Because the
    // check is the SAME `getAvailableSlots` the handler always used, the loser
    // keeps the endpoint's pre-existing contract: 422
    // `{ error: 'That time slot is not available' }` (the /reserve endpoint's
    // 409 `slot_taken` is a different contract and is NOT reused here).
    const appointment = await this.prisma.$transaction(async (tx) => {
      const slots = await this.slots.getAvailableSlots(business, dateStr, tx);
      const chosen = slots.find((s: any) => s.start === startStr);
      if (!chosen) {
        throw new ApiError(422, { error: 'That time slot is not available' });
      }
      const startsAt = new Date(chosen.start_iso);
      const endsAt = new Date(chosen.end_iso);

      // Resolve services if service_ids provided (inside the transaction so the
      // error precedence 422-before-404 of the original handler is preserved).
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

      void userId;
      return tx.appointment.create({
        data: {
          businessId: business.id,
          userId: null,
          guestName: body.guest_name,
          guestEmail: body.guest_email,
          guestPhone: body.guest_phone || null,
          startsAt,
          endsAt,
          status: 'confirmed',
          notes: body.notes || null,
          notifyByEmail: true,
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
    // M2 — fire-and-forget sync; a slow/failing Google API never delays the response.
    this.google.syncAppointmentToGoogleCalendar(appointment).catch(console.error);
    return appointment;
  }

  /** #15 PUT /api/appointments/:id/reschedule */
  async reschedule(business: any, rawId: string, body: any): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(404, { error: 'Appointment not found' });
    }
    const startsAt = new Date(body.starts_at);
    const endsAt = new Date(body.ends_at);

    // D17.1 — atomic reschedule. The original flow read the appointment, then
    // checked the target slot through the POOLED client, then UPDATE'd: two
    // concurrent reschedules (or a reschedule racing reserve/create) could both
    // observe the slot as free and both occupy it. Ownership lookup, target-slot
    // overlap check and the UPDATE now run in ONE interactive transaction and
    // every read uses `tx` (a pooled read would sit outside the SQLite write
    // lock). Contract unchanged: loser gets 409 `{ error: 'slot_taken' }`.
    const { updated, fullBusiness } = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id, businessId: business.id },
        include: { business: true },
      });
      if (!appointment) throw new ApiError(404, { error: 'Appointment not found' });

      const fullBusiness = await tx.business.findUnique({
        where: { id: business.id },
        include: { schedules: true },
      });
      const available = await this.slots.isSlotAvailableForBusiness(
        fullBusiness,
        startsAt,
        endsAt,
        id,
        tx,
      );
      if (!available) {
        throw new ApiError(409, { error: 'slot_taken' });
      }

      const updated = await tx.appointment.update({
        where: { id },
        data: { startsAt, endsAt },
        include: { business: { include: { category: true } } },
      });
      return { updated, fullBusiness };
    });
    this.mailer.sendRescheduleEmail(updated, fullBusiness).catch(console.error);
    // M2 — keep the mirrored Google Calendar event in sync on reschedule.
    this.google.syncAppointmentToGoogleCalendar(updated).catch(console.error);
    return updated;
  }

  /** #16 POST /api/appointments/:id/cancel → 200 */
  async cancel(business: any, rawId: string): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(404, { error: 'Appointment not found' });
    }
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, businessId: business.id },
    });
    if (!appointment) throw new ApiError(404, { error: 'Appointment not found' });
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { business: { include: { category: true } } },
    });
    this.google.deleteAppointmentGoogleEvent(updated).catch(console.error);
    return updated;
  }

  /**
   * Authorize a request as either the business owner or a staff member.
   * Returns the appointment with business included, or null if not found / not
   * authorized (caller should respond 404). MOVED VERBATIM.
   */
  private async findAppointmentForStaffOrOwner(
    appointmentId: number,
    userId: number,
  ): Promise<any> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId },
      include: { business: true },
    });
    if (!appointment) return null;

    // Owner?
    if (appointment.business.userId === userId) return appointment;

    // Staff?
    const staff = await this.prisma.businessStaff.findFirst({
      where: { businessId: appointment.businessId, userId },
    });
    return staff ? appointment : null;
  }

  /** #17 POST /api/appointments/:id/checkin → 200 */
  async checkin(userId: number, rawId: string): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, { error: 'Not found' });

    const appointment = await this.findAppointmentForStaffOrOwner(id, userId);
    if (!appointment) throw new ApiError(404, { error: 'Not found' });

    // Only confirmed → present is allowed. Idempotent if already present.
    if (appointment.status === 'present') {
      return this.prisma.appointment.findFirst({
        where: { id },
        include: {
          business: { include: { category: true } },
          appointmentServices: { include: { service: true } },
        },
      });
    }
    if (appointment.status !== 'confirmed') {
      throw new ApiError(400, { error: 'Invalid status transition' });
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'present' },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
  }

  /** #18 POST /api/appointments/:id/no-show → 200 */
  async noShow(userId: number, rawId: string): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, { error: 'Not found' });

    const appointment = await this.findAppointmentForStaffOrOwner(id, userId);
    if (!appointment) throw new ApiError(404, { error: 'Not found' });

    // Only confirmed → no_show is allowed. Idempotent if already no_show.
    if (appointment.status === 'no_show') {
      return this.prisma.appointment.findFirst({
        where: { id },
        include: {
          business: { include: { category: true } },
          appointmentServices: { include: { service: true } },
        },
      });
    }
    if (appointment.status !== 'confirmed') {
      throw new ApiError(400, { error: 'Invalid status transition' });
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'no_show' },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
  }

  /** #19 GET /api/appointments/:id — owner OR staff, 404 otherwise. */
  async getById(userId: number, rawId: string): Promise<any> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, { error: 'Not found' });

    const appointment = await this.prisma.appointment.findFirst({
      where: { id },
      include: {
        business: { include: { category: true } },
        appointmentServices: { include: { service: true } },
      },
    });
    if (!appointment) throw new ApiError(404, { error: 'Not found' });

    // Owner?
    if (appointment.business.userId === userId) return appointment;

    // Staff?
    const staff = await this.prisma.businessStaff.findFirst({
      where: { businessId: appointment.businessId, userId },
    });
    if (!staff) throw new ApiError(404, { error: 'Not found' });

    return appointment;
  }
}
