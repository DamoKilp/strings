import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { objectKey } = body

    if (!objectKey || typeof objectKey !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid objectKey' }, { status: 400 })
    }

    // Register import job (file was already uploaded successfully via signed URL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: jobId, error: regError } = await supabase
      .rpc('register_import_job', {
        p_user_id: user.id,
        p_source: 'garmin_zip',
        p_object_key: objectKey,
      } as any)

    if (regError) {
      return NextResponse.json({ error: `Job registration failed: ${regError.message}` }, { status: 500 })
    }
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job registration failed: No job ID returned' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, objectKey, jobId }, { status: 200 })
  } catch (e: unknown) {
    const err = e as Error
    console.error('Job registration error:', err)
    return NextResponse.json({ 
      error: err?.message || 'Failed to register import job'
    }, { status: 500 })
  }
}
