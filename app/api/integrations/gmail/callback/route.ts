import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { exchangeGmailCode } from '@/lib/gmail';
import { resolveSiteUrl } from '@/lib/env';

export const runtime = 'nodejs';

function buildRedirectUrl(baseUrl: string, target?: string | null) {
  if (target && target.startsWith('/')) {
    try {
      return new URL(target, baseUrl);
    } catch {
      // fall through to default
    }
  }
  return new URL('/', baseUrl);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('gmail_oauth_state')?.value;
  cookieStore.delete('gmail_oauth_state');

  const baseUrl = resolveSiteUrl({ headersList: request.headers });
  let redirectPreference: string | null = null;

  try {
    if (errorParam) {
      throw new Error(errorParam);
    }
    if (!code) {
      throw new Error('Missing OAuth code');
    }
    if (!storedState || storedState !== state) {
      throw new Error('State mismatch');
    }

    try {
      const decoded = JSON.parse(Buffer.from(state!, 'base64url').toString());
      if (typeof decoded?.redirectTo === 'string' && decoded.redirectTo.startsWith('/')) {
        redirectPreference = decoded.redirectTo;
      }
    } catch {
      // Ignore malformed state payloads
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    await exchangeGmailCode(user.id, code);
    const successUrl = buildRedirectUrl(baseUrl, redirectPreference);
    successUrl.searchParams.set('gmail', 'connected');
    return NextResponse.redirect(successUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth error';
    const failureUrl = buildRedirectUrl(baseUrl, redirectPreference);
    failureUrl.searchParams.set('gmail', 'error');
    failureUrl.searchParams.set('reason', message);
    return NextResponse.redirect(failureUrl);
  }
}




