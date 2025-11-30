import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/googleCalendar';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await updateCalendarEvent(user.id, params.id, {
      title: body?.title,
      startDateTime: body?.startDateTime,
      endDateTime: body?.endDateTime,
      allDay: body?.allDay,
      date: body?.date,
      endDate: body?.endDate,
      durationMinutes: body?.durationMinutes != null ? Number(body.durationMinutes) : undefined,
      timeZone: body?.timeZone,
      location: body?.location,
      attendees: Array.isArray(body?.attendees) ? body.attendees.map((e: unknown) => String(e || '')).filter(Boolean) : undefined,
      remindersMinutes: Array.isArray(body?.remindersMinutes) ? body.remindersMinutes.map((n: unknown) => Number(n)) : undefined,
      createMeetLink: body?.createMeetLink,
      calendarId: body?.calendarId,
    });
    return NextResponse.json({ ok: true, event: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update event';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await deleteCalendarEvent(user.id, params.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete event';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}




