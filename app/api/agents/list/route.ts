// /app/api/agents/list/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Prefer RPC; map to flat rows expected by ChatProvider
    const { data: rpcJson, error } = await (supabase as any).rpc('list_user_agents', { p_user_id: user.id });
    // RPC disabled; proceed with direct selects
    // Fallback: direct selects from user_agents and agent_preferences
    const { data: customsRaw, error: e1 } = await supabase
      .from('user_agents')
      .select('id,name,description,content,icon_key,color_hex')
      .eq('user_id', user.id)
      .eq('is_builtin', false)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { data: prefsRaw, error: e2 } = await supabase
      .from('agent_preferences')
      .select('agent_id,agent_builtin_id,is_enabled,sort_order')
      .eq('user_id', user.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    const customs: any[] = (customsRaw as any[]) || []
    const prefs: any[] = (prefsRaw as any[]) || []
    const rows: any[] = (customs).map((ca: any) => {
      const pref = (prefs).find((p: any) => p.agent_id === ca.id)
      return {
        id: ca.id,
        name: ca.name,
        description: ca.description,
        content: ca.content,
        icon_key: ca.icon_key,
        color_hex: ca.color_hex,
        pref_is_enabled: pref ? !!pref.is_enabled : true,
        pref_sort_order: pref ? (pref.sort_order ?? 9999) : 9999,
      }
    })
    // Include builtin preference rows
    for (const p of (prefs || [])) {
      if (p.agent_builtin_id) {
        rows.push({
          is_builtin: true,
          agent_builtin_id: p.agent_builtin_id,
          pref_is_enabled: !!p.is_enabled,
          pref_sort_order: p.sort_order ?? 9999,
        })
      }
    }
    return NextResponse.json({ data: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}



