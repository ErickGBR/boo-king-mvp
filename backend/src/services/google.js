import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Google Login — verification of ID tokens (Google Identity Services)
// ---------------------------------------------------------------------------

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let _client;
function getClient() {
  if (!_client) _client = new OAuth2Client(CLIENT_ID);
  return _client;
}

/**
 * Verifies a Google ID token and returns its payload, or null on failure.
 * The audience is strictly bound to GOOGLE_CLIENT_ID: tokens minted for other
 * clients are rejected by the library. This is the ONLY entry point used to
 * trust a Google identity in the login flow (the insecure tokeninfo fallback
 * `verifyGoogleAccessToken` was removed — see C1).
 * @param {string} idToken - Google ID token (JWT from Google Identity Services)
 * @returns {Promise<object|null>} decoded payload or null
 */
export async function verifyGoogleToken(idToken) {
  if (!CLIENT_ID) return null;
  try {
    const ticket = await getClient().verifyIdToken({ idToken, audience: CLIENT_ID });
    return ticket.getPayload();
  } catch (err) {
    console.error('Google token verification error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google Calendar — OAuth2 (offline access with refresh token)
// ---------------------------------------------------------------------------

const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/google/callback';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'profile',
  'email',
];

/**
 * Builds a fresh OAuth2 client bound to the app credentials and callback URL.
 * @returns {import('googleapis').Auth.OAuth2Client} OAuth2 client
 */
export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, CALLBACK_URL);
}

/**
 * Generates the Google OAuth2 authorization URL for Calendar access.
 * @param {{ state?: string }} [options] - optional OAuth state to round-trip
 *   through the authorization request (CSRF protection, see C2/M1)
 * @returns {string} authorization URL
 */
export function getAuthUrl({ state } = {}) {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
    state,
  });
}

/**
 * Exchanges an OAuth2 authorization code for tokens.
 * @param {string} code - authorization code from the callback query string
 * @param {string} [redirectUri] - redirect URI that was used when the code was
 *   issued. Defaults to the app CALLBACK_URL (calendar flow). Pass
 *   'postmessage' for Google Identity Services codes exchanged server-side
 *   (login flow, see C1).
 * @returns {Promise<object>} token set ({ access_token, refresh_token, id_token, ... })
 */
export async function exchangeCode(code, redirectUri) {
  const oauth2 = redirectUri
    ? new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri)
    : getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

/**
 * Returns an OAuth2 client with the user's stored refresh token, or null when
 * the user has not connected their Google account.
 * @param {number} userId - user id
 * @returns {Promise<import('googleapis').Auth.OAuth2Client|null>} authorized client or null
 */
export async function getOAuth2ClientForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });
  if (!user?.googleRefreshToken) return null;
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  return oauth2;
}

// ---------------------------------------------------------------------------
// Google Calendar — event CRUD (on the user's primary calendar)
// ---------------------------------------------------------------------------

/**
 * Normalizes a start/end value into the dateTime string used by the Calendar API.
 * @param {string|Date} value - ISO string or Date instance
 * @returns {string} ISO dateTime string
 */
function toDateTime(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

/**
 * Creates a Google Calendar event on the user's primary calendar.
 * Returns null when the user has not connected their Google account.
 * @param {{ userId: number, summary: string, description?: string, start: string|Date, end: string|Date, location?: string, timeZone?: string }} input
 * @returns {Promise<{ googleEventId: string, htmlLink: string|null }|null>} event reference or null
 */
export async function createCalendarEvent({ userId, summary, description, start, end, location, timeZone }) {
  const oauth2 = await getOAuth2ClientForUser(userId);
  if (!oauth2) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: toDateTime(start), timeZone: timeZone || undefined },
      end: { dateTime: toDateTime(end), timeZone: timeZone || undefined },
    },
  });
  return { googleEventId: res.data.id, htmlLink: res.data.htmlLink || null };
}

/**
 * Updates an existing Google Calendar event. Returns null when the user has
 * not connected their Google account.
 * @param {{ userId: number, googleEventId: string, summary?: string, description?: string, start?: string|Date, end?: string|Date, location?: string, timeZone?: string }} input
 * @returns {Promise<{ googleEventId: string, htmlLink: string|null }|null>} updated event reference or null
 */
export async function updateCalendarEvent({ userId, googleEventId, summary, description, start, end, location, timeZone }) {
  const oauth2 = await getOAuth2ClientForUser(userId);
  if (!oauth2) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const requestBody = {};
  if (summary !== undefined) requestBody.summary = summary;
  if (description !== undefined) requestBody.description = description;
  if (location !== undefined) requestBody.location = location;
  if (start !== undefined) requestBody.start = { dateTime: toDateTime(start), timeZone: timeZone || undefined };
  if (end !== undefined) requestBody.end = { dateTime: toDateTime(end), timeZone: timeZone || undefined };
  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId: googleEventId,
    requestBody,
  });
  return { googleEventId: res.data.id, htmlLink: res.data.htmlLink || null };
}

