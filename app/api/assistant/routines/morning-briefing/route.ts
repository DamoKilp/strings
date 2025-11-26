import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildMorningBriefing } from '@/lib/routines/morningBriefing';
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
    const payload = await buildMorningBriefing(supabase, user.id);
    await upsertRoutineStatus(supabase, user.id, {
      type: 'morning_briefing',
      status: 'idle',
      lastRunAt: payload.generatedAt,
      nextRunAt: payload.nextRunAt,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build briefing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


