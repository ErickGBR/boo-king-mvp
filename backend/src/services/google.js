import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/google/callback';

export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, CALLBACK_URL);
}

export function getAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'profile',
      'email',
    ],
  });
}

export async function exchangeCode(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

export async function getOAuth2ClientForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) return null;
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    refresh_token: user.googleRefreshToken,
  });
  return oauth2;
}

export async function createCalendarEvent(appointment, business, user) {
  try {
    const oauth2 = await getOAuth2ClientForUser(user.id);
    if (!oauth2) return null;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    const event = {
      summary: `Cita: ${business.name} - ${appointment.guestName}`,
      description: `Cliente: ${appointment.guestName}\nEmail: ${appointment.guestEmail}\nTel: ${appointment.guestPhone || '—'}\nNotas: ${appointment.notes || '—'}`,
      start: { dateTime: appointment.startsAt.toISOString(), timeZone: business.timezone },
      end: { dateTime: appointment.endsAt.toISOString(), timeZone: business.timezone },
      attendees: [{ email: appointment.guestEmail, displayName: appointment.guestName }],
    };
    if (business.locationType === 'online') {
      event.conferenceData = {
        createRequest: { requestId: `appt-${appointment.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      };
    }
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: business.locationType === 'online' ? 1 : 0,
    });
    const eventId = response.data.id;
    const meetLink = response.data.hangoutLink || null;
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { googleEventId: eventId, meetingLink: meetLink },
    });
    return { eventId, meetLink };
  } catch (err) {
    console.error('Google Calendar create event error:', err);
    return null;
  }
}

export async function updateCalendarEvent(appointment, business, user) {
  if (!appointment.googleEventId) return null;
  try {
    const oauth2 = await getOAuth2ClientForUser(user.id);
    if (!oauth2) return null;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    const event = {
      summary: `Cita: ${business.name} - ${appointment.guestName}`,
      description: `Cliente: ${appointment.guestName}\nEmail: ${appointment.guestEmail}\nTel: ${appointment.guestPhone || '—'}\nNotas: ${appointment.notes || '—'}`,
      start: { dateTime: appointment.startsAt.toISOString(), timeZone: business.timezone },
      end: { dateTime: appointment.endsAt.toISOString(), timeZone: business.timezone },
      attendees: [{ email: appointment.guestEmail, displayName: appointment.guestName }],
    };
    await calendar.events.update({
      calendarId: 'primary',
      eventId: appointment.googleEventId,
      resource: event,
    });
    return true;
  } catch (err) {
    console.error('Google Calendar update event error:', err);
    return null;
  }
}

export async function deleteCalendarEvent(googleEventId, userId) {
  if (!googleEventId) return;
  try {
    const oauth2 = await getOAuth2ClientForUser(userId);
    if (!oauth2) return;
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
  } catch (err) {
    console.error('Google Calendar delete event error:', err);
  }
}

export async function verifyGoogleToken(idToken) {
  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client(CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    return payload;
  } catch (err) {
    console.error('Google token verification error:', err);
    return null;
  }
}
