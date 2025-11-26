import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchUpcomingEvents } from '@/lib/googleCalendar';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const max = Number(searchParams.get('maxResults') ?? '5');
  const events = await fetchUpcomingEvents(user.id, { maxResults: Math.min(max, 10) });
  return NextResponse.json({ events });
}


