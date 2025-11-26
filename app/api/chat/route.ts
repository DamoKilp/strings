import { NextRequest } from 'next/server'
import { streamText, type CoreMessage, tool, jsonSchema } from 'ai'
import type { LanguageModel } from 'ai'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import { getModelClient } from '@/lib/models'
import { createClient } from '@/utils/supabase/server'

type ChatApiRequestBody = {
  messages: CoreMessage[]
  model: LLMModel
  parameters?: Record<string, unknown>
  systemPrompt?: string
  memoriesEnabled?: boolean
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
  const { messages, model, parameters, systemPrompt, memoriesEnabled = true } = body
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

  const finalMessages: CoreMessage[] = []
  if (systemPrompt?.trim()) finalMessages.push({ role: 'system', content: systemPrompt.trim() })
  finalMessages.push(...messages)

  // Get authenticated user once for the request
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // Define memory creation tool using jsonSchema helper
  const createMemoryTool = tool({
    description: 'Store a memory about the user for future conversations. Use this when the user shares personal information, preferences, important facts, or things you should remember about them. After storing a memory, confirm to the user what was stored.',
    inputSchema: jsonSchema<{ content: string; category?: string; importance?: number }>({
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to store. Should be a clear, concise fact about the user.'
        },
        category: {
          type: 'string',
          enum: ['personal', 'work', 'family', 'fitness', 'preferences', 'projects', 'protocol', 'protocols', 'other'],
          description: 'Category for organizing the memory.'
        },
        importance: {
          type: 'number',
          description: 'Importance level from 1 (low) to 10 (critical).'
        }
      },
      required: ['content']
    }),
    execute: async ({ content, category, importance }: { content: string; category?: string; importance?: number }) => {
      console.log('[Chat API] create_memory tool called:', { content, category, importance })
      try {
        if (authError || !user) {
          console.log('[Chat API] create_memory: Unauthorized')
          return { success: false, error: 'Unauthorized - please sign in to save memories' }
        }

        const importanceValue = importance 
          ? Math.max(1, Math.min(10, importance))
          : 5

        // Create memory directly via Supabase
        const { data, error } = await supabase
          .from('memories')
          .insert({
            user_id: user.id,
            content: content.trim(),
            category: category || null,
            importance: importanceValue,
          })
          .select()
          .single()

        if (error) {
          console.log('[Chat API] create_memory: DB error', error.message)
          return { success: false, error: error.message }
        }

        console.log('[Chat API] create_memory: Success', data?.id)
        return { 
          success: true, 
          message: `Memory stored: "${content}"`,
          memoryId: data?.id 
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Chat API] create_memory: Exception', errorMessage)
        return { success: false, error: errorMessage }
      }
    }
  })

  // Stream the response manually (compatible with client's 0: prefix parser)
  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  // Start streaming in the background
  ;(async () => {
    try {
      // Only include memory tool if memories are enabled
      const tools = memoriesEnabled ? { create_memory: createMemoryTool } : undefined
      
      const result = streamText({ 
        model: languageModel, 
        messages: finalMessages, 
        ...(tools && { tools }),
        // Continue until the model responds with text (no more tool calls)
        // Check the LAST step's finish reason - stop when it's 'stop' (text completion)
        stopWhen: ({ steps }: { steps: any[] }) => {
          const lastStep = steps[steps.length - 1];
          console.log('[Chat API] stopWhen check:', { 
            stepCount: steps.length, 
            lastFinishReason: lastStep?.finishReason 
          });
          // Stop when the last step finished with 'stop' (text) rather than 'tool-calls'
          return lastStep?.finishReason === 'stop';
        },
        maxSteps: 5, // Safety limit
        ...(parameters || {})
      } as any)

      // Use fullStream to capture both text and tool events
      // This ensures we see tool calls and their results
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          // Only stream non-empty text deltas (AI SDK v5 uses 'text' property)
          const textContent = (part as any).text || (part as any).textDelta
          if (textContent) {
            await writer.write(encoder.encode(`0:${JSON.stringify(textContent)}\n`))
          }
        } else if (part.type === 'tool-call') {
          console.log('[Chat API] Tool call:', part.toolName, JSON.stringify(part))
        } else if (part.type === 'tool-result') {
          console.log('[Chat API] Tool result:', part.toolName, JSON.stringify(part))
        } else if (part.type === 'error') {
          console.error('[Chat API] Stream part error:', (part as any).error)
        } else if ((part as any).type === 'step-finish') {
          console.log('[Chat API] Step finished:', (part as any).finishReason)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'stream error'
      console.error('[Chat API] Stream error:', errorMessage)
      try { 
        await writer.write(encoder.encode(`3:${JSON.stringify({ error: errorMessage })}\n`)) 
      } catch {}
    } finally {
      try { await writer.close() } catch {}
    }
  })()

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}






