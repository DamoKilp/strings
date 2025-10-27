import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, name, description, content, iconKey, colorHex } = await req.json()
    if (!name || !content) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const payload: any = {
      name,
      description: description || '',
      content,
      icon_key: iconKey || 'Bot',
      color_hex: colorHex || '#6366F1',
      created_by: user.id,
    }

    if (id) {
      const { error } = await (supabase as any).from('user_agents').update(payload).eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ id })
    } else {
      const insertPayload = { ...payload, is_builtin: false, user_id: user.id }
      const { data, error } = await (supabase as any).from('user_agents').insert(insertPayload).select('id').limit(1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const newId = Array.isArray(data) ? (data[0] as any)?.id : (data as any)?.id
      return NextResponse.json({ id: newId })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save agent' }, { status: 500 })
  }
}


