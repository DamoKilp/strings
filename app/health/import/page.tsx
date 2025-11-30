'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { supabase } from '@/utils/supabase/client'

export default function HealthImportPage() {
  const [dragOver, setDragOver] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [progress, setProgress] = React.useState<number>(0)
  const [status, setStatus] = React.useState<string>('')
  const [result, setResult] = React.useState<{ ok: boolean; objectKey: string; jobId: string } | null>(null)

  const onDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }, [])

  const onPick = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }, [])

  // Validate ZIP file by checking magic bytes
  const validateZipFile = React.useCallback(async (file: File): Promise<boolean> => {
    const arrayBuffer = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    
    if (bytes.length < 4) return false
    
    const magicBytes = [
      bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04, // PK\x03\x04
      bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x05 && bytes[3] === 0x06, // PK\x05\x06
      bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x07 && bytes[3] === 0x08, // PK\x07\x08
    ]
    
    return magicBytes.some(Boolean)
  }, [])

  const onUpload = React.useCallback(async () => {
    if (!file) return
    
    setProgress(0)
    setStatus('Validating file...')
    setResult(null)
    
    try {
      // Client-side validation
      const fileName = file.name || 'upload.zip'
      if (!fileName.toLowerCase().endsWith('.zip')) {
        throw new Error('Only .zip uploads are supported')
      }

      const maxSize = 500 * 1024 * 1024 // 500MB
      if (file.size > maxSize) {
        throw new Error(`File too large. Max 500MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      }

      if (file.size < 22) {
        throw new Error('File is too small to be a valid ZIP archive')
      }

      // Validate ZIP magic bytes
      const isValidZip = await validateZipFile(file)
      if (!isValidZip) {
        throw new Error('Invalid ZIP file. File does not appear to be a valid ZIP archive.')
      }

      // Step 1: Get signed upload URL
      setStatus('Preparing upload...')
      setProgress(10)
      
      const urlResponse = await fetch('/api/health/import/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      })

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json().catch(() => ({ error: `HTTP ${urlResponse.status}` }))
        throw new Error(errorData.error || 'Failed to get upload URL')
      }

      const { signedUrl, token, objectKey } = await urlResponse.json()
      
      if (!signedUrl || !token || !objectKey) {
        throw new Error('Invalid response from server')
      }

      // Step 2: Upload directly to Supabase Storage
      setStatus('Uploading to storage...')
      setProgress(20)

      // Note: Supabase uploadToSignedUrl doesn't support progress callbacks
      // We'll simulate progress based on file size and upload time
      const uploadStartTime = Date.now()
      let progressInterval: ReturnType<typeof setInterval> | null = null
      
      try {
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - uploadStartTime
          // Estimate: assume 10MB/s upload speed, cap at 90%
          const estimatedProgress = Math.min(20 + (elapsed / 1000) * 5, 90)
          setProgress(Math.round(estimatedProgress))
        }, 500)

        console.log('Starting upload to Supabase Storage...', { objectKey, fileSize: file.size })
        
        const uploadResult = await supabase.storage
          .from('imports')
          .uploadToSignedUrl(objectKey, token, file)

        if (progressInterval) {
          clearInterval(progressInterval)
          progressInterval = null
        }

        console.log('Upload result:', { error: uploadResult.error, data: uploadResult.data })

        if (uploadResult.error) {
          throw new Error(`Upload failed: ${uploadResult.error.message}`)
        }
      } catch (uploadErr: unknown) {
        if (progressInterval) {
          clearInterval(progressInterval)
          progressInterval = null
        }
        // Re-throw to be caught by outer catch block
        if (uploadErr instanceof Error) {
          throw uploadErr
        }
        throw new Error('Upload failed with unknown error')
      }

      // Step 3: Register import job
      setStatus('Registering import job...')
      setProgress(90)

      const registerResponse = await fetch('/api/health/import/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey }),
      })

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({ error: `HTTP ${registerResponse.status}` }))
        throw new Error(errorData.error || 'Failed to register import job')
      }

      const registerData = await registerResponse.json()
      
      setResult(registerData)
      setStatus('Uploaded. Import job queued.')
      setProgress(100)
    } catch (e: unknown) {
      const err = e as Error
      console.error('Upload error:', err)
      
      // Handle specific error types
      if (err.name === 'AbortError') {
        setStatus('Upload was cancelled or interrupted. Please try again.')
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setStatus('Network error - please check your connection and try again.')
      } else {
        setStatus(err?.message || 'Upload failed')
      }
      setProgress(0)
    }
  }, [file, validateZipFile])

  return (
    <div className="container mx-auto py-8">
      <Card className="bg-background/60 backdrop-blur border">
        <CardHeader>
          <CardTitle>Import Garmin ZIP</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? 'border-primary/70 bg-primary/5' : 'border-border'}`}
          >
            <div className="space-y-3">
              <div className="text-sm opacity-80">Drop your Garmin export .zip here</div>
              <div className="text-xs opacity-60">No need to extract. We will process it in the background.</div>
              <div>
                <input id="zip-input" type="file" accept=".zip" className="hidden" onChange={onPick} />
                <Button type="button" onClick={() => document.getElementById('zip-input')?.click()}>Choose file</Button>
              </div>
              {file && (
                <div className="text-xs opacity-80">Selected: {file.name}</div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="button" disabled={!file} onClick={onUpload}>Upload</Button>
            <div className="flex-1">
              <Progress value={progress} />
            </div>
            <div className="text-xs opacity-70">{status}</div>
          </div>

          {result && (
            <div className="mt-4 text-xs opacity-80">
              Stored as <code>{result.objectKey}</code>; job <code>{result.jobId}</code>
            </div>
          )}

          <div className="mt-8 space-y-2">
            <Label>Nudge window</Label>
            <div className="text-xs opacity-70">08:00–21:00 (default). You can change this later in Settings.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


