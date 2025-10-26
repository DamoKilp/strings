import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { agentId, agentBuiltinId, isEnabled, sortOrder } = await req.json()
    if (!agentId && !agentBuiltinId) {
      return NextResponse.json({ error: 'agentId or agentBuiltinId is required' }, { status: 400 })
    }

    // Upsert into preferences table via RPC or direct upsert depending on schema
    // Prefer RPC if available to enforce constraints
    const hasRpc = true
    if (hasRpc) {
      const { error } = await supabase.rpc('upsert_agent_preference', {
        p_user_id: user.id,
        p_agent_id: agentId || null,
        p_agent_builtin_id: agentBuiltinId || null,
        p_is_enabled: !!isEnabled,
        p_sort_order: typeof sortOrder === 'number' ? sortOrder : null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save preference' }, { status: 500 })
  }
}


