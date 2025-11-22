import { NextRequest } from 'next/server'
import { streamText, type CoreMessage } from 'ai'
import type { LanguageModel } from 'ai'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import { getModelClient } from '@/lib/models'

type ChatApiRequestBody = {
  messages: CoreMessage[]
  model: LLMModel
  parameters?: Record<string, unknown>
  systemPrompt?: string
}

function getApiKeyForProvider(providerId: string): string | undefined {
  const env: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    groq: 'GROQ_API_KEY',
    togetherai: 'TOGETHER_API_KEY',
    fireworks: 'FIREWORKS_API_KEY',
    xai: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  }
  const key = env[providerId]
  return key ? process.env[key] : undefined
}

export async function POST(req: NextRequest) {
  let body: ChatApiRequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const { messages, model, parameters, systemPrompt } = body
  if (!Array.isArray(messages) || !model?.providerId || !model?.id) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
  }

  const apiKey = getApiKeyForProvider(model.providerId)
  if (!apiKey && !['ollama', 'vertex'].includes(model.providerId)) {
    return new Response(JSON.stringify({ error: `Missing API key for provider ${model.providerId}` }), { status: 500 })
  }

  let languageModel: LanguageModel
  try {
    const config: LLMModelConfig = apiKey ? { apiKey } : {}
    languageModel = getModelClient(model, config)
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Model init failed: ${e?.message || 'unknown'}` }), { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const finalMessages: CoreMessage[] = []
  if (systemPrompt?.trim()) finalMessages.push({ role: 'system', content: systemPrompt.trim() })
  finalMessages.push(...messages)

  const result = await streamText({ model: languageModel, messages: finalMessages, ...(parameters || {}) })

  ;(async () => {
    try {
      const r: any = result
      const textStream: AsyncIterable<string> | undefined = r.textStream
      if (textStream && Symbol.asyncIterator in Object(textStream)) {
        for await (const delta of textStream) {
          await writer.write(encoder.encode(`0:${JSON.stringify(delta)}\n`))
        }
      } else {
        const fullText: string | undefined = r.text
        if (typeof fullText === 'string') {
          await writer.write(encoder.encode(`0:${JSON.stringify(fullText)}\n`))
        }
      }
    } catch (err: any) {
      try { await writer.write(encoder.encode(`3:${JSON.stringify({ error: err?.message || 'stream error' })}\n`)) } catch {}
    } finally {
      try { await writer.close() } catch {}
    }
  })()

  const headers = new Headers()
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  return new Response(stream.readable, { headers })
}





