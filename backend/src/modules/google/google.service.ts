import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GoogleService — MOVED VERBATIM from `src/services/google.js`.
 * Only change: the module-level `new PrismaClient()` → injected `PrismaService`.
 * `syncAppointmentToGoogleCalendar` / `deleteAppointmentGoogleEvent` keep their
 * "never throw" contract (a Google failure must not block the booking flow).
 */
@Injectable()
export class GoogleService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Google Login — verification of ID tokens (Google Identity Services)
  // -------------------------------------------------------------------------

  private get clientId(): string | undefined {
    return process.env.GOOGLE_CLIENT_ID;
  }

  private _client: OAuth2Client | undefined;

  private getClient(): OAuth2Client {
    if (!this._client) this._client = new OAuth2Client(this.clientId);
    return this._client;
  }

  /**
   * Verifies a Google ID token and returns its payload, or null on failure.
   * The audience is strictly bound to GOOGLE_CLIENT_ID: tokens minted for other
   * clients are rejected by the library. This is the ONLY entry point used to
   * trust a Google identity in the login flow.
   */
  async verifyGoogleToken(idToken: string): Promise<any | null> {
    if (!this.clientId) return null;
    try {
      const ticket = await this.getClient().verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      return ticket.getPayload();
    } catch (err) {
      console.error('Google token verification error:', err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Google Calendar — OAuth2 (offline access with refresh token)
  // -------------------------------------------------------------------------

  private get clientSecret(): string | undefined {
    return process.env.GOOGLE_CLIENT_SECRET;
  }

  private get callbackUrl(): string {
    return (
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/google/callback'
    );
  }

  private readonly CALENDAR_SCOPES = [
    // 'openid' is REQUIRED for the token endpoint to return an id_token in the
    // Calendar OAuth flow — the callback relies on it to verify the account.
    'openid',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'profile',
    'email',
  ];

  /** Builds a fresh OAuth2 client bound to the app credentials and callback URL. */
  getOAuth2Client(): any {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.callbackUrl);
  }

  /** Generates the Google OAuth2 authorization URL for Calendar access. */
  getAuthUrl({ state }: { state?: string } = {}): string {
    const oauth2 = this.getOAuth2Client();
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.CALENDAR_SCOPES,
      state,
    });
  }

  /** Exchanges an OAuth2 authorization code for tokens. */
  async exchangeCode(code: string, redirectUri?: string): Promise<any> {
    const oauth2 = redirectUri
      ? new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri)
      : this.getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    return tokens;
  }

  /** Returns an OAuth2 client with the user's stored refresh token, or null. */
  async getOAuth2ClientForUser(userId: number): Promise<any | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });
    if (!user?.googleRefreshToken) return null;
    const oauth2 = this.getOAuth2Client();
    oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
    return oauth2;
  }

  // -------------------------------------------------------------------------
  // Google Calendar — event CRUD (on the user's primary calendar)
  // -------------------------------------------------------------------------

  private toDateTime(value: string | Date): string {
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  }

  /** Creates a Google Calendar event on the user's primary calendar. */
  async createCalendarEvent({
    userId,
    summary,
    description,
    start,
    end,
    location,
    timeZone,
  }: {
    userId: number;
    summary: string;
    description?: string;
    start: string | Date;
    end: string | Date;
    location?: string;
    timeZone?: string;
  }): Promise<{ googleEventId: string; htmlLink: string | null } | null> {
    const oauth2 = await this.getOAuth2ClientForUser(userId);
    if (!oauth2) return null;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description: description || undefined,
        location: location || undefined,
        start: { dateTime: this.toDateTime(start), timeZone: timeZone || undefined },
        end: { dateTime: this.toDateTime(end), timeZone: timeZone || undefined },
      },
    });
    return { googleEventId: res.data.id, htmlLink: res.data.htmlLink || null };
  }

  /** Updates an existing Google Calendar event. */
  async updateCalendarEvent({
    userId,
    googleEventId,
    summary,
    description,
    start,
    end,
    location,
    timeZone,
  }: {
    userId: number;
    googleEventId: string;
    summary?: string;
    description?: string;
    start?: string | Date;
    end?: string | Date;
    location?: string;
    timeZone?: string;
  }): Promise<{ googleEventId: string; htmlLink: string | null } | null> {
    const oauth2 = await this.getOAuth2ClientForUser(userId);
    if (!oauth2) return null;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    const requestBody: any = {};
    if (summary !== undefined) requestBody.summary = summary;
    if (description !== undefined) requestBody.description = description;
    if (location !== undefined) requestBody.location = location;
    if (start !== undefined)
      requestBody.start = {
        dateTime: this.toDateTime(start),
        timeZone: timeZone || undefined,
      };
    if (end !== undefined)
      requestBody.end = {
        dateTime: this.toDateTime(end),
        timeZone: timeZone || undefined,
      };
    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody,
    });
    return { googleEventId: res.data.id, htmlLink: res.data.htmlLink || null };
  }

  /** Deletes a Google Calendar event (idempotent: a missing event is not an error). */
  async deleteCalendarEvent({
    userId,
    googleEventId,
  }: {
    userId: number;
    googleEventId: string;
  }): Promise<{ deleted: boolean } | null> {
    const oauth2 = await this.getOAuth2ClientForUser(userId);
    if (!oauth2) return null;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
      return { deleted: true };
    } catch (err: any) {
      // 404 means the event no longer exists — treat as already deleted.
      if (err?.status === 404 || err?.code === 404) return { deleted: false };
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Appointment ⇄ Google Calendar wiring (M2 — replaces the cosmetic toggle)
  // -------------------------------------------------------------------------

  private async findAppointmentOwner(businessId: number): Promise<any | null> {
    return this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        userId: true,
        name: true,
        address: true,
        meetingUrl: true,
        timezone: true,
      },
    });
  }

  private buildAppointmentEventPayload(appointment: any, business: any): any {
    return {
      userId: business.userId,
      summary: `${appointment.guestName} — ${business.name}`,
      description: [
        `Cliente: ${appointment.guestName}`,
        appointment.guestEmail ? `Email: ${appointment.guestEmail}` : null,
        appointment.guestPhone ? `Teléfono: ${appointment.guestPhone}` : null,
        appointment.notes ? `Notas: ${appointment.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      start: appointment.startsAt,
      end: appointment.endsAt,
      location: business.meetingUrl || business.address || undefined,
      timeZone: business.timezone,
    };
  }

  /**
   * Defensively synchronizes an appointment to the owner's Google Calendar.
   * NEVER throws: a Google failure must not block the local booking flow.
   */
  async syncAppointmentToGoogleCalendar(appointment: any): Promise<void> {
    try {
      const business = await this.findAppointmentOwner(appointment.businessId);
      if (!business) return;
      const user = await this.prisma.user.findUnique({
        where: { id: business.userId },
        select: { googleCalendarSync: true, googleRefreshToken: true },
      });
      if (!user?.googleCalendarSync || !user.googleRefreshToken) return;
      const payload = this.buildAppointmentEventPayload(appointment, business);
      if (appointment.googleEventId) {
        await this.updateCalendarEvent({
          userId: business.userId,
          googleEventId: appointment.googleEventId,
          ...payload,
        });
      } else {
        const created = await this.createCalendarEvent(payload);
        if (created?.googleEventId) {
          await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId: created.googleEventId },
          });
        }
      }
    } catch (err: any) {
      console.error(
        'Google calendar sync error (appointment id=%s):',
        appointment?.id,
        err?.message || err,
      );
    }
  }

  /** Defensively removes the Google Calendar event linked to an appointment. NEVER throws. */
  async deleteAppointmentGoogleEvent(appointment: any): Promise<void> {
    try {
      if (!appointment.googleEventId) return;
      const business = await this.findAppointmentOwner(appointment.businessId);
      if (!business) return;
      const result = await this.deleteCalendarEvent({
        userId: business.userId,
        googleEventId: appointment.googleEventId,
      });
      if (result) {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: null },
        });
      }
    } catch (err: any) {
      console.error(
        'Google calendar delete error (appointment id=%s):',
        appointment?.id,
        err?.message || err,
      );
    }
  }

  /** Backfills Google Calendar events for upcoming mirrored appointments. */
  async syncAllUpcomingAppointments(userId: number): Promise<number[]> {
    const businesses = await this.prisma.business.findMany({
      where: { userId },
      select: { id: true },
    });
    const businessIds = businesses.map((b) => b.id);
    if (!businessIds.length) return [];
    const upcoming = await this.prisma.appointment.findMany({
      where: {
        businessId: { in: businessIds },
        status: 'confirmed',
        startsAt: { gte: new Date() },
      },
    });
    const synced: number[] = [];
    for (const appointment of upcoming) {
      if (appointment.googleEventId) continue;
      try {
        const business = await this.findAppointmentOwner(appointment.businessId);
        if (!business) continue;
        const created = await this.createCalendarEvent(
          this.buildAppointmentEventPayload(appointment, business),
        );
        if (created?.googleEventId) {
          await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId: created.googleEventId },
          });
          synced.push(appointment.id);
        }
      } catch (err: any) {
        console.error(
          'Google backfill sync error (appointment id=%s):',
          appointment.id,
          err?.message || err,
        );
      }
    }
    return synced;
  }
}
