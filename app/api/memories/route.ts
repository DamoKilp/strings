import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/memories
 * Retrieves memories for the authenticated user
 * Query params:
 *   - limit: number of memories to return (default: 50)
 *   - category: filter by category
 *   - minImportance: minimum importance score (1-10)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // Default to 200 memories - they're small and provide rich context
    const limit = parseInt(searchParams.get('limit') || '200', 10)
    const category = searchParams.get('category')
    const minImportance = searchParams.get('minImportance')

    let query = supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('importance', { ascending: false })
      .order('last_accessed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    if (minImportance) {
      const minImp = parseInt(minImportance, 10)
      if (!isNaN(minImp) && minImp >= 1 && minImp <= 10) {
        query = query.gte('importance', minImp)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ memories: data || [] })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to fetch memories' }, { status: 500 })
  }
}

/**
 * POST /api/memories
 * Creates a new memory
 * Body: { content: string, category?: string, importance?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, category, importance } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const importanceValue = importance 
      ? Math.max(1, Math.min(10, parseInt(String(importance), 10) || 5))
      : 5

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        content: content.trim(),
        category: category || null,
        importance: importanceValue,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ memory: data })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to create memory' }, { status: 500 })
  }
}




