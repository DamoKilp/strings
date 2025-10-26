import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await req.json()
    if (!Array.isArray(items)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    // Prefer RPC for batch upsert if available
    const { error } = await supabase.rpc('batch_upsert_agent_preferences', {
      p_user_id: user.id,
      p_items: items.map((it: any) => ({
        agent_id: it.agentId ?? null,
        agent_builtin_id: it.agentBuiltinId ?? null,
        is_enabled: !!it.isEnabled,
        sort_order: typeof it.sortOrder === 'number' ? it.sortOrder : null,
      })),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save preferences' }, { status: 500 })
  }
}


