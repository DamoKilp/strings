import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large file uploads

// Environment-based logging helper
const isDev = process.env.NODE_ENV === 'development'
const log = (message: string, ...args: unknown[]) => {
  if (isDev) {
    console.log(`[UPLOAD] ${message}`, ...args)
  }
}
const logError = (message: string, ...args: unknown[]) => {
  console.error(`[UPLOAD] ${message}`, ...args)
}

// Sanitize filename to prevent path traversal and injection attacks
function sanitizeFileName(fileName: string): string {
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255) // Limit length
}

// Validate ZIP file by checking magic bytes
function isValidZipFile(bytes: Uint8Array): boolean {
  // ZIP files start with either:
  // - PK\x03\x04 (local file header)
  // - PK\x05\x06 (empty archive)
  // - PK\x07\x08 (spanned archive)
  if (bytes.length < 4) return false
  
  const magicBytes = [
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04, // PK\x03\x04
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x05 && bytes[3] === 0x06, // PK\x05\x06
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x07 && bytes[3] === 0x08, // PK\x07\x08
  ]
  
  return magicBytes.some(Boolean)
}

// Valid MIME types for ZIP files
const VALID_ZIP_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream', // Some browsers send this for ZIP files
]

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Upload endpoint is accessible' }, { status: 200 })
}

export async function POST(req: NextRequest) {
  log('Route hit - starting health import upload')
  
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logError('Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    log('User authenticated:', user.id)

    try {
      log('Parsing FormData...')
      const form = await req.formData()
      const file = form.get('file') as File | null
      
      if (!file) {
        logError('No file in FormData')
        return NextResponse.json({ error: 'Missing file' }, { status: 400 })
      }
      
      log('File received:', { name: file.name, size: file.size, type: file.type })

      // Validate file extension
      const originalName = file.name || 'upload.zip'
      if (!originalName.toLowerCase().endsWith('.zip')) {
        logError('Invalid file extension:', originalName)
        return NextResponse.json({ error: 'Only .zip uploads are supported' }, { status: 400 })
      }
      
      // Validate MIME type
      if (file.type && !VALID_ZIP_MIME_TYPES.includes(file.type)) {
        logError('Invalid MIME type:', file.type)
        return NextResponse.json({ error: 'Invalid file type. Expected ZIP file.' }, { status: 400 })
      }
      
      // File size check (500MB limit)
      const maxSize = 500 * 1024 * 1024
      if (file.size > maxSize) {
        logError('File too large:', file.size)
        return NextResponse.json({ 
          error: `File too large. Max 500MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB` 
        }, { status: 400 })
      }
      
      // Minimum size check (ZIP files should have at least some content)
      if (file.size < 22) { // Minimum ZIP file size (empty archive is ~22 bytes)
        logError('File too small to be a valid ZIP:', file.size)
        return NextResponse.json({ error: 'File is too small to be a valid ZIP archive' }, { status: 400 })
      }

      log('Reading file to buffer...')
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      log('Buffer ready:', bytes.length, 'bytes')

      // Validate ZIP file content (magic bytes)
      if (!isValidZipFile(bytes)) {
        logError('Invalid ZIP file structure - magic bytes check failed')
        return NextResponse.json({ 
          error: 'Invalid ZIP file. File does not appear to be a valid ZIP archive.' 
        }, { status: 400 })
      }

      // Sanitize filename for safe storage
      const sanitizedFileName = sanitizeFileName(originalName) || 'upload.zip'
      const bucket = 'imports'
      const objectKey = `garmin/${user.id}/bulk/${Date.now()}-${sanitizedFileName}`
      log('Target:', { bucket, objectKey })

      // Ensure bucket exists
      log('Checking if bucket exists...')
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        logError('Failed to list buckets:', listError.message)
        return NextResponse.json({ error: `Storage error: ${listError.message}` }, { status: 500 })
      }
      
      const bucketExists = buckets?.some(b => b.name === bucket)
      log('Bucket exists:', bucketExists)
      
      if (!bucketExists) {
        log('Creating bucket...')
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: 500 * 1024 * 1024, // 500MB
        })
        if (createError) {
          logError('Failed to create bucket:', createError.message)
          // Bucket might exist despite list error, try upload anyway
          log('Continuing with upload attempt...')
        } else {
          log('Bucket created successfully')
        }
      }

      log('Uploading to Supabase Storage...')
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectKey, bytes, {
          cacheControl: '3600',
          contentType: 'application/zip',
          upsert: false,
        })

      if (uploadError) {
        logError('Upload error:', uploadError.message)
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
      }
      
      log('File uploaded successfully')

      // Register import job (queued)
      // Note: Type assertion needed due to Supabase RPC type inference limitations
      // The RPC signature is correctly defined in database.types.ts: register_import_job
      log('Registering import job...')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobId, error: regError } = await supabase
        .rpc('register_import_job', {
          p_user_id: user.id,
          p_source: 'garmin_zip',
          p_object_key: objectKey,
        } as any)

      if (regError) {
        logError('Register job error:', regError.message)
        return NextResponse.json({ error: `Job registration failed: ${regError.message}` }, { status: 500 })
      }
      
      if (!jobId) {
        logError('No job ID returned from register_import_job')
        return NextResponse.json({ error: 'Job registration failed: No job ID returned' }, { status: 500 })
      }
      
      log('Success! Job ID:', jobId)
      return NextResponse.json({ ok: true, objectKey, jobId }, { status: 200 })
    } catch (e: unknown) {
      const err = e as Error
      logError('Exception:', err.message)
      if (isDev && err.stack) {
        logError('Stack trace:', err.stack)
      }
      return NextResponse.json({ 
        error: err?.message || 'Upload failed',
        details: isDev ? err.stack : undefined
      }, { status: 500 })
    }
  } catch (outerError: unknown) {
    const err = outerError as Error
    logError('Outer exception (before auth):', err.message)
    if (isDev && err.stack) {
      logError('Outer stack trace:', err.stack)
    }
    return NextResponse.json({ 
      error: 'Failed to initialize request',
      details: isDev ? err.stack : undefined
    }, { status: 500 })
  }
}


