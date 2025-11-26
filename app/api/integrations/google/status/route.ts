import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { deleteGoogleTokens, getGoogleConnectionStatus } from '@/lib/googleCalendar';

export const runtime = 'nodejs';

async function getUser() {
  const supabase = await createClient();
  return supabase;
}

export async function GET() {
  const supabase = await getUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }
  const status = await getGoogleConnectionStatus(user.id);
  return NextResponse.json(status);
}

export async function DELETE() {
  const supabase = await getUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await deleteGoogleTokens(user.id);
  return NextResponse.json({ ok: true });
}


