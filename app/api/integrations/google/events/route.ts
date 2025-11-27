import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchUpcomingEvents, createCalendarEvent } from '@/lib/googleCalendar';

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const created = await createCalendarEvent(user.id, {
      title: String(body?.title || '').trim(),
      startDateTime: body?.startDateTime || undefined,
      endDateTime: body?.endDateTime || undefined,
      allDay: Boolean(body?.allDay),
      date: body?.date || undefined,
      endDate: body?.endDate || undefined,
      durationMinutes: body?.durationMinutes != null ? Number(body.durationMinutes) : undefined,
      timeZone: body?.timeZone || undefined,
      location: body?.location || undefined,
      attendees: Array.isArray(body?.attendees) ? body.attendees.map((e: unknown) => String(e || '')).filter(Boolean) : undefined,
      remindersMinutes: Array.isArray(body?.remindersMinutes) ? body.remindersMinutes.map((n: unknown) => Number(n)) : undefined,
      createMeetLink: Boolean(body?.createMeetLink),
      calendarId: body?.calendarId || 'primary',
    });
    return NextResponse.json({ ok: true, event: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create event';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


