import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Sanitize filename to prevent path traversal and injection attacks
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255)
}

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
    const { fileName, fileSize } = body

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid fileName' }, { status: 400 })
    }

    // Validate file extension
    if (!fileName.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .zip uploads are supported' }, { status: 400 })
    }

    // Validate file size (500MB limit)
    const maxSize = 500 * 1024 * 1024
    if (fileSize && fileSize > maxSize) {
      return NextResponse.json({ 
        error: `File too large. Max 500MB, got ${(fileSize / 1024 / 1024).toFixed(2)}MB` 
      }, { status: 400 })
    }

    // Minimum size check
    if (fileSize && fileSize < 22) {
      return NextResponse.json({ error: 'File is too small to be a valid ZIP archive' }, { status: 400 })
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(fileName) || 'upload.zip'
    const bucket = 'imports'
    const objectKey = `garmin/${user.id}/bulk/${Date.now()}-${sanitizedFileName}`

    // Ensure bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return NextResponse.json({ error: `Storage error: ${listError.message}` }, { status: 500 })
    }
    
    const bucketExists = buckets?.some(b => b.name === bucket)
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 500 * 1024 * 1024, // 500MB
      })
      if (createError) {
        // Bucket might exist despite list error, continue anyway
        console.warn('Failed to create bucket:', createError.message)
      }
    }

    // Generate signed upload URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectKey, {
        upsert: false,
      })

    if (urlError) {
      return NextResponse.json({ error: `Failed to generate upload URL: ${urlError.message}` }, { status: 500 })
    }

    if (!signedUrlData) {
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: signedUrlData.signedUrl,
      token: signedUrlData.token,
      path: signedUrlData.path,
      objectKey,
    }, { status: 200 })
  } catch (e: unknown) {
    const err = e as Error
    console.error('Upload URL generation error:', err)
    return NextResponse.json({ 
      error: err?.message || 'Failed to generate upload URL'
    }, { status: 500 })
  }
}
