// /lib/types.ts
import { Buffer } from 'buffer';
import {
  CoreMessage,
  ImagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreSystemMessage,
  CoreToolMessage,
  UserContent,
  AssistantContent,
  ToolContent,
  } from 'ai';

// --- DEFAULT PARAMETER VALUES ---
export const DEFAULT_TEMPERATURE = 1.0;
export const DEFAULT_TOP_P = 1.0;
export const DEFAULT_FREQUENCY_PENALTY = 0.0;
export const DEFAULT_PRESENCE_PENALTY = 0.0;
// -----------------------------

// Define FileAttachment interface
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

// Define ReasoningLevel type
export type ReasoningLevel = 'off' | 'low' | 'medium' | 'high';
export const DEFAULT_REASONING_LEVEL: ReasoningLevel = 'off';

// Define TableSearchSettings interface
export interface TableSearchSettings {
  searchMode: 'basic' | 'thorough' | 'exhaustive' | 'ultimate' | 'custom';
  targetTable: 'all' | string; // NEW: Specific table name or 'all' for all tables
  projectId?: string; // NEW: Selected project ID for filtering
  maxTablesSearched: number;
  maxRowsPerTable: number;
  maxResultsReturned: number;
  enableSemanticMatching: boolean;
  prioritizeRecentData: boolean;
  includeSystemTables: boolean;
  includeAllRows?: boolean; // NEW: When true, bypass search-term filtering and return up to maxRowsPerTable
}
// -------------------------------

// Define MessageRole type
export type MessageRole = 'user' | 'assistant' | 'system' | 'function' | 'tool' | 'data';

// Define ChatMessage interface
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: string | URL }
      >;
  createdAt: Date;
  conversationId: string;
  userId?: string;
  metadata?: unknown | null;
  name?: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
  }>;
  toolResult?: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
  };
  files?: FileAttachment[]; // Assuming FileAttachment is still relevant
}

// Define ConversationSummary interface
export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isLocal: boolean;
  modelUsed?: string | null;
  summary?: string | null;
  firstMessagePreview?: string | null;
}

// Define Conversation interface extending ConversationSummary
export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

// Define LLMModel type
export type LLMModel = {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  multiModal?: boolean;
  canSearch?: boolean;
  canGenerateImages?: boolean;
  isAdvancedReasoner?: boolean;
  supportsReasoning?: boolean;
  defaultPrePromptId?: string;
};

// Define IStorageService interface
export interface IStorageService {
  updateConversationModel(
    id: string,
    modelId: string,
    userId: string,
    isLocal: boolean
  ): Promise<void>;
  getConversationList(
    userId: string,
    cursor?: string | null,
    limit?: number
  ): Promise<{ items: ConversationSummary[]; nextCursor: string | null }>;
  getConversation(id: string, userId: string): Promise<Conversation | null>;
  createConversation(
    userId: string,
    isLocal: boolean,
    title?: string,
    firstMessage?: ChatMessage,
    modelId?: string | null
  ): Promise<ConversationSummary | null>;
  addMessage(
    conversationId: string,
    message: ChatMessage,
    userId: string,
    isLocal: boolean
  ): Promise<void>;
  updateConversationTitle(
    id: string,
    title: string,
    userId: string,
    isLocal: boolean
  ): Promise<void>;
  deleteConversation(
    id: string,
    userId: string,
    isLocal: boolean
  ): Promise<void>;
  clearAllConversations(
    userId: string,
    scope: 'local' | 'remote' | 'all'
  ): Promise<void>;
  clearLocalConversations(userId: string): Promise<void>;
  clearRemoteConversations(userId: string): Promise<void>;
  generateLocalId(): string;
  deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    isLocal: boolean
  ): Promise<void>;
}

// Define AuthUser type
export interface AuthUser {
  id: string;
  email?: string;
}

// --- MODIFIED: Add selectedPrePromptId to ChatState ---
export interface ChatState {
  user: AuthUser | null;
  activeConversationId: string | null;
  activeConversationIsLocal: boolean;
  currentMessages: ChatMessage[];
  conversationList: ConversationSummary[];
  isLoadingUser: boolean;
  isLoadingConversationList: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  llmModel: LLMModel;
  initialConversationCreated: boolean;
  temperature: number;
  selectedModel: { supportsReasoning: boolean } | null;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  reasoningLevel: ReasoningLevel;
  selectedPrePromptId: string;
  projectName: string | null;
  vectorSearchEnabled: boolean;
  tableSearchEnabled: boolean; // NEW: Table search toggle state
  webSearchEnabled: boolean; // NEW: Web search toggle state
  memoriesEnabled: boolean; // Memory feature toggle
  tableSearchSettings: TableSearchSettings; // NEW: Table search configuration
  conversationCursor: string | null;
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;
  // Chat UI preferences
  chatFontSize: ChatFontSize;
  // Agent Manager feature
  customAgents: AgentDefinition[];
  agentPreferences: AgentPreference[];

}

