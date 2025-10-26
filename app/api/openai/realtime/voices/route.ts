import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Candidate voices (keep in sync with client list)
const CANDIDATE_VOICES = [
  'verse','alloy','aria','amber','breeze','cobalt','coral','charlie','opal','onyx','pearl','sage','nova','marin','cedar'
]

type CacheEntry = { voices: string[]; ts: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function probeVoice(apiKey: string, model: string, voice: string): Promise<boolean> {
  try {
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, voice }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const model = (searchParams.get('model') || '').trim()
  const refresh = searchParams.get('refresh') === '1'
  if (!model) return NextResponse.json({ error: 'Missing model' }, { status: 400 })

  const now = Date.now()
  if (!refresh) {
    const hit = cache.get(model)
    if (hit && now - hit.ts < TTL_MS) {
      return NextResponse.json({ model, voices: hit.voices, cached: true })
    }
  }

  const voices: string[] = []
  // Probe with limited concurrency
  const concurrency = 4
  let i = 0
  const tasks: Promise<void>[] = []
  const run = async (voice: string) => {
    const ok = await probeVoice(apiKey, model, voice)
    if (ok) voices.push(voice)
  }
  const next = async (): Promise<void> => {
    if (i >= CANDIDATE_VOICES.length) return
    const v = CANDIDATE_VOICES[i++]
    await run(v)
    return next()
  }
  for (let k = 0; k < concurrency; k++) tasks.push(next())
  await Promise.all(tasks)

  // Always include 'verse' if empty as a safe default
  const unique = Array.from(new Set(voices.length ? voices : ['verse']))
  cache.set(model, { voices: unique, ts: now })
  return NextResponse.json({ model, voices: unique, cached: false }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}


