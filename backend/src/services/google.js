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

/**
 * Verifies a Google access token (implicit flow) against Google's tokeninfo
 * endpoint and returns a normalized payload, or null on failure.
 * Used as a fallback for frontends that send an access_token instead of an ID token.
 * @param {string} accessToken - Google OAuth2 access token
 * @returns {Promise<object|null>} normalized payload or null
 */
export async function verifyGoogleAccessToken(accessToken) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.email) return null;
    return {
      sub: data.sub || null,
      email: data.email,
      name: data.name || null,
      picture: data.picture || null,
    };
  } catch (err) {
    console.error('Google access token verification error:', err);
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
 * @returns {string} authorization URL
 */
export function getAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
  });
}

/**
 * Exchanges an OAuth2 authorization code for tokens.
 * @param {string} code - authorization code from the callback query string
 * @returns {Promise<object>} token set ({ access_token, refresh_token, ... })
 */
export async function exchangeCode(code) {
  const oauth2 = getOAuth2Client();
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