// --- MODIFIED: Add setSelectedPrePromptId action to ChatActions ---
export interface ChatActions {
  selectConversation: (id: string, isLocal: boolean) => Promise<void>;
  setReasoningLevel: (level: ReasoningLevel) => void;
  createNewConversation: (
    storageType: 'local' | 'cloud',
    switchToNew?: boolean
  ) => Promise<ConversationSummary | null>;
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  // --- Bulk delete support ---
  deleteConversationsBulk: (ids: string[]) => Promise<void>;
  setLLMModel: (model: LLMModel) => void;
  refreshConversationList: () => Promise<void>;
  clearConversations: (scope: 'local' | 'remote' | 'all') => Promise<void>;
  resetLoadingState: () => void;
  stopGenerating: () => void;
  setTemperature: (value: number) => void;
  setTopP: (value: number) => void;
  setFrequencyPenalty: (value: number) => void;
  setPresencePenalty: (value: number) => void;
  resetModelParameters: () => void;
  setSelectedPrePromptId: (promptId: string) => void;
  toggleVectorSearch: () => void;
  toggleTableSearch: () => void; // NEW: Table search toggle action
  toggleWebSearch: () => void; // NEW: Web search toggle action
  toggleMemories: () => void; // Memory feature toggle action
  setTableSearchSettings: (settings: TableSearchSettings) => void; // NEW: Table search settings action
  loadMoreConversations: () => Promise<void>;
  setChatFontSize: (size: ChatFontSize) => void;
  deleteMessage: (messageId: string) => Promise<void>;
}

// Chat font size scale for message bubbles
export type ChatFontSize = 'xs' | 's' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

// Define ChatContextProps interface
export interface ChatContextProps extends ChatState {
  actions: ChatActions;
}

// --- Agent Manager Types ---
// Global per-user custom agents and preferences
export interface AgentDefinition {
  id: string; // uuid for custom agents; for built-ins use a generated id string if needed in UI
  name: string;
  description: string;
  content: string; // system prompt
  colorHex: string; // e.g., '#6366F1'
  iconKey: string; // lucide-react icon name, e.g., 'Bot', 'Database'
  isBuiltin?: boolean; // true for prePrompts
}

export interface AgentPreference {
  userId: string;
  // Use exactly one of these to reference the agent
  agentId?: string; // for custom agents (uuid)
  agentBuiltinId?: string; // for built-ins: uses PrePrompt.id
  isEnabled: boolean;
  sortOrder: number;
}

// Define MessageContentPart type (Consider CoreMessage parts compatibility)
export type MessageContentPart = TextPart | ImagePart; // Align with Vercel AI SDK types

