import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { start = '08:00', end = '21:00' } = await req.json().catch(() => ({}))
    interface UserPreferencePayload {
      user_id: string;
      nudge_settings: {
        allowed_hours: { start: string; end: string };
        frequency: string;
      };
    }
    // Note: Type assertion needed due to Supabase type system limitations
    // The database types need to be properly generated for full type safety
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        nudge_settings: { allowed_hours: { start, end }, frequency: 'medium' },
      } as any, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, start, end })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


