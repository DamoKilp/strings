import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { deleteGmailTokens, getGmailConnectionStatus } from '@/lib/gmail';

export const runtime = 'nodejs';

async function getUserClient() {
  const supabase = await createClient();
  return supabase;
}

export async function GET() {
  const supabase = await getUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }
  const status = await getGmailConnectionStatus(user.id);
  return NextResponse.json(status);
}

export async function DELETE() {
  const supabase = await getUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await deleteGmailTokens(user.id);
  return NextResponse.json({ ok: true });
}


