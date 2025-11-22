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
    interface AgentPreferenceItem {
      agentId?: string | null;
      agentBuiltinId?: string | null;
      isEnabled?: boolean;
      sortOrder?: number | null;
    }
    
    // Note: Type assertion needed due to Supabase RPC type system limitations
    // RPC functions require generated database types for full type safety
    // @ts-expect-error - Supabase RPC types require generated database schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc('batch_upsert_agent_preferences', {
      p_user_id: user.id,
      p_items: items.map((it: AgentPreferenceItem) => ({
        agent_id: it.agentId ?? null,
        agent_builtin_id: it.agentBuiltinId ?? null,
        is_enabled: !!it.isEnabled,
        sort_order: typeof it.sortOrder === 'number' ? it.sortOrder : null,
      })),
    } as any)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to save preferences'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


