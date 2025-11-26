import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { createClient } from '@/utils/supabase/server';
import { readAssistantState, saveGoogleCalendarToken } from '@/lib/assistantSettings';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

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

async function loadStoredTokens(userId: string) {
  const supabase = await createClient();
  const state = await readAssistantState(supabase, userId);
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
  await saveGoogleCalendarToken(supabase, userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? SCOPES.join(' '),
    tokenType: tokens.token_type ?? 'Bearer',
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });
}

export async function deleteGoogleTokens(userId: string) {
  const supabase = await createClient();
  await saveGoogleCalendarToken(supabase, userId, null);
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
  };
}

export function getDefaultCoordinates() {
  const latitude = Number(process.env.NEXT_PUBLIC_DEFAULT_LATITUDE ?? DEFAULT_LAT);
  const longitude = Number(process.env.NEXT_PUBLIC_DEFAULT_LONGITUDE ?? DEFAULT_LON);
  return { latitude, longitude };
}


