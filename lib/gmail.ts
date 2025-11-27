import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { createClient } from '@/utils/supabase/server';
import { readAssistantState, saveGmailToken } from '@/lib/assistantSettings';
import type { AssistantState, GmailToken as AssistantGmailToken } from '@/lib/assistantSettings';
import type { EmailSummary, EmailDetail } from '@/lib/types';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function getGmailRedirectUri() {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/integrations/gmail/callback`
  );
}

function getOAuthClient(redirectUri?: string): OAuth2Client {
  const clientId = requireEnv('Google_Client_ID');
  const clientSecret = requireEnv('Google_secret');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri ?? getGmailRedirectUri());
}

export async function getGmailAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
    state,
  });
}

function readStateLoose(client: unknown, userId: string): Promise<AssistantState> {
  const fn = readAssistantState as unknown as (c: unknown, u: string) => Promise<AssistantState>;
  return fn(client, userId);
}

function saveTokenLoose(client: unknown, userId: string, token: AssistantGmailToken | null): Promise<void> {
  const fn = saveGmailToken as unknown as (c: unknown, u: string, t: AssistantGmailToken | null) => Promise<void>;
  return fn(client, userId, token);
}

async function loadStoredTokens(userId: string) {
  const supabase = await createClient();
  const state = await readStateLoose(supabase, userId);
  return state.gmail ?? null;
}

export async function storeGmailTokens(
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
    scope: tokens.scope ?? GMAIL_SCOPES.join(' '),
    tokenType: tokens.token_type ?? 'Bearer',
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });
}

export async function deleteGmailTokens(userId: string) {
  const supabase = await createClient();
  await saveTokenLoose(supabase, userId, null);
}

export async function exchangeGmailCode(userId: string, code: string, redirectUri?: string) {
  const oauth = getOAuthClient(redirectUri);
  const { tokens } = await oauth.getToken(code);
  await storeGmailTokens(userId, tokens);
}

async function ensureValidCredentials(oauth: OAuth2Client, userId: string) {
  const stored = await loadStoredTokens(userId);
  if (!stored) return null;

  oauth.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    scope: stored.scope ?? GMAIL_SCOPES.join(' '),
    token_type: stored.tokenType ?? 'Bearer',
    expiry_date: stored.expiryDate ? Date.parse(stored.expiryDate) : undefined,
  });

  const expiresAt = stored.expiryDate ? Date.parse(stored.expiryDate) : undefined;
  if (expiresAt && expiresAt < Date.now() - 60_000) {
    const { credentials } = await oauth.refreshAccessToken();
    await storeGmailTokens(userId, credentials);
    oauth.setCredentials(credentials);
  }

  return stored;
}

function hasReadScope(scopeString?: string | null) {
  if (!scopeString) return false;
  const scopes = scopeString.split(/\s+/);
  return scopes.includes('https://www.googleapis.com/auth/gmail.readonly') ||
    scopes.includes('https://www.googleapis.com/auth/gmail.modify');
}

async function getGmailClient(userId: string): Promise<{ gmail: gmail_v1.Gmail; token: AssistantGmailToken } | null> {
  const oauth = getOAuthClient();
  const stored = await ensureValidCredentials(oauth, userId);
  if (!stored || !hasReadScope(stored.scope)) return null;

  const gmail = google.gmail({ version: 'v1', auth: oauth });
  return { gmail, token: stored };
}

export async function getGmailConnectionStatus(userId: string) {
  const stored = await loadStoredTokens(userId);
  if (!stored) {
    return { connected: false };
  }
  return {
    connected: true,
    expiry_date: stored.expiryDate,
    scope: stored.scope,
    canRead: hasReadScope(stored.scope),
    lastSync: null as string | null,
  };
}

export interface ListThreadsOptions {
  maxResults?: number;
  labelIds?: string[];
  unreadOnly?: boolean;
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined, name: string): string {
  if (!headers) return '';
  const lower = name.toLowerCase();
  return headers.find((h) => h.name?.toLowerCase() === lower)?.value ?? '';
}

export async function listThreads(userId: string, options: ListThreadsOptions = {}): Promise<EmailSummary[]> {
  const client = await getGmailClient(userId);
  if (!client) return [];

  const { gmail } = client;
  const max = Math.min(Math.max(options.maxResults ?? 5, 1), 20);

  const resp = await gmail.users.messages.list({
    userId: 'me',
    maxResults: max,
    labelIds: options.labelIds ?? ['INBOX'],
    q: options.unreadOnly ? 'is:unread' : undefined,
  });

  const messages = resp.data.messages ?? [];
  if (!messages.length) return [];

  const summaries: EmailSummary[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const data = full.data;
      const headers = data.payload?.headers ?? [];
      const subject = headerValue(headers, 'Subject') || '(no subject)';
      const from = headerValue(headers, 'From') || '';
      const dateHeader = headerValue(headers, 'Date');
      const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
      const isoDate = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      const labelIds = (data.labelIds ?? msg.labelIds ?? []).filter((l): l is string => typeof l === 'string');

      const summary: EmailSummary = {
        id: data.id || msg.id,
        threadId: data.threadId || msg.threadId || data.id || msg.id,
        subject,
        from,
        snippet: data.snippet ?? '',
        date: isoDate,
        isUnread: labelIds.includes('UNREAD'),
        labels: labelIds,
      };
      summaries.push(summary);
    } catch (error) {
      // Log without PII
      console.error('[Gmail] Failed to fetch message metadata', { id: msg.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return summaries;
}

function decodeBody(body?: gmail_v1.Schema$MessagePartBody | null): string {
  if (!body?.data) return '';
  const normalized = body.data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlainText(payload?: gmail_v1.Schema$MessagePart | null): string {
  if (!payload) return '';

  // Prefer explicit plain text parts
  if (payload.mimeType === 'text/plain' && payload.body) {
    return decodeBody(payload.body);
  }

  if (payload.parts && payload.parts.length > 0) {
    const texts = payload.parts.map((p) => extractPlainText(p)).filter(Boolean);
    if (texts.length > 0) {
      return texts.join('\n\n');
    }
  }

  // Fallback to HTML if present
  if (payload.mimeType === 'text/html' && payload.body) {
    const html = decodeBody(payload.body);
    return stripHtml(html);
  }

  return '';
}

export async function getMessage(userId: string, messageId: string): Promise<EmailDetail | null> {
  const client = await getGmailClient(userId);
  if (!client) return null;

  const { gmail } = client;

  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const data = full.data;
  if (!data.id) {
    return null;
  }

  const headers = data.payload?.headers ?? [];
  const subject = headerValue(headers, 'Subject') || '(no subject)';
  const from = headerValue(headers, 'From') || '';
  const dateHeader = headerValue(headers, 'Date');
  const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
  const isoDate = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  const labelIds = (data.labelIds ?? []).filter((l): l is string => typeof l === 'string');

  let bodyText = extractPlainText(data.payload);
  if (!bodyText) {
    bodyText = data.snippet ?? '';
  }

  const MAX_LENGTH = 4000;
  if (bodyText.length > MAX_LENGTH) {
    bodyText = `${bodyText.slice(0, MAX_LENGTH)}\n\n[Message truncated for brevity. Ask Victoria to continue reading if you need more.]`;
  }

  const detail: EmailDetail = {
    id: data.id,
    threadId: data.threadId || data.id,
    subject,
    from,
    snippet: data.snippet ?? '',
    date: isoDate,
    isUnread: labelIds.includes('UNREAD'),
    labels: labelIds,
    bodyText,
  };

  return detail;
}


