import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HabitsService } from '@/lib/habitsService';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ habitId: string }> | { habitId: string } };

export async function PATCH(request: NextRequest, context: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = context.params instanceof Promise ? await context.params : context.params;
  const habitId = resolvedParams.habitId;
  const payload = await request.json();

  try {
    const habit = await HabitsService.updateHabit(supabase, user.id, habitId, payload);
    return NextResponse.json({ habit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update habit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, context: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const resolvedParams = context.params instanceof Promise ? await context.params : context.params;
  try {
    await HabitsService.deleteHabit(supabase, user.id, resolvedParams.habitId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete habit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


