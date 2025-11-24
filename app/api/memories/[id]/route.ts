import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

/**
 * PATCH /api/memories/[id]
 * Updates a memory (including access tracking)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, category, importance, trackAccess } = body

    const updateData: Record<string, unknown> = {}
    
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
      }
      updateData.content = content.trim()
    }

    if (category !== undefined) {
      updateData.category = category || null
    }

    if (importance !== undefined) {
      const importanceValue = Math.max(1, Math.min(10, parseInt(String(importance), 10) || 5))
      updateData.importance = importanceValue
    }

    // Track access if requested (for when memory is used in conversation)
    if (trackAccess) {
      updateData.last_accessed_at = new Date().toISOString()
      // Increment access count
      const { data: existing } = await supabase
        .from('memories')
        .select('access_count')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()
      
      if (existing) {
        updateData.access_count = (existing.access_count || 0) + 1
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('memories')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    return NextResponse.json({ memory: data })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to update memory' }, { status: 500 })
  }
}

/**
 * DELETE /api/memories/[id]
 * Deletes a memory
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to delete memory' }, { status: 500 })
  }
}

