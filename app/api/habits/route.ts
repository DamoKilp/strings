import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HabitsService } from '@/lib/habitsService';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const habits = await HabitsService.listHabits(supabase, user.id);
    return NextResponse.json({ habits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load habits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  try {
    const habit = await HabitsService.createHabit(supabase, user.id, payload);
    return NextResponse.json({ habit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create habit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


