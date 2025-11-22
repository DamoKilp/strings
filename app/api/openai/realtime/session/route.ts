import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })
  }

  try {
    const { model, voice } = await req.json().catch(() => ({ })) as { model?: string; voice?: string }

    // Minimal validation and safe defaults
    const effectiveModel = (model || '').trim() || 'gpt-realtime'
    const effectiveVoice = (voice || '').trim() || 'coral'

    const body = {
      model: effectiveModel,
      voice: effectiveVoice,
      // Let server indicate capabilities; defaults are fine for WebRTC flow
      // You can add modalities or instructions if needed
      // modalities: ['audio','text'],
      // instructions: language ? `Default language: ${language}` : undefined,
    }

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return NextResponse.json({ error: 'Upstream error', status: r.status, body: text }, { status: 502 })
    }
    const json = await r.json()
    // Return ephemeral session JSON (contains client_secret.value)
    return NextResponse.json(json, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to create session' }, { status: 500 })
  }
}


