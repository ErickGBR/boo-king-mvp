import { ReportsService } from '../../src/modules/reports/reports.service';

/**
 * Unit contract for reports aggregation (R27). The service computes summary
 * counters, a 30-day `byDay` series and an optional date-range breakdown with
 * income and per-service totals — all pinned here with a mocked PrismaService.
 */
describe('ReportsService', () => {
  let prisma: any;
  let service: ReportsService;

  const req = (over: Record<string, any> = {}) => ({
    headers: { 'x-current-business-id': '1' },
    query: {},
    ...over,
  });

  const last30Fixtures = [
    { startsAt: new Date(), status: 'confirmed' },
    { startsAt: new Date(), status: 'cancelled' },
  ];

  beforeEach(() => {
    prisma = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 1, userId: 1 }) },
      appointment: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new ReportsService(prisma);

    prisma.appointment.count
      .mockResolvedValueOnce(2) // today
      .mockResolvedValueOnce(5) // last 7 days
      .mockResolvedValueOnce(9); // last 30 days
    prisma.appointment.groupBy.mockResolvedValue([
      { status: 'confirmed', _count: { id: 4 } },
      { status: 'cancelled', _count: { id: 1 } },
    ]);
    prisma.appointment.findMany.mockImplementation(async (args: any) =>
      args.select ? last30Fixtures : [],
    );
  });

  describe('business id + ownership guards', () => {
    it('400 when no business id is provided', async () => {
      const error = await service
        .summary(req({ headers: {} }), 1)
        .catch((e) => e);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({ error: 'Select a business' });
    });

    it.each(['abc', '0', '-3', '1.5'])('400 for an invalid business id %s', async (id) => {
      const error = await service
        .summary(req({ headers: { 'x-current-business-id': id } }), 1)
        .catch((e) => e);
      expect(error.getStatus()).toBe(400);
    });

    it('404 when the business does not belong to the user', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      const error = await service.summary(req(), 1).catch((e) => e);
      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toEqual({ error: 'Not found' });
    });
  });

  describe('summary', () => {
    it('returns summary counters and a status breakdown with zero defaults', async () => {
      const result = await service.summary(req(), 1);

      expect(result.summary).toEqual({ today: 2, last7Days: 5, last30Days: 9 });
      expect(result.byStatus).toEqual({
        confirmed: 4,
        cancelled: 1,
        completed: 0,
        no_show: 0,
      });
    });

    it('builds a 30-entry ascending byDay series with per-status counts', async () => {
      const result = await service.summary(req(), 1);

      expect(result.byDay).toHaveLength(30);
      const dates = result.byDay.map((d: any) => d.date);
      expect([...dates]).toEqual([...dates].sort());
      expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const today = new Date().toISOString().slice(0, 10);
      const todayRow = result.byDay.find((d: any) => d.date === today);
      expect(todayRow).toMatchObject({ total: 2, confirmed: 1, cancelled: 1 });
    });

    it('has no `range` key when no range query is supplied', async () => {
      const result = await service.summary(req(), 1);
      expect(result.range).toBeUndefined();
    });
  });

  describe('range query', () => {
    it('400 "Invalid date range" for a malformed date', async () => {
      const error = await service
        .summary(req({ query: { start: 'not-a-date' } }), 1)
        .catch((e) => e);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({ error: 'Invalid date range' });
    });

    it('400 "Range too large (max 366 days)" for spans wider than a year', async () => {
      const error = await service
        .summary(req({ query: { start: '2026-01-01', end: '2028-01-01' } }), 1)
        .catch((e) => e);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        error: 'Range too large (max 366 days)',
      });
    });

    it('aggregates totals, income and by-service for a valid range', async () => {
      prisma.appointment.findMany.mockImplementation(async (args: any) =>
        args.select
          ? last30Fixtures
          : [
              {
                status: 'completed',
                appointmentServices: [
                  { name: 'Corte', price: 100 },
                  { name: 'Barba', price: 50 },
                ],
              },
              { status: 'cancelled', appointmentServices: [{ name: 'Corte', price: 100 }] },
              { status: 'no_show', appointmentServices: [] },
              { status: 'present', appointmentServices: [{ name: 'Barba', price: 50 }] },
            ],
      );

      const result = await service.summary(
        req({ query: { start: '2026-03-01', end: '2026-03-31' } }),
        1,
      );

      expect(result.range).toMatchObject({
        start: '2026-03-01',
        end: '2026-03-31',
        total: 4,
        completed: 1,
        cancelled: 1,
        noShow: 1,
        present: 1,
        totalIncome: 200,
      });
      // 200 / 3 non-cancelled appointments, rounded to 2 decimals.
      expect(result.range.avgIncome).toBe(66.67);
      expect(result.range.byService).toEqual(
        expect.arrayContaining([
          { name: 'Corte', count: 1, income: 100 },
          { name: 'Barba', count: 2, income: 100 },
        ]),
      );
    });

    it('treats a start-only query as a single day', async () => {
      prisma.appointment.findMany.mockImplementation(async (args: any) =>
        args.select ? last30Fixtures : [],
      );

      const result = await service.summary(
        req({ query: { start: '2026-03-01' } }),
        1,
      );

      expect(result.range.start).toBe('2026-03-01');
      expect(result.range.end).toBe('2026-03-01');
    });
  });
});
