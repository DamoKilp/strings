import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { getGoogleAuthUrl } from '@/lib/googleCalendar';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : '/';
  const statePayload = {
    token: crypto.randomUUID(),
    redirectTo,
  };
  const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
  const authUrl = await getGoogleAuthUrl(encodedState);

  const response = NextResponse.json({ url: authUrl });
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'google_oauth_state',
    value: encodedState,
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}


