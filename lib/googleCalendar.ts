import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { createClient } from '@/utils/supabase/server';
import { readAssistantState, saveGoogleCalendarToken } from '@/lib/assistantSettings';
import type { AssistantState, GoogleCalendarToken as AssistantGoogleToken } from '@/lib/assistantSettings';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const DEFAULT_LAT = -31.841;
const DEFAULT_LON = 115.768;

export interface CalendarEventSummary {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  location?: string | null;
  hangoutLink?: string | null;
  status?: string | null;
}

export interface CreateEventInput {
  calendarId?: string;
  title: string;
  startDateTime?: string;
  endDateTime?: string | null;
  allDay?: boolean;
  date?: string;
  endDate?: string | null;
  durationMinutes?: number;
  timeZone?: string;
  location?: string | null;
  attendees?: string[];
  remindersMinutes?: number[];
  createMeetLink?: boolean;
}

export type UpdateEventInput = Partial<CreateEventInput>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function getRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/integrations/google/callback`
  );
}

function getOAuthClient(redirectUri?: string): OAuth2Client {
  const clientId = requireEnv('Google_Client_ID');
  const clientSecret = requireEnv('Google_secret');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri ?? getRedirectUri());
}

export async function getGoogleAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

function readStateLoose(client: unknown, userId: string): Promise<AssistantState> {
  const fn = readAssistantState as unknown as (c: unknown, u: string) => Promise<AssistantState>;
  return fn(client, userId);
}

function saveTokenLoose(client: unknown, userId: string, token: AssistantGoogleToken | null): Promise<void> {
  const fn = saveGoogleCalendarToken as unknown as (c: unknown, u: string, t: AssistantGoogleToken | null) => Promise<void>;
  return fn(client, userId, token);
}

async function loadStoredTokens(userId: string) {
  const supabase = await createClient();
  const state = await readStateLoose(supabase, userId);
  return state.googleCalendar ?? null;
}

export async function storeGoogleTokens(
  userId: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string | null;
    token_type?: string | null;
    expiry_date?: number | null;
  }
) {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing access or refresh token');
  }
  const supabase = await createClient();
  await saveTokenLoose(supabase, userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? SCOPES.join(' '),
    tokenType: tokens.token_type ?? 'Bearer',
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });
}

export async function deleteGoogleTokens(userId: string) {
  const supabase = await createClient();
  await saveTokenLoose(supabase, userId, null);
}

export async function exchangeGoogleCode(userId: string, code: string, redirectUri?: string) {
  const oauth = getOAuthClient(redirectUri);
  const { tokens } = await oauth.getToken(code);
  await storeGoogleTokens(userId, tokens);
}

async function ensureValidCredentials(oauth: OAuth2Client, userId: string) {
  const stored = await loadStoredTokens(userId);
  if (!stored) return null;

  oauth.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    scope: stored.scope ?? SCOPES.join(' '),
    token_type: stored.tokenType ?? 'Bearer',
    expiry_date: stored.expiryDate ? Date.parse(stored.expiryDate) : undefined,
  });

  const expiresAt = stored.expiryDate ? Date.parse(stored.expiryDate) : undefined;
  if (expiresAt && expiresAt < Date.now() - 60_000) {
    const { credentials } = await oauth.refreshAccessToken();
    await storeGoogleTokens(userId, credentials);
    oauth.setCredentials(credentials);
  }

  return stored;
}

function hasWriteScope(scopeString?: string | null) {
  if (!scopeString) return false;
  const scopes = scopeString.split(/\s+/);
  return scopes.includes('https://www.googleapis.com/auth/calendar') ||
         scopes.includes('https://www.googleapis.com/auth/calendar.events');
}

export async function fetchUpcomingEvents(
  userId: string,
  options: { maxResults?: number; timeMin?: Date; timeMax?: Date } = {}
): Promise<CalendarEventSummary[]> {
  const oauth = getOAuthClient();
  const stored = await ensureValidCredentials(oauth, userId);
  if (!stored) return [];

  const calendar = google.calendar({ version: 'v3', auth: oauth });
  const now = options.timeMin ?? new Date();
  const timeMax = options.timeMax ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
  const response = await calendar.events.list({
    calendarId: 'primary',
    maxResults: options.maxResults ?? 5,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    fields: 'items(id,summary,start,end,location,hangoutLink,status)',
  });

  return (
    response.data.items?.map((item) => ({
      id: item.id || crypto.randomUUID(),
      title: item.summary || 'Untitled event',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || null,
      location: item.location ?? null,
      hangoutLink: item.hangoutLink ?? null,
      status: item.status ?? null,
    })) ?? []
  );
}

export async function getGoogleConnectionStatus(userId: string) {
  const stored = await loadStoredTokens(userId);
  if (!stored) {
    return { connected: false };
  }
  return {
    connected: true,
    expiry_date: stored.expiryDate,
    scope: stored.scope,
    canWrite: hasWriteScope(stored.scope),
  };
}

export function getDefaultCoordinates() {
  const latitude = Number(process.env.NEXT_PUBLIC_DEFAULT_LATITUDE ?? DEFAULT_LAT);
  const longitude = Number(process.env.NEXT_PUBLIC_DEFAULT_LONGITUDE ?? DEFAULT_LON);
  return { latitude, longitude };
}

function buildEventResource(input: CreateEventInput) {
  const timeZone = input.timeZone || 'UTC';
  const resource: calendar_v3.Schema$Event = {
    summary: input.title,
    location: input.location || undefined,
    attendees: Array.isArray(input.attendees) ? input.attendees.map((email) => ({ email })) : undefined,
  };

  if (Array.isArray(input.remindersMinutes) && input.remindersMinutes.length > 0) {
    resource.reminders = {
      useDefault: false,
      overrides: input.remindersMinutes.map((m) => ({ method: 'popup', minutes: Number(m) })),
    };
  }

  if (input.allDay || input.date) {
    const startDate = input.date || (input.startDateTime ? input.startDateTime.slice(0, 10) : undefined);
    const endDate = input.endDate || startDate;
    if (!startDate) throw new Error('Missing date for all-day event');
    resource.start = { date: startDate };
    resource.end = { date: endDate };
  } else {
    if (!input.startDateTime) throw new Error('Missing startDateTime');
    const start = input.startDateTime;
    let end = input.endDateTime || null;
    if (!end) {
      const startMs = Date.parse(start);
      const dur = Math.max(15, Number(input.durationMinutes || 30)) * 60_000;
      end = new Date(startMs + dur).toISOString();
    }
    resource.start = { dateTime: start, timeZone };
    resource.end = { dateTime: end, timeZone };
  }

  if (input.createMeetLink) {
    resource.conferenceData = {
      createRequest: { requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    };
  }

  return resource;
}

export async function createCalendarEvent(userId: string, input: CreateEventInput) {
  const oauth = getOAuthClient();
  const stored = await ensureValidCredentials(oauth, userId);
  if (!stored) throw new Error('Not connected to Google Calendar');
  if (!hasWriteScope(stored.scope)) throw new Error('Missing write permission for Google Calendar. Please reconnect and grant access.');

  const calendar = google.calendar({ version: 'v3', auth: oauth });
  const calendarId = input.calendarId || 'primary';
  const resource = buildEventResource(input);
  const resp = await calendar.events.insert({
    calendarId,
    requestBody: resource,
    conferenceDataVersion: resource.conferenceData ? 1 : undefined,
  });
  return resp.data;
}

export async function updateCalendarEvent(userId: string, eventId: string, input: UpdateEventInput) {
  const oauth = getOAuthClient();
  const stored = await ensureValidCredentials(oauth, userId);
  if (!stored) throw new Error('Not connected to Google Calendar');
  if (!hasWriteScope(stored.scope)) throw new Error('Missing write permission for Google Calendar. Please reconnect and grant access.');

  const calendar = google.calendar({ version: 'v3', auth: oauth });
  const calendarId = input.calendarId || 'primary';

  const patch: calendar_v3.Schema$Event = {};
  if (input.title !== undefined) patch.summary = input.title;
  if (input.location !== undefined) patch.location = input.location;
  if (input.attendees) patch.attendees = input.attendees.map((email) => ({ email }));
  if (input.remindersMinutes) {
    patch.reminders = {
      useDefault: false,
      overrides: input.remindersMinutes.map((m) => ({ method: 'popup', minutes: Number(m) })),
    };
  }
  if (input.createMeetLink) {
    patch.conferenceData = {
      createRequest: { requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    };
  }
  if (input.allDay || input.date || input.endDate) {
    if (!input.date) throw new Error('date required for all-day update');
    patch.start = { date: input.date };
    patch.end = { date: input.endDate || input.date };
  } else if (input.startDateTime || input.endDateTime || input.durationMinutes || input.timeZone) {
    const tz = input.timeZone || 'UTC';
    const start = input.startDateTime;
    let end = input.endDateTime || null;
    if (start && !end) {
      const startMs = Date.parse(start);
      const dur = Math.max(15, Number(input.durationMinutes || 30)) * 60_000;
      end = new Date(startMs + dur).toISOString();
    }
    if (start) patch.start = { dateTime: start, timeZone: tz };
    if (end) patch.end = { dateTime: end, timeZone: tz };
  }

  const resp = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: patch,
    conferenceDataVersion: patch.conferenceData ? 1 : undefined,
  });
  return resp.data;
}

export async function deleteCalendarEvent(userId: string, eventId: string, calendarId = 'primary') {
  const oauth = getOAuthClient();
  const stored = await ensureValidCredentials(oauth, userId);
  if (!stored) throw new Error('Not connected to Google Calendar');
  if (!hasWriteScope(stored.scope)) throw new Error('Missing write permission for Google Calendar. Please reconnect and grant access.');

  const calendar = google.calendar({ version: 'v3', auth: oauth });
  await calendar.events.delete({ calendarId, eventId });
  return { ok: true };
}