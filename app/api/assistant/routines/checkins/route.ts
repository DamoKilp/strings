import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildProactiveCheckIn } from '@/lib/routines/checkins';
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
  const payload = await buildProactiveCheckIn(user.id);
  await upsertRoutineStatus(supabase, user.id, {
    type: 'proactive_checkin',
    status: 'idle',
    lastRunAt: payload.generatedAt,
    nextRunAt: payload.nextRunAt,
  });
  return NextResponse.json(payload);
}


