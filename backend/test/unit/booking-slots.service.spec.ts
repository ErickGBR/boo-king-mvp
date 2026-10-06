import { BookingSlotsService } from '../../src/modules/booking/booking-slots.service';

/**
 * Unit contract for the booking slot rules (moved verbatim from bookingSlots.js,
 * R13). A mocked PrismaService lets us pin the schedule window and the overlap
 * query without a database.
 */
describe('BookingSlotsService', () => {
  let prisma: any;
  let service: BookingSlotsService;

  beforeEach(() => {
    prisma = {
      businessSchedule: { findFirst: jest.fn() },
      appointment: { findFirst: jest.fn() },
    };
    service = new BookingSlotsService(prisma);
  });

  const business = { id: 1, timezone: 'UTC', durationMinutes: 30 };
  const FUTURE = '2099-01-05';

  describe('getAvailableSlots', () => {
    it('returns [] when the business has no schedule for the weekday', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue(null);

      await expect(service.getAvailableSlots(business, FUTURE)).resolves.toEqual([]);
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    it('generates every slot that fits inside the schedule window', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
      });
      prisma.appointment.findFirst.mockResolvedValue(null);

      const slots = await service.getAvailableSlots(business, FUTURE);

      // 08:00–10:00 with 30-minute slots → 08:00, 08:30, 09:00, 09:30.
      expect(slots.map((s) => s.start)).toEqual(['08:00', '08:30', '09:00', '09:30']);
      expect(slots.map((s) => s.end)).toEqual(['08:30', '09:00', '09:30', '10:00']);
      for (const slot of slots) {
        expect(slot.start_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(slot.end_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('honours the business duration when slicing the window', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
      });
      prisma.appointment.findFirst.mockResolvedValue(null);

      const slots = await service.getAvailableSlots(
        { ...business, durationMinutes: 60 },
        FUTURE,
      );
      expect(slots.map((s) => s.start)).toEqual(['08:00', '09:00']);
    });

    it('excludes a slot that overlaps a confirmed appointment', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
      });
      // First slot is taken, the rest are free.
      prisma.appointment.findFirst
        .mockResolvedValueOnce({ id: 42 })
        .mockResolvedValue(null);

      const slots = await service.getAvailableSlots(business, FUTURE);
      expect(slots.map((s) => s.start)).toEqual(['08:30', '09:00', '09:30']);
    });

    it('returns [] when every slot is blocked', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
      });
      prisma.appointment.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.getAvailableSlots(business, FUTURE)).resolves.toEqual([]);
    });

    it('never offers a slot in the past', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({
        startTime: '08:00',
        endTime: '10:00',
      });
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.getAvailableSlots(business, '2000-01-01')).resolves.toEqual([]);
    });
  });

  describe('getAvailableSlotsForRange', () => {
    it('wraps each day\'s slots into calendar events with sequential ids', async () => {
      const slot = {
        start: '08:00',
        end: '08:30',
        start_iso: '2099-01-05T08:00:00.000Z',
        end_iso: '2099-01-05T08:30:00.000Z',
      };
      jest.spyOn(service, 'getAvailableSlots').mockResolvedValue([slot]);

      const events = await service.getAvailableSlotsForRange(business, FUTURE, FUTURE);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: 'slot-1',
        title: 'Disponible',
        start: slot.start_iso,
        end: slot.end_iso,
        extendedProps: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), startTime: '08:00', endTime: '08:30' },
      });
    });
  });

  describe('getAvailableDates', () => {
    it('lists the next N days that have a schedule', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue({ startTime: '09:00' });

      const dates = await service.getAvailableDates(business, 3);

      expect(dates).toHaveLength(3);
      for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns [] when no day has a schedule', async () => {
      prisma.businessSchedule.findFirst.mockResolvedValue(null);
      await expect(service.getAvailableDates(business, 7)).resolves.toEqual([]);
    });
  });

  describe('isSlotAvailableForBusiness', () => {
    it('returns true when there is no overlap', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);
      const startsAt = new Date('2099-01-05T08:00:00Z');
      const endsAt = new Date('2099-01-05T08:30:00Z');

      await expect(
        service.isSlotAvailableForBusiness(business, startsAt, endsAt),
      ).resolves.toBe(true);

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          businessId: 1,
          status: { in: ['confirmed', 'pending'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
    });

    it('excludes the rescheduled appointment from the overlap check', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);
      await service.isSlotAvailableForBusiness(
        business,
        new Date('2099-01-05T08:00:00Z'),
        new Date('2099-01-05T08:30:00Z'),
        7,
      );
      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: { not: 7 } }),
      });
    });

    it('returns false when an appointment overlaps', async () => {
      prisma.appointment.findFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.isSlotAvailableForBusiness(
          business,
          new Date('2099-01-05T08:00:00Z'),
          new Date('2099-01-05T08:30:00Z'),
        ),
      ).resolves.toBe(false);
    });
  });
});
