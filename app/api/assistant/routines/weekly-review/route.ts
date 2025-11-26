import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildWeeklyReview } from '@/lib/routines/weeklyReview';
import { upsertRoutineStatus } from '@/lib/assistantSettings';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const payload = await buildWeeklyReview(supabase, user.id);
    await upsertRoutineStatus(supabase, user.id, {
      type: 'weekly_review',
      status: 'idle',
      lastRunAt: payload.generatedAt,
      nextRunAt: payload.nextRunAt,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build weekly review';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