const toToolResultOutput = (result: unknown, isError?: boolean): ToolResultPart['output'] => {
  const normalized = result instanceof Error ? result.message : result;
  const value = typeof normalized === 'string' ? normalized : JSON.stringify(normalized ?? '');
  return { type: isError ? 'error-text' : 'text', value };
};
// --- Vercel AI SDK CoreMessage compatible type helper ---
export function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.map((message): CoreMessage => {
    let mappedRole: CoreMessage["role"];
    if (message.role === 'function' || message.role === 'data') {
      mappedRole = 'tool';
    } else if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
      mappedRole = message.role;
    } else {

      mappedRole = 'user'; // Default or throw error
    }

    if (mappedRole === 'tool') {
      const toolContent: ToolContent = message.toolResult
        ? [
            {
              type: 'tool-result',
              toolCallId: message.toolResult.toolCallId,
              toolName: message.toolResult.toolName,
              output: toToolResultOutput(message.toolResult.result, message.toolResult.isError)
            } satisfies ToolResultPart
          ]
        : [];
      if (toolContent.length === 0) {
        console.warn(
          "ChatMessage with role 'tool'/'function'/'data' is missing toolResult. Creating empty tool message.",
          message
        );
      }
      return { role: 'tool', content: toolContent } satisfies CoreToolMessage;
    }

    if (mappedRole === 'assistant') {
      let assistantContent: AssistantContent;
      const contentParts: Array<TextPart | ToolCallPart> = [];
      let textContent = ''

      if (typeof message.content === 'string') {
        textContent = message.content;
      } else if (Array.isArray(message.content)) {
        const textPart = message.content.find(
          (part): part is { type: 'text'; text: string } => part.type === 'text'
        );
        textContent = textPart?.text || '' ;
        if (message.content.some(part => part.type !== 'text')) {
          console.warn(
            "Assistant ChatMessage content array contained non-text parts. Only text is used for assistant text content unless tool calls are present.",
            message.id
          );
        }
      }

      if (textContent.trim()) {
        contentParts.push({ type: 'text', text: textContent } satisfies TextPart);
      }

      if (message.toolInvocations) {
        message.toolInvocations.forEach(invocation => {
          contentParts.push({
            type: 'tool-call',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            input: invocation.args
          } satisfies ToolCallPart);
        });
      }

      if (contentParts.length === 1 && contentParts[0].type === 'text') {
        assistantContent = contentParts[0].text; // Prefer string if only text
      } else if (contentParts.length > 0) {
        assistantContent = contentParts; // Use array if multiple parts or tool calls
      } else {
        assistantContent = '' // Empty string if no content
      }
      return { role: 'assistant', content: assistantContent } satisfies CoreAssistantMessage;
    }

    if (mappedRole === 'user') {
      let userContent: UserContent;
      const contentParts: Array<TextPart | ImagePart> = [];

      if (typeof message.content === 'string') {
        if (message.content.trim()) {
          contentParts.push({ type: 'text', text: message.content } satisfies TextPart);
        }
      } else if (Array.isArray(message.content)) {
        message.content.forEach(part => {
          if (part.type === 'text' && part.text.trim()) {
            contentParts.push({ type: 'text', text: part.text } satisfies TextPart);
          } else if (part.type === 'image') {
            if (typeof part.image === 'string' || part.image instanceof URL) {
              contentParts.push({ type: 'image', image: part.image } satisfies ImagePart);
            }
          }
        });
      } else {
        const stringContent = String(message.content || '')
        if (stringContent.trim()) {
          contentParts.push({ type: 'text', text: stringContent } satisfies TextPart);
        }
      }

      if (contentParts.length === 1 && contentParts[0].type === 'text') {
        userContent = contentParts[0].text; // Prefer string if only text
      } else if (contentParts.length > 0) {
        userContent = contentParts; // Use array if multiple parts (text, images)
      } else {
        userContent = '' // Empty string if no content
      }
      return { role: 'user', content: userContent } satisfies CoreUserMessage;
    }

    // mappedRole === 'system'
    let systemContent = ''
    if (typeof message.content === 'string') {
      systemContent = message.content;
    } else if (Array.isArray(message.content)) {
      const textPart = message.content.find(
          (part): part is { type: 'text'; text: string } => part.type === 'text'
      );
      systemContent = textPart?.text || '' ;
      if (
          message.content.length > 1 ||
          message.content.some(p => p.type !== 'text')
      ) {
        console.warn(
          "System message content was an array or had non-text parts. Only the first text content is used.",
          message
        );
      }
    } else {
      systemContent = String(message.content || '')
    }
    return { role: 'system', content: systemContent } satisfies CoreSystemMessage;
  });
}

// --- Helper to convert Files to Base64 Data URIs ---
export async function filesToDataURIs(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) {
    return [];
  }
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  if (imageFiles.length !== files.length) {
    console.warn(
      "Non-image files were included in the input to filesToDataURIs and have been filtered out." +
      " Only image files will be converted to data URIs."
    );
  }
  if (imageFiles.length === 0) return [];

  return Promise.all(
    imageFiles.map(async file => {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${file.type};base64,${base64}`;
    })
  );
}

// --- Define ModelParameters type ---
export type ModelParameters = {
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxTokens?: number;
};

// --- Ingestion Process Result Types (integrated) ---
export type DetailedResultStatus =
  | 'success'
  | 'partial_failure_embedding'
  | 'partial_failure_storage'
  | 'processed_no_store'
  | 'failed_navigation'
  | 'failed_extraction'
  | 'failed_unexpected'
  | 'skipped_redirect'
  | 'skipped_non_html'
  | 'skipped_no_valid_content'
  | 'skipped_chunking_failed'
  | 'skipped_existing'
  | 'failed_unknown';

export interface ResultsSummary {
  totalRequested: number;
  processed: number;          // URLs where content extraction succeeded
  embedded: number;           // Chunks successfully embedded
  stored: number;             // Chunks successfully stored
  failed_navigation: number;
  failed_extraction: number;
  failed_embedding: number;
  failed_storage: number;
  skipped_redirect: number;
  skipped_non_html: number;
  skipped_no_valid_content: number;
  skipped_chunking_failed: number;
  skipped_existing: number;   // URLs skipped because they already exist
}

export interface DetailedResult {
  url: string;
  status: DetailedResultStatus;
  chunks_processed: number;
  chunks_stored: number;
  title?: string;
  error?: string;
}

// --- New Type Definitions for Ingestion Process ---
export type DiscoveryStatus = "idle" | "active" | "paused" | "stopping" | "stopped" | "completed" | "error";

export type ProcessStatusType = "starting" | "processing" | "completed" | "error";

export type ProcessingStatus = ProcessStatusType | "paused" | "stopped" | "idle";

export interface PageResult {
  id: number;
  url: string;
}

export interface SseMessage {
  type: "url" | "error" | "info" | "done";
  data?: { url?: string; count?: number };
  message?: string;
}





