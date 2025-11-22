'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'

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

  const onUpload = React.useCallback(async () => {
    if (!file) return
    setProgress(0)
    setStatus('Uploading…')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)

      const r = await fetch('/api/health/import/upload', {
        method: 'POST',
        body: form,
      })
      if (!r.ok) {
        let errMsg = `HTTP ${r.status}`
        try {
          const json = await r.json()
          errMsg = json.error || errMsg
        } catch {
          const text = await r.text()
          errMsg = text || errMsg
        }
        throw new Error(errMsg)
      }
      const json = await r.json()
      setResult(json)
      setStatus('Uploaded. Import job queued.')
      setProgress(100)
    } catch (e: unknown) {
      const err = e as Error
      console.error('Upload error:', err)
      setStatus(err?.message || 'Upload failed')
    }
  }, [file])

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


