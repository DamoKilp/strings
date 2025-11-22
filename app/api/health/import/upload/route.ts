import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large file uploads

export async function POST(req: NextRequest) {
  console.log('[UPLOAD] Route hit - starting health import upload')
  
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  
  if (authError || !user) {
    console.error('[UPLOAD] Auth failed:', authError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  console.log('[UPLOAD] User authenticated:', user.id)

  try {
    console.log('[UPLOAD] Parsing FormData...')
    const form = await req.formData()
    const file = form.get('file') as File | null
    
    if (!file) {
      console.error('[UPLOAD] No file in FormData')
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    
    console.log('[UPLOAD] File received:', { name: file.name, size: file.size, type: file.type })

    // Basic validation: only .zip
    const name = file.name || 'upload.zip'
    if (!name.toLowerCase().endsWith('.zip')) {
      console.error('[UPLOAD] Invalid file type:', name)
      return NextResponse.json({ error: 'Only .zip uploads are supported' }, { status: 400 })
    }
    
    // File size check (500MB limit)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      console.error('[UPLOAD] File too large:', file.size)
      return NextResponse.json({ error: `File too large. Max 500MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB` }, { status: 400 })
    }

    console.log('[UPLOAD] Reading file to buffer...')
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    console.log('[UPLOAD] Buffer ready:', bytes.length, 'bytes')

    const bucket = 'imports'
    const objectKey = `garmin/${user.id}/bulk/${Date.now()}-${name}`
    console.log('[UPLOAD] Target:', { bucket, objectKey })

    // Ensure bucket exists
    console.log('[UPLOAD] Checking if bucket exists...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('[UPLOAD] Failed to list buckets:', listError)
      return NextResponse.json({ error: `Storage error: ${listError.message}` }, { status: 500 })
    }
    
    const bucketExists = buckets?.some(b => b.name === bucket)
    console.log('[UPLOAD] Bucket exists:', bucketExists)
    
    if (!bucketExists) {
      console.log('[UPLOAD] Creating bucket...')
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 500 * 1024 * 1024, // 500MB
      })
      if (createError) {
        console.error('[UPLOAD] Failed to create bucket:', createError)
        // Bucket might exist despite list error, try upload anyway
        console.log('[UPLOAD] Continuing with upload attempt...')
      } else {
        console.log('[UPLOAD] Bucket created successfully')
      }
    }

    console.log('[UPLOAD] Uploading to Supabase Storage...')
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectKey, bytes, {
        cacheControl: '3600',
        contentType: 'application/zip',
        upsert: false,
      })

    if (uploadError) {
      console.error('[UPLOAD] Upload error:', uploadError)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }
    
    console.log('[UPLOAD] File uploaded successfully')

    // Register import job (queued)
    console.log('[UPLOAD] Registering import job...')
    const { data: jobId, error: regError } = await supabase
      .rpc('register_import_job', {
        p_user_id: user.id,
        p_source: 'garmin_zip',
        p_object_key: objectKey,
      })

    if (regError) {
      console.error('[UPLOAD] Register job error:', regError)
      return NextResponse.json({ error: `Job registration failed: ${regError.message}` }, { status: 500 })
    }
    
    console.log('[UPLOAD] Success! Job ID:', jobId)
    return NextResponse.json({ ok: true, objectKey, jobId }, { status: 200 })
  } catch (e: unknown) {
    const err = e as Error
    console.error('[UPLOAD] Exception:', err.message, err.stack)
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 })
  }
}


