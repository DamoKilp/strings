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

type ProjectInfoResult = {
  projectPath: string
  readme: string | null
  packageJson: {
    name?: string
    version?: string
    description?: string
    scripts?: string[]
    dependencies?: string[]
    devDependencies?: string[]
  } | null
  structure: {
    name: string
    type: 'dir' | 'file'
  }[]
}

type ReadCodeFileResult = {
  path: string
  content: string
  size: number
}

type GitRecentChangesResult = {
  branch: string
  recentCommits: string[]
  uncommittedChanges: string[]
}

type SearchCodeMatch = {
  file: string
  match: string
}

type SearchCodeResult = {
  query: string
  matchCount: number
  matches: SearchCodeMatch[]
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

  const codeToolsUrl = new URL('/api/code-tools', req.url)

  async function callCodeTool<TResult>(
    action: 'get_project_info' | 'read_code_file' | 'git_recent_changes' | 'search_code',
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: TResult; error?: string }> {
    try {
      const response = await fetch(codeToolsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...input }),
      })

      const data = await response.json() as { success?: boolean; result?: TResult; error?: string }

      if (!response.ok || !data?.success) {
        const errorMessage = data?.error || `Code tool "${action}" failed with status ${response.status}`
        console.error('[Chat API] code tool error', { action, status: response.status, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      return { success: true, result: data.result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Chat API] code tool exception', { action, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

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

  // Code/Git tools that proxy through the /api/code-tools route
  const getProjectInfoTool = tool({
    description: 'Get information about a local code project (README excerpt, package.json summary, and top-level structure). Use when the user asks about their apps or repositories like "Strings" or "VentiaAM".',
    inputSchema: jsonSchema<{ projectPath: string }>({
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path or shortcut for the project. Use "strings" for the Strings app, "ventiaam" for the Asset Management app, or an absolute path on disk.',
        }
      },
      required: ['projectPath']
    }),
    execute: async ({ projectPath }: { projectPath: string }) => {
      return callCodeTool<ProjectInfoResult>('get_project_info', { projectPath })
    }
  })

  const readCodeFileTool = tool({
    description: 'Read a specific code file from a local project. Use when the user asks about specific files, components, or code.',
    inputSchema: jsonSchema<{ filePath: string; projectPath?: string }>({
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to read. Can be relative to a project or an absolute path.',
        },
        projectPath: {
          type: 'string',
          description: 'Optional project base path. If provided, filePath is treated as relative to this path (e.g., "strings").',
        }
      },
      required: ['filePath']
    }),
    execute: async ({ filePath, projectPath }: { filePath: string; projectPath?: string }) => {
      const payload: Record<string, unknown> = { filePath }
      if (projectPath && projectPath.trim()) {
        payload.projectPath = projectPath.trim()
      }
      return callCodeTool<ReadCodeFileResult>('read_code_file', payload)
    }
  })

  const gitRecentChangesTool = tool({
    description: 'Get recent git commits and current uncommitted changes for a project. Use when the user asks what they have been working on recently.',
    inputSchema: jsonSchema<{ projectPath: string; limit?: number }>({
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path or shortcut for the git repository (for example "strings" or "ventiaam").',
        },
        limit: {
          type: 'number',
          description: 'Optional number of recent commits to return (default is 10).',
        }
      },
      required: ['projectPath']
    }),
    execute: async ({ projectPath, limit }: { projectPath: string; limit?: number }) => {
      const payload: Record<string, unknown> = { projectPath }
      if (typeof limit === 'number') {
        payload.limit = limit
      }
      return callCodeTool<GitRecentChangesResult>('git_recent_changes', payload)
    }
  })

  const searchCodeTool = tool({
    description: 'Search for text or simple patterns in code files within a project. Use when the user asks where something is defined or to find usages.',
    inputSchema: jsonSchema<{ query: string; projectPath: string; filePattern?: string }>({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The text or pattern to search for in code files.',
        },
        projectPath: {
          type: 'string',
          description: 'Path or shortcut for the project to search in (for example "strings").',
        },
        filePattern: {
          type: 'string',
          description: 'Optional file glob pattern to narrow the search (e.g., "*.tsx,*.ts"). Defaults to common code files.',
        }
      },
      required: ['query', 'projectPath']
    }),
    execute: async ({ query, projectPath, filePattern }: { query: string; projectPath: string; filePattern?: string }) => {
      const payload: Record<string, unknown> = { query, projectPath }
      if (filePattern && filePattern.trim()) {
        payload.filePattern = filePattern.trim()
      }
      return callCodeTool<SearchCodeResult>('search_code', payload)
    }
  })

  // Stream the response manually (compatible with client's 0: prefix parser)
  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  // Start streaming in the background
  ;(async () => {
    try {
      const tools: Record<string, unknown> = {
        get_project_info: getProjectInfoTool,
        read_code_file: readCodeFileTool,
        git_recent_changes: gitRecentChangesTool,
        search_code: searchCodeTool,
      }

      if (memoriesEnabled) {
        tools.create_memory = createMemoryTool
      }
      
      const result = streamText({ 
        model: languageModel, 
        messages: finalMessages, 
        tools,
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






