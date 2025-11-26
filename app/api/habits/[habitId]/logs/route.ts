import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HabitsService } from '@/lib/habitsService';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ habitId: string }> | { habitId: string } };

export async function GET() {
  return NextResponse.json({ logs: [] });
}

export async function POST(_: NextRequest, context: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const resolvedParams = context.params instanceof Promise ? await context.params : context.params;
  const habit = await HabitsService.logCompletion(supabase, user.id, resolvedParams.habitId);
  return NextResponse.json({ habit });
}


