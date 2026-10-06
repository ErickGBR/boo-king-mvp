const mockCalendarEvents = {
  insert: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};
const mockOAuth2Client = {
  generateAuthUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?demo=1'),
  setCredentials: jest.fn(),
  getToken: jest.fn(),
};
const mockVerifyIdToken = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn(() => mockOAuth2Client) },
    calendar: jest.fn(() => ({ events: mockCalendarEvents })),
  },
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

import { GoogleService } from '../../src/modules/google/google.service';

/**
 * Unit contract for GoogleService (R9/R16). `googleapis` and `google-auth-library`
 * are mocked so no network is ever touched; Prisma is mocked for the wiring
 * methods. The "never throw" contract of the fire-and-forget helpers is asserted
 * explicitly.
 */
describe('GoogleService', () => {
  let prisma: any;
  let service: GoogleService;
  const ORIGINAL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4000/api/google/callback';

    prisma = {
      business: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      appointment: { findMany: jest.fn(), update: jest.fn() },
    };
    service = new GoogleService(prisma);
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
  });

  describe('verifyGoogleToken', () => {
    it('returns null when no client id is configured', async () => {
      process.env.GOOGLE_CLIENT_ID = '';
      await expect(service.verifyGoogleToken('t')).resolves.toBeNull();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('returns the payload on success', async () => {
      const payload = { email: 'a@b.com', email_verified: true };
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
      await expect(service.verifyGoogleToken('t')).resolves.toBe(payload);
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 't',
        audience: 'test-client-id',
      });
    });

    it('returns null and logs when verification throws', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockVerifyIdToken.mockRejectedValue(new Error('bad token'));
      await expect(service.verifyGoogleToken('t')).resolves.toBeNull();
    });
  });

  describe('OAuth2 helpers', () => {
    it('builds an authorization URL offline', () => {
      const url = service.getAuthUrl({ state: 'signed-state' });
      expect(url).toContain('accounts.google.com');
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ access_type: 'offline', prompt: 'consent', state: 'signed-state' }),
      );
    });

    it('exchanges an authorization code', async () => {
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: { id_token: 't' } });
      await expect(service.exchangeCode('abc', 'postmessage')).resolves.toEqual({
        id_token: 't',
      });
    });

    it('getOAuth2ClientForUser returns null when there is no refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: null });
      await expect(service.getOAuth2ClientForUser(1)).resolves.toBeNull();
    });

    it('getOAuth2ClientForUser returns a credentialed client', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'refresh-token' });
      const client = await service.getOAuth2ClientForUser(1);
      expect(client).toBe(mockOAuth2Client);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
    });
  });

  describe('calendar CRUD', () => {
    const args = {
      userId: 1,
      summary: 'S',
      start: '2099-01-05T08:00:00Z',
      end: '2099-01-05T08:30:00Z',
    };

    it('createCalendarEvent returns null when the user is not connected', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.createCalendarEvent(args)).resolves.toBeNull();
    });

    it('createCalendarEvent returns the created event id + link', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.insert.mockResolvedValue({
        data: { id: 'evt-1', htmlLink: 'https://cal/evt-1' },
      });
      await expect(service.createCalendarEvent(args)).resolves.toEqual({
        googleEventId: 'evt-1',
        htmlLink: 'https://cal/evt-1',
      });
    });

    it('updateCalendarEvent patches only the provided fields', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.patch.mockResolvedValue({ data: { id: 'evt-1', htmlLink: null } });
      await expect(
        service.updateCalendarEvent({ userId: 1, googleEventId: 'evt-1', summary: 'New' }),
      ).resolves.toEqual({ googleEventId: 'evt-1', htmlLink: null });
      expect(mockCalendarEvents.patch).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-1', requestBody: { summary: 'New' } }),
      );
    });

    it('deleteCalendarEvent treats a 404 as already deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.delete.mockRejectedValue({ status: 404 });
      await expect(
        service.deleteCalendarEvent({ userId: 1, googleEventId: 'evt-1' }),
      ).resolves.toEqual({ deleted: false });
    });

    it('deleteCalendarEvent rethrows non-404 errors', async () => {
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.delete.mockRejectedValue({ status: 500 });
      await expect(
        service.deleteCalendarEvent({ userId: 1, googleEventId: 'evt-1' }),
      ).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('appointment wiring (never throws)', () => {
    const appointment = {
      id: 1,
      businessId: 10,
      guestName: 'G',
      guestEmail: 'g@example.com',
      startsAt: new Date('2099-01-05T08:00:00Z'),
      endsAt: new Date('2099-01-05T08:30:00Z'),
      googleEventId: null,
    };

    it('syncAppointmentToGoogleCalendar is a no-op when the business is gone', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.syncAppointmentToGoogleCalendar(appointment)).resolves.toBeUndefined();
    });

    it('syncAppointmentToGoogleCalendar is a no-op when sync is disabled', async () => {
      prisma.business.findUnique.mockResolvedValue({ userId: 1, name: 'B', timezone: 'UTC' });
      prisma.user.findUnique.mockResolvedValue({ googleCalendarSync: false, googleRefreshToken: null });
      await expect(service.syncAppointmentToGoogleCalendar(appointment)).resolves.toBeUndefined();
      expect(mockCalendarEvents.insert).not.toHaveBeenCalled();
    });

    it('creates an event and stores its id', async () => {
      prisma.business.findUnique
        .mockResolvedValueOnce({ userId: 1, name: 'B', address: 'A', timezone: 'UTC' })
        .mockResolvedValueOnce({ userId: 1, name: 'B', address: 'A', timezone: 'UTC' });
      prisma.user.findUnique.mockResolvedValue({ googleCalendarSync: true, googleRefreshToken: 'r' });
      mockCalendarEvents.insert.mockResolvedValue({ data: { id: 'evt-9', htmlLink: null } });

      await service.syncAppointmentToGoogleCalendar(appointment);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { googleEventId: 'evt-9' },
      });
    });

    it('updates the event when one is already linked', async () => {
      prisma.business.findUnique.mockResolvedValue({ userId: 1, name: 'B', timezone: 'UTC' });
      prisma.user.findUnique.mockResolvedValue({ googleCalendarSync: true, googleRefreshToken: 'r' });
      mockCalendarEvents.patch.mockResolvedValue({ data: { id: 'evt-1', htmlLink: null } });

      await service.syncAppointmentToGoogleCalendar({ ...appointment, googleEventId: 'evt-1' });

      expect(mockCalendarEvents.patch).toHaveBeenCalled();
      expect(mockCalendarEvents.insert).not.toHaveBeenCalled();
    });

    it('swallows errors (never blocks the booking flow)', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      prisma.business.findUnique.mockRejectedValue(new Error('db down'));
      await expect(service.syncAppointmentToGoogleCalendar(appointment)).resolves.toBeUndefined();
    });

    it('deleteAppointmentGoogleEvent is a no-op without a linked event', async () => {
      await expect(
        service.deleteAppointmentGoogleEvent({ ...appointment, googleEventId: null }),
      ).resolves.toBeUndefined();
      expect(prisma.business.findUnique).not.toHaveBeenCalled();
    });

    it('deleteAppointmentGoogleEvent clears googleEventId after deletion', async () => {
      prisma.business.findUnique.mockResolvedValue({ userId: 1 });
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.delete.mockResolvedValue({ data: {} });

      await service.deleteAppointmentGoogleEvent({ ...appointment, googleEventId: 'evt-1' });

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { googleEventId: null },
      });
    });

    it('deleteAppointmentGoogleEvent swallows errors', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      prisma.business.findUnique.mockRejectedValue(new Error('boom'));
      await expect(
        service.deleteAppointmentGoogleEvent({ ...appointment, googleEventId: 'evt-1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('syncAllUpcomingAppointments', () => {
    it('returns [] when the user has no businesses', async () => {
      prisma.business.findMany.mockResolvedValue([]);
      await expect(service.syncAllUpcomingAppointments(1)).resolves.toEqual([]);
    });

    it('backfills upcoming confirmed appointments and returns their ids', async () => {
      prisma.business.findMany.mockResolvedValue([{ id: 10 }]);
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 1,
          businessId: 10,
          guestName: 'G',
          startsAt: new Date('2099-01-05T08:00:00Z'),
          endsAt: new Date('2099-01-05T08:30:00Z'),
          googleEventId: null,
        },
        {
          id: 2,
          businessId: 10,
          guestName: 'H',
          startsAt: new Date('2099-01-05T09:00:00Z'),
          endsAt: new Date('2099-01-05T09:30:00Z'),
          googleEventId: 'already',
        },
      ]);
      prisma.business.findUnique.mockResolvedValue({
        userId: 1,
        name: 'B',
        timezone: 'UTC',
      });
      prisma.user.findUnique.mockResolvedValue({ googleRefreshToken: 'r' });
      mockCalendarEvents.insert.mockResolvedValue({ data: { id: 'evt-1', htmlLink: null } });

      await expect(service.syncAllUpcomingAppointments(1)).resolves.toEqual([1]);
    });
  });
});
