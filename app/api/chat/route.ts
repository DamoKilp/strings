import { NextRequest } from 'next/server'
import { streamText, type CoreMessage, tool } from 'ai'
import type { LanguageModel } from 'ai'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import { getModelClient } from '@/lib/models'
import { createClient } from '@/utils/supabase/server'

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
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'unknown'
    return new Response(JSON.stringify({ error: `Model init failed: ${errorMessage}` }), { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const finalMessages: CoreMessage[] = []
  if (systemPrompt?.trim()) finalMessages.push({ role: 'system', content: systemPrompt.trim() })
  finalMessages.push(...messages)

  // Define memory creation tool
  const createMemoryTool = tool({
    description: 'Store a memory about the user for future conversations. Use this when the user shares personal information, preferences, important facts, or things you should remember about them.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to store. Should be a clear, concise fact about the user (e.g., "User prefers to be called Sir", "User has two kids: Josh (2007) and Troy (2013)", "User is trying to get back in shape after running a marathon in 2019")'
        },
        category: {
          type: 'string',
          enum: ['personal', 'work', 'family', 'fitness', 'preferences', 'projects', 'other'],
          description: 'Category for organizing the memory'
        },
        importance: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Importance level from 1 (low) to 10 (critical). Use 5-7 for general facts, 8-9 for important preferences, 10 for critical information.'
        }
      },
      required: ['content']
    },
    execute: async ({ content, category, importance }) => {
      try {
        // Get authenticated user
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          return { success: false, error: 'Unauthorized' }
        }

        // Create memory via API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/memories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            category: category || null,
            importance: importance || 5
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to create memory' }))
          return { success: false, error: errorData.error || 'Failed to create memory' }
        }

        const data = await response.json()
        return { 
          success: true, 
          message: `Memory stored successfully: "${content}"`,
          memoryId: data.memory?.id 
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
      }
    }
  })

  const result = await streamText({ 
    model: languageModel, 
    messages: finalMessages, 
    tools: {
      create_memory: createMemoryTool
    },
    ...(parameters || {}) 
  })

  ;(async () => {
    try {
      // Stream text deltas - the Vercel AI SDK automatically handles tool execution
      // Tool calls and results are included in the stream automatically
      for await (const chunk of result.textStream) {
        await writer.write(encoder.encode(`0:${JSON.stringify(chunk)}\n`))
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'stream error'
      try { await writer.write(encoder.encode(`3:${JSON.stringify({ error: errorMessage })}\n`)) } catch {}
    } finally {
      try { await writer.close() } catch {}
    }
  })()

  const headers = new Headers()
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  return new Response(stream.readable, { headers })
}





