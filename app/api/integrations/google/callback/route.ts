import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { exchangeGoogleCode } from '@/lib/googleCalendar';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  let redirectPath = '/?googleCalendar=connected';

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

    const decoded = JSON.parse(Buffer.from(state!, 'base64url').toString());
    if (decoded?.redirectTo) {
      redirectPath = decoded.redirectTo;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    await exchangeGoogleCode(user.id, code);
    redirectPath = `${redirectPath}?googleCalendar=connected`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth error';
    redirectPath = `/?googleCalendar=error&reason=${encodeURIComponent(message)}`;
  }

  return NextResponse.redirect(new URL(redirectPath, APP_URL));
}


