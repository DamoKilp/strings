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

    interface UserAgentPayload {
      name: string;
      description: string;
      content: string;
      icon_key: string;
      color_hex: string;
      created_by: string;
      is_builtin?: boolean;
      user_id?: string;
    }

    const payload: UserAgentPayload = {
      name,
      description: description || '',
      content,
      icon_key: iconKey || 'Bot',
      color_hex: colorHex || '#6366F1',
      created_by: user.id,
    }

    // Note: Type assertions needed due to Supabase type system limitations
    // The database types need to be properly generated for full type safety
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (id) {
      // @ts-expect-error - Supabase table types require generated database schema
      const { error } = await supabase.from('user_agents').update(payload as any).eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ id })
    } else {
      const insertPayload: UserAgentPayload = { ...payload, is_builtin: false, user_id: user.id }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from('user_agents').insert(insertPayload as any).select('id').limit(1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      interface InsertResult { id: string }
      const newId = Array.isArray(data) ? (data[0] as InsertResult)?.id : (data as InsertResult)?.id
      return NextResponse.json({ id: newId })
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to save agent'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


