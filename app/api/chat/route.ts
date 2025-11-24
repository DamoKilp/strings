import { NextRequest } from 'next/server'
import { streamText, type CoreMessage, tool, jsonSchema } from 'ai'
import type { LanguageModel } from 'ai'
import type { LLMModel, LLMModelConfig } from '@/lib/models'
import { getModelClient } from '@/lib/models'
import { createClient } from '@/utils/supabase/server'
import type { JSONSchema7 } from '@ai-sdk/provider'

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

  // Define memory creation tool using raw JSON Schema
  // NOTE: Currently disabled due to empty response issue with certain models (e.g., GPT-5.1)
  // The jsonSchema() approach should work but there may be model-specific issues
  // Voice chat works because it uses a different API (Realtime API) with different tool format
  const createMemoryJsonSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The memory content to store. Should be a clear, concise fact about the user (e.g., "User prefers to be called Sir", "User has two kids: Josh (2007) and Troy (2013)", "User is trying to get back in shape after running a marathon in 2019")'
      },
      category: {
        type: 'string',
        enum: ['personal', 'work', 'family', 'fitness', 'preferences', 'projects', 'protocol', 'protocols', 'other'],
        description: 'Category for organizing the memory. Use "protocol" or "protocols" for voice protocols/instructions.'
      },
      importance: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Importance level from 1 (low) to 10 (critical). Use 5-7 for general facts, 8-9 for important preferences, 10 for critical information.'
      }
    },
    required: ['content']
  }

  const createMemoryTool = tool({
    description: 'Store a memory about the user for future conversations. Use this when the user shares personal information, preferences, important facts, or things you should remember about them.',
    inputSchema: jsonSchema(createMemoryJsonSchema),
    execute: async ({ content, category, importance }: { content: string; category?: string; importance?: number }) => {
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

  // Tool is now properly defined using jsonSchema() to avoid Zod serialization bug
  // Re-enabled with comprehensive logging to debug tool execution
  let result
  try {
    result = await streamText({ 
      model: languageModel, 
      messages: finalMessages, 
      tools: {
        create_memory: createMemoryTool
      },
      ...(parameters || {}) 
    })
    
    // Log tool-related information from result
    console.log('[Chat API] streamText result:', {
      hasTextStream: !!result.textStream,
      hasToolCalls: 'toolCalls' in result,
      hasFullStream: 'fullStream' in result,
    })
  } catch (error) {
    console.error('[Chat API] Error with tools:', error)
    if (error instanceof Error) {
      console.error('[Chat API] Error details:', error.message, error.stack)
    }
    // Fallback to chat without tools
    result = await streamText({ 
      model: languageModel, 
      messages: finalMessages, 
      ...(parameters || {}) 
    })
  }

  ;(async () => {
    try {
      let chunkCount = 0
      
      // Stream text deltas - the Vercel AI SDK automatically handles tool execution
      // Tool calls and results are included in the stream automatically
      for await (const chunk of result.textStream) {
        chunkCount++
        await writer.write(encoder.encode(`0:${JSON.stringify(chunk)}\n`))
      }
      
      // After streaming, check for tool calls in the result
      // Note: Tool execution happens automatically during streaming
      if ('toolCalls' in result && Array.isArray(result.toolCalls)) {
        console.log('[Chat API] Tool calls detected:', result.toolCalls.length)
        result.toolCalls.forEach((toolCall: any) => {
          console.log('[Chat API] Tool call:', toolCall.toolName, toolCall.args)
        })
      }
      
      // Log summary
      console.log('[Chat API] Stream complete:', {
        chunkCount,
        empty: chunkCount === 0,
        hasToolCalls: 'toolCalls' in result && Array.isArray(result.toolCalls) && result.toolCalls.length > 0
      })
      
      if (chunkCount === 0) {
        console.warn('[Chat API] No chunks received from stream - empty response')
        // Even if text is empty, tool execution might have happened
        if ('toolCalls' in result && Array.isArray(result.toolCalls) && result.toolCalls.length > 0) {
          console.log('[Chat API] Empty text but tools were called - this is expected behavior')
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'stream error'
      console.error('[Chat API] Stream error:', errorMessage, err)
      try { await writer.write(encoder.encode(`3:${JSON.stringify({ error: errorMessage })}\n`)) } catch {}
    } finally {
      try { await writer.close() } catch {}
    }
  })()

  const headers = new Headers()
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  return new Response(stream.readable, { headers })
}






