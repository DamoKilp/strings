// /app/api/agents/list/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Prefer RPC; if missing, fallback to separate queries
    const { data, error } = await supabase.rpc('list_user_agents', { p_user_id: user.id });
    if (!error && Array.isArray(data)) {
      return NextResponse.json({ data });
    }
    // Fallback: return baseline structure from tables if RPC unavailable
    const { data: customs, error: e1 } = await supabase
      .from('custom_agents')
      .select('id,name,description,content,icon_key,color_hex')
      .eq('created_by', user.id)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { data: prefs, error: e2 } = await supabase
      .from('agent_preferences')
      .select('agent_id,agent_builtin_id,is_enabled,sort_order')
      .eq('user_id', user.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ data: { customAgents: customs || [], preferences: prefs || [] } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}