/**
 * Deletes a Google Calendar event (idempotent: a missing event is not an error).
 * Returns null when the user has not connected their Google account.
 * @param {{ userId: number, googleEventId: string }} input
 * @returns {Promise<{ deleted: boolean }|null>} deletion result or null
 */
export async function deleteCalendarEvent({ userId, googleEventId }) {
  const oauth2 = await getOAuth2ClientForUser(userId);
  if (!oauth2) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
    return { deleted: true };
  } catch (err) {
    // 404 means the event no longer exists — treat as already deleted.
    if (err?.status === 404 || err?.code === 404) return { deleted: false };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Appointment ⇄ Google Calendar wiring (M2 — replaces the cosmetic toggle)
// ---------------------------------------------------------------------------

/**
 * Resolves the owner (User) of the business an appointment belongs to.
 * @param {number} businessId - business id
 * @returns {Promise<{ userId: number, name: string, address: string|null, meetingUrl: string|null, timezone: string }|null>}
 */
async function findAppointmentOwner(businessId) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { userId: true, name: true, address: true, meetingUrl: true, timezone: true },
  });
}

/**
 * Builds the Calendar API event payload for an appointment on the owner's
 * primary calendar.
 * @param {object} appointment - appointment row
 * @param {object} business - business (owner) row
 * @returns {{ userId: number, summary: string, description: string, start: Date, end: Date, location?: string, timeZone?: string }}
 */
function buildAppointmentEventPayload(appointment, business) {
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
 * Creates the event when the owner has sync enabled and a refresh token and
 * the appointment has no event yet; updates it otherwise. Persists the
 * googleEventId on the appointment. NEVER throws: a Google failure must not
 * block the local booking flow (see M2).
 * @param {object} appointment - appointment row (needs businessId, startsAt, endsAt, googleEventId)
 * @returns {Promise<void>}
 */
export async function syncAppointmentToGoogleCalendar(appointment) {
  try {
    const business = await findAppointmentOwner(appointment.businessId);
    if (!business) return;
    const user = await prisma.user.findUnique({
      where: { id: business.userId },
      select: { googleCalendarSync: true, googleRefreshToken: true },
    });
    if (!user?.googleCalendarSync || !user.googleRefreshToken) return;
    const payload = buildAppointmentEventPayload(appointment, business);
    if (appointment.googleEventId) {
      await updateCalendarEvent({ userId: business.userId, googleEventId: appointment.googleEventId, ...payload });
    } else {
      const created = await createCalendarEvent(payload);
      if (created?.googleEventId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: created.googleEventId },
        });
      }
    }
  } catch (err) {
    console.error('Google calendar sync error (appointment id=%s):', appointment?.id, err?.message || err);
  }
}

/**
 * Defensively removes the Google Calendar event linked to an appointment and
 * clears its googleEventId. NEVER throws.
 * @param {object} appointment - appointment row (needs businessId, googleEventId)
 * @returns {Promise<void>}
 */
export async function deleteAppointmentGoogleEvent(appointment) {
  try {
    if (!appointment.googleEventId) return;
    const business = await findAppointmentOwner(appointment.businessId);
    if (!business) return;
    const result = await deleteCalendarEvent({
      userId: business.userId,
      googleEventId: appointment.googleEventId,
    });
    // result === null means the owner is not connected; otherwise the remote
    // event is gone (either deleted or already missing) so the local id can be
    // cleared to keep the appointment consistent.
    if (result) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId: null },
      });
    }
  } catch (err) {
    console.error('Google calendar delete error (appointment id=%s):', appointment?.id, err?.message || err);
  }
}

/**
 * Backfills Google Calendar events for all upcoming confirmed appointments of
 * the user's businesses that are not yet mirrored (no googleEventId). Used by
 * POST /api/google/sync so that enabling sync performs a real synchronization.
 * @param {number} userId - user id
 * @returns {Promise<number[]>} ids of the appointments newly mirrored
 */
export async function syncAllUpcomingAppointments(userId) {
  const businesses = await prisma.business.findMany({ where: { userId }, select: { id: true } });
  const businessIds = businesses.map((b) => b.id);
  if (!businessIds.length) return [];
  const upcoming = await prisma.appointment.findMany({
    where: { businessId: { in: businessIds }, status: 'confirmed', startsAt: { gte: new Date() } },
  });
  const synced = [];
  for (const appointment of upcoming) {
    if (appointment.googleEventId) continue;
    try {
      const business = await findAppointmentOwner(appointment.businessId);
      if (!business) continue;
      const created = await createCalendarEvent(buildAppointmentEventPayload(appointment, business));
      if (created?.googleEventId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: created.googleEventId },
        });
        synced.push(appointment.id);
      }
    } catch (err) {
      console.error('Google backfill sync error (appointment id=%s):', appointment.id, err?.message || err);
    }
  }
  return synced;
}
