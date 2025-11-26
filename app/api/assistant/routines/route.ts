import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getRoutineStatuses, upsertRoutineStatus } from '@/lib/assistantSettings';
import type { AssistantRoutineType } from '@/lib/types';

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
    const routines = await getRoutineStatuses(supabase, user.id);
    return NextResponse.json({ routines });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load routines';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const routineType = (body?.routine_type ?? body?.routineType) as AssistantRoutineType | undefined;
  if (!routineType) {
    return NextResponse.json({ error: 'routine_type is required' }, { status: 400 });
  }
  try {
    const nextRunAt = body?.next_run_at ?? body?.nextRunAt ?? null;
    await upsertRoutineStatus(supabase, user.id, {
      type: routineType,
      status: body?.status ?? 'idle',
      nextRunAt,
      config: body?.config ?? {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update routine';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


