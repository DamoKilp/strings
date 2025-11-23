// /components/contexts/ChatProvider.tsx
'use client';

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
// ↓↓ USE THE SINGLETON instead of the legacy factory
import { supabase } from '@/utils/supabase/client';
import { Session } from '@supabase/supabase-js';
import { storageService } from '@/lib/storageService';
import { clearUserDataOnSignOut, forceRedirectToSignIn } from '@/utils/auth/authUtils';
import { useTableSearchSettings } from '@/app/hooks/useTableSearchSettings';
import { useAuth } from '@/app/hooks/useAuth';
// Removed DataWorkbench project store dependency
import type {
  ChatState,
  ChatActions,
  ChatContextProps,
  AuthUser,
  ConversationSummary,
  ChatMessage,
  LLMModel,
  FileAttachment,
  ModelParameters,
  ReasoningLevel,
  TableSearchSettings,
  ChatFontSize
} from '@/lib/types';
import {
  toCoreMessages,
  filesToDataURIs,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_FREQUENCY_PENALTY,
  DEFAULT_PRESENCE_PENALTY,
  DEFAULT_REASONING_LEVEL
} from '@/lib/types';
import modelsData from '@/lib/models.json';
import { v4 as uuidv4 } from 'uuid';
import { CoreMessage, NoImageGeneratedError } from 'ai';
import { compressImagesBatch } from '@/utils/imageUtils';
// --------- TITLE GENERATION UTILITIES (robust + pluggable) ---------
/**
 * Configurable constraints for conversation titles.
 */
const TITLE_MAX_LENGTH = 60;
// Allow only printable ASCII (U+0020 to U+007E), remove some symbols explicitly
const TITLE_ALLOWED_CHARS_REGEX = /[^\u0020-\u007E]|[\[\]{}$<>]/g;

type TitleGenerator = (text: string) => Promise<string>;

let titleGenerator: TitleGenerator | null = null;

/**
 * Pluggable setter for the title generator.
 * Call this in your app to use a custom (e.g., LLM-powered) summarizer.
 */
export function setTitleGenerator(generator: TitleGenerator) {
  titleGenerator = generator;
}

/**
 * Synchronous fallback for generating titles. 
 * Truncates, prefers first sentence, strips unwanted chars.
 */
const STOPWORDS = [
  'the','is','at','which','on','and','a','an','i','me','my','mine','you','your','yours',
  'we','us','our','ours','of','to','in','for','with','by','as','from','it','this','that',
  'these','those','are','was','were','be','been','or','but','so','if','then','do','does',
  'did','has','have','had','can','will','just','about','would','what','who','how','when',
  'where','why','not','too','very','also','all'
];

/**
 * Extract the most "meaningful" sentence from text as a fallback summary.
 */
export function defaultGenerateTitleFromText(message: string): string {
  if (!message) return '';

  // Step 1: Clean and split message into sentences
  let clean = message.replace(/\s+/g, ' ').trim();
  clean = clean.replace(TITLE_ALLOWED_CHARS_REGEX, '').trim();

  // Step 2: Sentence split (simple split for common punctuation)
  const sentences = clean
    .match(/[^\.!\?]+[\.!\?]*\s?/g) // Preseve sentence delimiters
    ?.map(s => s.trim())
    .filter(Boolean) || [clean];

  // Remove trivial greetings, closings, single-word or short filler sentences
  const filtered = sentences.filter(sentence => {
    const sLow = sentence.toLowerCase();
    if (sLow.length < 12) return false; // Too short to mean much
    if (/^(hi|hello|hey|thank you|thanks|cheers)[\.,! ]*$/i.test(sLow)) return false;
    return true;
  });

  // Step 3: Extract keywords from all content
  const allTokens = clean
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(token => token && !STOPWORDS.includes(token));
  const keywords = Array.from(new Set(allTokens)).slice(0, 7);

  // Step 4: Score sentences by number of keywords present
  let bestSentence = filtered[0] || sentences[0] || clean;
  let bestScore = -1;
  for (const sentence of filtered) {
    const tokens = sentence.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const keywordMatches = tokens.filter(token => keywords.includes(token));
    // Prefer sentences with more keywords; break ties via length (shorter = better)
    const score = keywordMatches.length * 10 - Math.abs(sentence.length - TITLE_MAX_LENGTH/1.3);
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  // Step 5: Trim, if needed, to best clause and length
  let trimmed = bestSentence
    // Try to cut at semicolons, commas, "and", etc.
    .replace(/[,;:.]\s.*$/, '')
    .replace(/\b(and|but|so|because)\b.+$/, '')
    .trim();

  if (trimmed.length > TITLE_MAX_LENGTH) {
    trimmed = trimmed.split(' ').slice(0, 11).join(' ');
    trimmed = trimmed.slice(0, TITLE_MAX_LENGTH).trim() + '...';
  }

  let finalTitle = trimmed || "Conversation";
  if (!finalTitle || finalTitle.length < 3) finalTitle = "Conversation";
  return finalTitle;
}

/**
 * Asynchronously generate a robust short title, possibly using an LLM-based summarizer.
 */
export async function generateTitleFromMessage(text: string): Promise<string> {
  // If a custom async generator is registered, use it
  if (titleGenerator) {
    try {
      let result = await titleGenerator(text);
      result = (result || '').replace(TITLE_ALLOWED_CHARS_REGEX, '').trim().slice(0, TITLE_MAX_LENGTH);
      if (result) return result;
    } catch (e) {

    }
  }
  // Fallback: default sync title logic
  return defaultGenerateTitleFromText(text);
}
// ------------------------------------------------------------------

// --- ADDED: Import pre-prompt helpers ---
import { getPrePromptById, getDefaultPrePrompt, DOCUMENT_FIRST_POLICY, TOOL_USE_PREPROMPT, sanitizePromptContent } from '@/components/data/prePrompts';
import type { AgentDefinition, AgentPreference } from '@/lib/types';
// --------------------------------------

// --- Helper function moved outside component ---
// This function doesn't require React hooks and ensures it's visible throughout the file.
function finalizeMessageId(tempId: string, isLocal: boolean): string {
  return isLocal ? storageService.generateLocalId() : uuidv4();
}

/**
 * --- Conversation Settings Persistence ---
 * Persist and restore per-conversation settings (model, vector search, preprompt, parameters)
 */
const LAST_ACTIVE_CHAT_KEY = 'ventiaam_last_active_chat';
const LAST_USED_AGENT_KEY = 'ventiaam_last_used_agent_id';
const CONVO_SETTINGS_PREFIX = 'ventiaam_convo_settings_';
const GLOBAL_SETTINGS_KEY = 'ventiaam_global_model_settings';
const CONVERSATION_PAGE_LIMIT = 30; // Define conversation page fetch limit, match storageService limit

function saveConversationSettings(conversationId: string, settings: Partial<ChatState>) {
  if (!conversationId) return;
  const toSave = {
    llmModelId: settings.llmModel?.id,
    vectorSearchEnabled: settings.vectorSearchEnabled,
    tableSearchEnabled: settings.tableSearchEnabled, // NEW: Save table search state
    webSearchEnabled: settings.webSearchEnabled, // NEW: Save web search state
    selectedPrePromptId: settings.selectedPrePromptId,
    temperature: settings.temperature,
    topP: settings.topP,
    frequencyPenalty: settings.frequencyPenalty,
    presencePenalty: settings.presencePenalty,
    reasoningLevel: settings.reasoningLevel,
  };
  try {
    localStorage.setItem(CONVO_SETTINGS_PREFIX + conversationId, JSON.stringify(toSave));
  } catch (e) {

  }
}

function saveGlobalSettings(settings: Partial<ChatState>) {
  const toSave = {
    llmModelId: settings.llmModel?.id,
    selectedPrePromptId: settings.selectedPrePromptId,
    temperature: settings.temperature,
    topP: settings.topP,
    frequencyPenalty: settings.frequencyPenalty,
    presencePenalty: settings.presencePenalty,
    reasoningLevel: settings.reasoningLevel,
    chatFontSize: settings.chatFontSize,
  } as const;
  try {
    localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(toSave));
  } catch (e) {}
}

function loadGlobalSettings(availableModels: LLMModel[]) {
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const model = availableModels.find(m => m.id === obj.llmModelId) || null;
    return {
      llmModel: model,
      selectedModel: model ? { supportsReasoning: model.supportsReasoning ?? false } : null,
      selectedPrePromptId: obj.selectedPrePromptId,
      temperature: typeof obj.temperature === 'number' ? obj.temperature : undefined,
      topP: typeof obj.topP === 'number' ? obj.topP : undefined,
      frequencyPenalty: typeof obj.frequencyPenalty === 'number' ? obj.frequencyPenalty : undefined,
      presencePenalty: typeof obj.presencePenalty === 'number' ? obj.presencePenalty : undefined,
      reasoningLevel: obj.reasoningLevel,
      chatFontSize: obj.chatFontSize,
    } as Partial<ChatState>;
  } catch (e) { return null; }
}

function loadConversationSettings(conversationId: string, availableModels: LLMModel[]) {
  if (!conversationId) return null;
  try {
    const raw = localStorage.getItem(CONVO_SETTINGS_PREFIX + conversationId);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // Find model by id
    const model = availableModels.find(m => m.id === obj.llmModelId) || null;
      return {
      llmModel: model,
      selectedModel: model ? { supportsReasoning: model.supportsReasoning ?? false } : null,
      vectorSearchEnabled: typeof obj.vectorSearchEnabled === 'boolean' ? obj.vectorSearchEnabled : false,
      tableSearchEnabled: typeof obj.tableSearchEnabled === 'boolean' ? obj.tableSearchEnabled : false,
      webSearchEnabled: typeof obj.webSearchEnabled === 'boolean' ? obj.webSearchEnabled : false,
      selectedPrePromptId: obj.selectedPrePromptId || getDefaultPrePrompt().id,
      temperature: typeof obj.temperature === 'number' ? obj.temperature : DEFAULT_TEMPERATURE,
      topP: typeof obj.topP === 'number' ? obj.topP : DEFAULT_TOP_P,
      frequencyPenalty: typeof obj.frequencyPenalty === 'number' ? obj.frequencyPenalty : DEFAULT_FREQUENCY_PENALTY,
      presencePenalty: typeof obj.presencePenalty === 'number' ? obj.presencePenalty : DEFAULT_PRESENCE_PENALTY,
      reasoningLevel: obj.reasoningLevel || DEFAULT_REASONING_LEVEL,
    };
  } catch (e) {

    return null;
  }
}

// --- Determine Default Model ---
const availableModels: LLMModel[] = modelsData.models as LLMModel[];
const defaultModel =
  availableModels.find((m) => m.id === 'gpt-5.1') ||
  availableModels.find((m) => m.id === 'gpt-5') ||
  availableModels.find((m) => m.providerId === 'openai') ||
  availableModels[0];

if (!defaultModel) {

  // Consider throwing an error or providing a more robust fallback
}

// --- Model-specific default parameters helper ---
function getDefaultParamsForModel(model: LLMModel | null | undefined) {
  if (model && /^gpt-5/.test(model.id)) {
    return {
      temperature: 1.0,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      reasoningLevel: DEFAULT_REASONING_LEVEL as ReasoningLevel,
    };
  }
  return {
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
    presencePenalty: DEFAULT_PRESENCE_PENALTY,
    reasoningLevel: DEFAULT_REASONING_LEVEL as ReasoningLevel,
  };
}

const defaultParams = getDefaultParamsForModel(defaultModel);

// --- Initial selected agent helper: prefer last used if available ---
function getInitialSelectedPrePromptId(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_USED_AGENT_KEY);
      if (stored && (getPrePromptById(stored))) {
        return stored;
      }
    }
  } catch {}
  return getDefaultPrePrompt().id;
}

// --- Define the initial state structure including selectedPrePromptId and pagination fields ---
const initialState: ChatState = {
  selectedModel: null, // TODO: Review if this is needed alongside llmModel
  user: null,
  activeConversationId: null,
  activeConversationIsLocal: false,
  currentMessages: [],
  conversationList: [],
  isLoadingUser: true,
  isLoadingConversationList: false,
  isLoadingMessages: false,
  error: null,
  llmModel: defaultModel || availableModels[0], // Ensure defaultModel has a fallback
  initialConversationCreated: false,
  temperature: defaultParams.temperature,
  topP: defaultParams.topP,
  frequencyPenalty: defaultParams.frequencyPenalty,
  presencePenalty: defaultParams.presencePenalty,
  reasoningLevel: defaultParams.reasoningLevel,
  selectedPrePromptId: getInitialSelectedPrePromptId(), // Prefer last used; fallback to default
  projectName: null, // <<< Initialize as null (or get from storage/default)
  vectorSearchEnabled: false, // Initialize vector search as DISABLED by default (loaded from localStorage below)
  tableSearchEnabled: false, // Initialize table search as DISABLED by default (loaded from localStorage below)
  webSearchEnabled: false, // Initialize web search as DISABLED by default (loaded from localStorage below)
  tableSearchSettings: { // NEW: Initialize with more aggressive defaults
    searchMode: 'custom',
    targetTable: 'all', // NEW: Default to all tables
    maxTablesSearched: 13, // Higher default to match user expectations
    maxRowsPerTable: 500,   // Higher default to match user expectations  
    maxResultsReturned: 50, // Higher default to match user expectations
    enableSemanticMatching: true,
    prioritizeRecentData: true,
    includeSystemTables: false,
  },
  // --- Initialize pagination state ---
  conversationCursor: null,
  hasMoreConversations: true, // Assume true initially
  isLoadingMoreConversations: false, // Not loading more initially
  customAgents: [],
  agentPreferences: [],
  chatFontSize: 'md',
};

const ChatContext = createContext<ChatContextProps | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  // Use the table search settings hook for persistence
  const { settings: persistedTableSearchSettings, isLoaded: settingsLoaded, updateSettings } = useTableSearchSettings();
  
  // Use unified authentication system
  const { user: authUser, isLoading: authLoading } = useAuth();
  
  // Get global project context
  const globalSelectedProjectId = null as unknown as string | null;
  
  const [state, setState] = useState<ChatState>(initialState);
  
  // Update table search settings when persisted settings are loaded
  useEffect(() => {
    if (settingsLoaded) {
      setState(prev => ({
        ...prev,
        // Preserve any runtime-injected fields (like projectId) when applying persisted settings
        tableSearchSettings: {
          ...prev.tableSearchSettings,
          ...persistedTableSearchSettings,
          projectId: persistedTableSearchSettings?.projectId ?? prev.tableSearchSettings.projectId ?? globalSelectedProjectId ?? undefined,
        },
      }));
    }
  }, [persistedTableSearchSettings, settingsLoaded, globalSelectedProjectId]);

  // Keep ref in sync with state changes
  useEffect(() => {
    tableSearchEnabledRef.current = state.tableSearchEnabled;
  }, [state.tableSearchEnabled]);

  // Hydrate table search toggle from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ventiaam_table_search_enabled');
      if (raw !== null) {
        const persisted = JSON.parse(raw);
        if (typeof persisted === 'boolean') {
          tableSearchEnabledRef.current = persisted; // ensure ref matches persisted value immediately
          setState(prev => ({ ...prev, tableSearchEnabled: persisted }));
        }
      }
    } catch {}
  }, []);

  // Hydrate web search toggle from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ventiaam_web_search_enabled');
      if (raw !== null) {
        const persisted = JSON.parse(raw);
        if (typeof persisted === 'boolean') {
          setState(prev => ({ ...prev, webSearchEnabled: persisted }));
        }
      }
    } catch {}
  }, []);

  // Sync global project context with chat state AND table search settings
  useEffect(() => {
    if (globalSelectedProjectId) {
      setState(prev => ({
        ...prev,
        projectName: globalSelectedProjectId,
        tableSearchSettings: {
          ...prev.tableSearchSettings,
          // Preserve persisted projectId if already set; otherwise seed from global
          projectId: prev.tableSearchSettings.projectId ?? globalSelectedProjectId
        }
      }));
      console.log('[ChatProvider] Synced project from global store:', globalSelectedProjectId);
    }
  }, [globalSelectedProjectId]);

  // Sync unified auth state with chat state
  useEffect(() => {
    if (!authLoading) {
      const chatUser: AuthUser | null = authUser ? { id: authUser.id, email: authUser.email } : null;
      setState(prev => ({
        ...prev,
        user: chatUser,
        isLoadingUser: false,
      }));
    }
  }, [authUser, authLoading]);
  // Removed legacy client creation, now using the singleton supabase imported above
  const actionsRef = useRef<ChatActions | null>(null); // Ref for latest actions
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialFetchPerformedRef = useRef<boolean>(false);
  const lastUserIdRef = useRef<string | null>(null);
  
  // NEW: Ref to track latest table search state (avoids stale closure)
  const tableSearchEnabledRef = useRef<boolean>(state.tableSearchEnabled);

  // --- ADDED: Post-assistant-message conversation title auto-update logic ---
  const updateTitleAfterAssistant = useCallback(
    async (
      assistantMessage: ChatMessage,
      conversationId: string,
      isLocal: boolean,
      userId: string
    ) => {
      // Do NOT update if the conversation already has a non-generic title.
      const summary = state.conversationList.find(c => c.id === conversationId);
      if (summary && summary.title && !/^Chat\s/i.test(summary.title) && summary.title !== 'Untitled Local Chat' && summary.title !== 'Untitled Cloud Chat')
        return;

      // Extract plain text from ChatMessage content (robust for array/string)
      let text = '';
      if (typeof assistantMessage.content === 'string') {
        text = assistantMessage.content.trim();
      } else if (Array.isArray(assistantMessage.content)) {
        const textPart = assistantMessage.content.find(part => part.type === 'text') as { type: 'text'; text: string; } | undefined;
        text = textPart?.text?.trim() || '';
      }
      if (!text) return;

      const generatedTitle = await generateTitleFromMessage(text);
      // Defensive: validate again for allowed chars/length
      const safeTitle = generatedTitle.replace(TITLE_ALLOWED_CHARS_REGEX, '').slice(0, TITLE_MAX_LENGTH).trim();
      if (!safeTitle || !conversationId) return;

      // Call both storage and setState for immediate UI update
      await storageService.updateConversationTitle(conversationId, safeTitle, userId, isLocal);
      setState(prev => ({
        ...prev,
        conversationList: prev.conversationList.map(c =>
          c.id === conversationId ? { ...c, title: safeTitle, updatedAt: new Date() } : c
        ),
      }));
    },
    [state.conversationList]
  );
  // ------------------------------------------------------------------

  // --- Centralized Data Fetching Logic (Corrected) ---
  const fetchUserAndInitialData = useCallback(async (context: string, currentSession: Session | null) => {
    
    if (context === 'initial' && initialFetchPerformedRef.current) {
     
      return;
    }
    // Defer setting initialFetchPerformedRef until we know if a user exists
    
    
    setState(prev => ({
      ...prev,
      isLoadingUser: true,
      isLoadingConversationList: true,
      error: null
    }));

    const user = currentSession?.user ?? null;
    const currentUserId = user?.id ?? null;
    const authUser: AuthUser | null = user ? { id: user.id, email: user.email } : null;

    
    setState(prev => ({ ...prev, user: authUser, isLoadingUser: false }));

    if (authUser) {
     
      try {
        // More robust error handling for production - don't use Promise.race which can cause issues
        
        const result = await storageService.getConversationList(authUser.id, null, CONVERSATION_PAGE_LIMIT);
       
        
        const { items, nextCursor } = result;
        
        setState(prev => {
          const keepActiveChat = currentUserId === lastUserIdRef.current;
          const activeConvoExists = prev.activeConversationId && items.some((c: any) => c.id === prev.activeConversationId);
          
          return {
            ...prev,
            conversationList: items,
            conversationCursor: nextCursor,
            hasMoreConversations: !!nextCursor,
            isLoadingConversationList: false,
            activeConversationId: keepActiveChat && activeConvoExists ? prev.activeConversationId : null,
            activeConversationIsLocal: keepActiveChat && activeConvoExists ? prev.activeConversationIsLocal : false,
            currentMessages: keepActiveChat && activeConvoExists ? prev.currentMessages : [],
            initialConversationCreated: items.length > 0,
          };
        });
        
        
      } catch (listError) {


        
        // Don't block user session initialization if conversation list fails
        // This is especially important for first-time users who have no existing data
        setState(prev => ({ 
          ...prev, 
          conversationList: [],
          conversationCursor: null,
          hasMoreConversations: false,
          isLoadingConversationList: false,
          initialConversationCreated: false,
          error: null // Clear error to allow user to continue
        }));
        
        // Log additional context for debugging first sign-in issues
        console.log(`[ChatProvider] User session established successfully despite storage error:`, {
          userId: authUser.id,
          email: authUser.email,
          context: context,
          errorMessage: listError instanceof Error ? listError.message : String(listError)
        });
      }
    } else {

      
      // Clear any remaining user-specific localStorage data
      if (context.includes('SIGNED_OUT')) {

        // 🎯 TARGETED FIX: Async cache clearing (non-blocking)
        clearUserDataOnSignOut(lastUserIdRef.current || undefined).catch((error) => {

        });
      }
      
      // TEMPORARY: Disable redirect in development mode
      if (typeof window !== 'undefined' && window.location.pathname === '/' && context === 'initial' && process.env.NODE_ENV !== 'development') {

        window.location.href = '/sign-in';
        return;
      }
      
      setState(prev => ({
        ...initialState,
        llmModel: prev.llmModel,
        temperature: prev.temperature,
        topP: prev.topP,
        frequencyPenalty: prev.frequencyPenalty,
        presencePenalty: prev.presencePenalty,
        reasoningLevel: prev.reasoningLevel,
        selectedPrePromptId: prev.selectedPrePromptId,
        isLoadingUser: false,
        isLoadingConversationList: false,
      }));
      try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch (e) { console.error("Failed to clear LAST_ACTIVE_CHAT_KEY:", e); }
    }
    lastUserIdRef.current = currentUserId;
    // Mark initial fetch performed only if we actually resolved a user; otherwise allow retry scheduling
    if (context === 'initial') {
      initialFetchPerformedRef.current = !!authUser;
    }
  }, []);

  // Load conversation list when user is available
  useEffect(() => {
    if (authUser && !state.isLoadingConversationList && state.conversationList.length === 0) {
      fetchUserAndInitialData('initial', { user: authUser } as Session);
    }
  }, [authUser, state.isLoadingConversationList, state.conversationList.length]);

  // --- Load user agents and preferences; store in state ---
  useEffect(() => {
    const loadAgents = async () => {
      if (!state.user) return;
      try {
        const res = await fetch('/api/agents/list', { method: 'GET' });
        if (!res.ok) return; // silent fallback to built-ins
        const { data } = await res.json();
        const customs: AgentDefinition[] = [];
        const prefs: AgentPreference[] = [];
        for (const row of data as any[]) {
          if (row.is_builtin) {
            if (row.agent_builtin_id) {
              prefs.push({ userId: state.user!.id, agentBuiltinId: row.agent_builtin_id, isEnabled: !!row.pref_is_enabled, sortOrder: row.pref_sort_order ?? 0 });
            }
          } else {
            customs.push({ id: row.id, name: row.name, description: row.description, content: row.content, colorHex: row.color_hex, iconKey: row.icon_key, isBuiltin: false });
            prefs.push({ userId: state.user!.id, agentId: row.id, isEnabled: !!row.pref_is_enabled, sortOrder: row.pref_sort_order ?? 0 });
          }
        }
        setState(prev => ({ ...prev, customAgents: customs, agentPreferences: prefs }));
      } catch {}
    };
    // Initial load only; updates come from 'agents-updated' events
    loadAgents();
    let timer: any;
    const handler = () => {
      // Debounce to avoid burst refetches when multiple prefs change quickly
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadAgents(); timer = null; }, 300);
    };
    if (typeof window !== 'undefined') window.addEventListener('agents-updated', handler);
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof window !== 'undefined') window.removeEventListener('agents-updated', handler);
    };
  }, [state.user]);

  // --- Action Implementations ---

  // setLLMModel: Update both llmModel and selectedModel.
  const setLLMModel = useCallback((model: LLMModel) => {
    setState(prev => {
      const next = { ...prev, llmModel: model, selectedModel: { supportsReasoning: model.supportsReasoning ?? false } };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);

  const refreshConversationList = useCallback(async () => {
    const currentUser = state.user;
    if (!currentUser) {

      return;
    }

    setState(prev => ({ ...prev, isLoadingConversationList: true, error: null }));
    try {
      // --- CORRECTED: Destructure items and nextCursor; call with null cursor and page limit ---
      const { items, nextCursor } = await storageService.getConversationList(currentUser.id, null, CONVERSATION_PAGE_LIMIT);

      setState(prev => {
        const activeConvoExists = prev.activeConversationId && items.some(c => c.id === prev.activeConversationId);
        return {
          ...prev,
          conversationList: items,
          conversationCursor: nextCursor,
          hasMoreConversations: !!nextCursor,
          isLoadingConversationList: false,
          activeConversationId: activeConvoExists ? prev.activeConversationId : null,
          activeConversationIsLocal: activeConvoExists ? prev.activeConversationIsLocal : false,
          currentMessages: activeConvoExists ? prev.currentMessages : [],
          initialConversationCreated: items.length > 0,
        };
      });
    } catch (error) {

      setState(prev => ({ ...prev, error: "Failed to refresh conversation list.", isLoadingConversationList: false }));
    }
  }, [state.user]);

  // selectConversation: Update active conversation and fetch messages.
  const selectConversation = useCallback(async (id: string | null, isLocalGuess?: boolean) => {
    const currentUserId = state.user?.id;
    const currentActiveId = state.activeConversationId;
    const currentIsLoading = state.isLoadingMessages;
    if (id === null) {
      setState(prev => ({
        ...prev,
        activeConversationId: null,
        activeConversationIsLocal: false,
        currentMessages: [],
        isLoadingMessages: false,
        error: null
      }));
      try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch(e){}
      return;
    }
    if (!currentUserId || id === currentActiveId || currentIsLoading) return;
    setState(prev => ({
      ...prev,
      isLoadingMessages: true,
      error: null,
      activeConversationId: id,
      activeConversationIsLocal: !!isLocalGuess,
      currentMessages: []
    }));
    try {
      const conversation = await storageService.getConversation(id, currentUserId);
      if (conversation) {
        try {
          localStorage.setItem(LAST_ACTIVE_CHAT_KEY, JSON.stringify({ id: conversation.id, isLocal: conversation.isLocal }));
        } catch (e) {}
        setState(prev => {
          if (prev.activeConversationId === id) {
            // Load and apply persisted settings for this conversation
            const loaded = loadConversationSettings(id, availableModels);
            if (loaded) {
              return {
                ...prev,
                ...loaded,
                llmModel: loaded.llmModel || prev.llmModel || defaultModel,
                selectedModel: loaded.selectedModel || prev.selectedModel,
                currentMessages: conversation.messages,
                activeConversationIsLocal: conversation.isLocal,
                isLoadingMessages: false
              };
            }
            return { ...prev, currentMessages: conversation.messages, activeConversationIsLocal: conversation.isLocal, isLoadingMessages: false };
          }
          return prev;
        });
      } else {
        try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch (e) {}
        setState(prev => {
          if (prev.activeConversationId === id) return { ...prev, error: `Conversation not found.`, activeConversationId: null, activeConversationIsLocal: false, currentMessages: [], isLoadingMessages: false };
          return prev;
        });
        refreshConversationList();
      }
    } catch (error) {
      try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch (e) {}
      setState(prev => {
        if (prev.activeConversationId === id) {
          return { ...prev, error: "Failed load.", isLoadingMessages: false, activeConversationId: null, activeConversationIsLocal: false, currentMessages: [] };
        }
        return { ...prev, error: "Failed load.", isLoadingMessages: false };
      });
    }
  }, [state.user, state.activeConversationId, state.isLoadingMessages, refreshConversationList]);

  // createNewConversation: Create and optionally switch to a new conversation.
  const createNewConversation = useCallback(async (storageType: 'local' | 'cloud', switchToNew: boolean = true): Promise<ConversationSummary | null> => {
    const currentUser = state.user;
    const currentModel = state.llmModel;
    if (!currentUser) { setState(prev => ({ ...prev, error: "User session not found." })); return null; }
    if (!currentModel) { setState(prev => ({ ...prev, error: "No LLM model selected." })); return null; }

    const isLocal = storageType === 'local';

    setState(prev => ({ ...prev, isLoadingMessages: switchToNew, error: null }));

    try {
      
      const newConversationSummary = await storageService.createConversation(currentUser.id, isLocal, undefined, undefined, currentModel.id);
      if (!newConversationSummary) throw new Error("Storage service failed.");
      if (switchToNew) {
        try {
          localStorage.setItem(LAST_ACTIVE_CHAT_KEY, JSON.stringify({ id: newConversationSummary.id, isLocal: newConversationSummary.isLocal }));
        } catch (e) {}
      }
      setState(prev => {
        const updatedList = [newConversationSummary, ...prev.conversationList].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        return {
          ...prev,
          conversationList: updatedList,
          activeConversationId: switchToNew ? newConversationSummary.id : prev.activeConversationId,
          activeConversationIsLocal: switchToNew ? newConversationSummary.isLocal : prev.activeConversationIsLocal,
          currentMessages: switchToNew ? [] : prev.currentMessages,
          isLoadingMessages: false,
          initialConversationCreated: true,
        };
      });
      return newConversationSummary;
    } catch (error) {
      setState(prev => ({ ...prev, error: "Failed create.", isLoadingMessages: false }));
      return null;
    }
  }, [state.user, state.llmModel]);

  // renameConversation: Update conversation title in state and storage.
  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    const currentUser = state.user;
    if (!currentUser) {

      return;
    }
    setState(prev => {
      const updatedList = prev.conversationList.map(conv => {
        if (conv.id === id) {
          return { ...conv, title: newTitle, updatedAt: new Date() };
        }
        return conv;
      });
      return { ...prev, conversationList: updatedList };
    });
    try {
      const conversation = state.conversationList.find(conv => conv.id === id);
      if (!conversation) {

        return;
      }
      await storageService.updateConversationTitle(id, newTitle, currentUser.id, conversation.isLocal);

    } catch (error) {

      setState(prev => ({ ...prev, error: "Failed to rename conversation." }));
    }
  }, [state.user, state.conversationList]);

  // deleteConversation: Remove conversation from state and storage.
  const deleteConversation = useCallback(async (id: string) => {
    const currentUser = state.user;
    if (!currentUser) {

      return;
    }
    setState(prev => {
      const updatedList = prev.conversationList.filter(conv => conv.id !== id);
      const newActiveId = prev.activeConversationId === id ? null : prev.activeConversationId;
      const newMessages = prev.activeConversationId === id ? [] : prev.currentMessages;
      return {
        ...prev,
        conversationList: updatedList,
        activeConversationId: newActiveId,
        currentMessages: newMessages
      };
    });
    try {
      const conversation = state.conversationList.find(conv => conv.id === id);
      if (!conversation) {

        return;
      }
      await storageService.deleteConversation(id, currentUser.id, conversation.isLocal);

    } catch (error) {

      setState(prev => ({ ...prev, error: "Failed to delete conversation." }));
    }
  }, [state.user, state.conversationList]);
  // deleteConversationsBulk: Remove multiple conversations from state and storage.
  const deleteConversationsBulk = useCallback(async (ids: string[]) => {
    const currentUser = state.user;
    if (!currentUser || !Array.isArray(ids) || ids.length === 0) {

      return;
    }
    
    // Find conversations to delete BEFORE updating state
    const toDelete = state.conversationList.filter(conv => ids.includes(conv.id));
    
    if (toDelete.length === 0) {

      return;
    }

    console.log(`[ChatProvider] Conversations to delete:`, toDelete.map(c => ({ 
      id: c.id, 
      isLocal: c.isLocal, 
      title: c.title 
    })));
      try {
      // Group conversations by type for different deletion strategies
      const localConversations = toDelete.filter(conv => conv.isLocal);
      const remoteConversations = toDelete.filter(conv => !conv.isLocal);
      
      // Delete local conversations sequentially to avoid localStorage race conditions
      if (localConversations.length > 0) {

        for (const conv of localConversations) {

          await storageService.deleteConversation(conv.id, currentUser.id, conv.isLocal);
        }
      }
      
      // Delete remote conversations in parallel (safe for database operations)
      if (remoteConversations.length > 0) {

        await Promise.all(
          remoteConversations.map(conv => {

            return storageService.deleteConversation(conv.id, currentUser.id, conv.isLocal);
          })
        );
      }
      
      // Only update state after successful deletion
      setState(prev => {
        const updatedList = prev.conversationList.filter(conv => !ids.includes(conv.id));
        const activeDeleted = ids.includes(prev.activeConversationId ?? "");
        return {
          ...prev,
          conversationList: updatedList,
          activeConversationId: activeDeleted ? null : prev.activeConversationId,
          currentMessages: activeDeleted ? [] : prev.currentMessages
        };
      });
      

    } catch (error) {

      setState(prev => ({ ...prev, error: "Failed to bulk delete conversations." }));
    }
  }, [state.user, state.conversationList]);

  // clearConversations: Clear conversations with a given scope.
  const clearConversations = useCallback(async (scope: 'local' | 'remote' | 'all') => {
    const currentUser = state.user;
    if (!currentUser) {
      setState(prev => ({ ...prev, error: "User session not found." }));
      return;
    }

    try {
      await storageService.clearAllConversations(currentUser.id, scope);
      setState(prev => {
        let remaining = prev.conversationList;
        if (scope === 'all') {
          remaining = [];
        } else if (scope === 'local') {
          remaining = prev.conversationList.filter(c => !c.isLocal);
        } else if (scope === 'remote') {
          remaining = prev.conversationList.filter(c => c.isLocal);
        }
        return {
          ...prev,
          conversationList: remaining,
          activeConversationId: remaining.length === 0 ? null : prev.activeConversationId,
          currentMessages: remaining.length === 0 ? [] : prev.currentMessages,
        };
      });

    } catch (error) {

      setState(prev => ({ ...prev, error: `Failed to clear ${scope} conversations.` }));
    }
  }, [state.user, state.conversationList]);

  // resetLoadingState: Reset all loading flags and errors.
  const resetLoadingState = useCallback(() => {

    setState(prev => ({
      ...prev,
      isLoadingUser: false,
      isLoadingConversationList: false,
      isLoadingMessages: false,
      error: null,
    }));
  }, []);

  // stopGenerating: Abort ongoing message generation.
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {

      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => {
        const tempIdx = prev.currentMessages.findIndex(m => m.id.startsWith('temp_assistant_'));
        if (tempIdx !== -1) {
          const updated = [...prev.currentMessages];
          const stopped = updated[tempIdx];
          const current = typeof stopped.content === 'string' ? stopped.content : '';
          const safeMeta = (stopped.metadata && typeof stopped.metadata === 'object') ? stopped.metadata as Record<string, unknown> : {};
          updated[tempIdx] = {
            ...stopped,
            content: current + "\n\n[Stopped]",
            metadata: { ...safeMeta, stopped: true }
          };
          return { ...prev, isLoadingMessages: false, currentMessages: updated, error: null };
        } else {
          return { ...prev, isLoadingMessages: false, error: null };
        }
      });
    }
  }, []);

  // --- Helper function: buildProviderOptions ---
  const buildProviderOptions = (model: LLMModel, level: ReasoningLevel): Record<string, unknown> => {
    const options: Record<string, unknown> = {};
    const inferredSupportsReasoning =
      (model.supportsReasoning ?? false) || /^gpt-5/.test(model.id);
    if (inferredSupportsReasoning) {
      const providerId = model.providerId;
      if (providerId === 'openai' && level !== 'off') {
        // Vercel AI SDK OpenAI provider expects nested reasoning options
        options.openai = { reasoning: { effort: level } };
      } else if (providerId === 'anthropic') {
        const budget = level === 'low' ? 2000 : level === 'medium' ? 8000 : level === 'high' ? 24000 : 0;
        if (level !== 'off' && budget > 0) options.anthropic = { thinking: { type: 'enabled', budgetTokens: budget } };
      }
    }
    return options;
  };

  // sendMessage: Send a message with optional file attachments.
  const sendMessage = useCallback(async (content: string, attachedFiles: File[] = []) => {
    const currentUserId = state.user?.id;
    const currentModel = state.llmModel;

    // --- DEBUG: Log outgoing message context ---
    try {
      console.log('[ChatProvider] sendMessage init', {
        model: currentModel?.id,
        providerId: currentModel?.providerId,
        temperature: state.temperature,
        topP: state.topP,
        frequencyPenalty: state.frequencyPenalty,
        presencePenalty: state.presencePenalty,
        reasoningLevel: state.reasoningLevel,
        vectorSearchEnabled: state.vectorSearchEnabled,
        tableSearchEnabled: state.tableSearchEnabled,
      });
    } catch {}

    // --- NEW: Image Generation Branch ---
    if (
      currentModel?.providerId === 'openai' &&
      currentModel?.canGenerateImages &&
      content.trim().length > 0 &&
      attachedFiles.length === 0
    ) {
      setState(prev => ({ ...prev, isLoadingMessages: true, error: null }));
      try {
        const result = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: content.trim(),
            provider: 'openai',
            modelId: currentModel.id,
          }),
        });
        const { image, error } = await result.json();
        if (!result.ok || !image) {
          throw new Error(error || 'Image generation failed.');
        }
        // Insert the prompt as a user message
        const userMsg: ChatMessage = {
          id: 'user_' + Date.now(),
          role: 'user',
          content: content.trim(),
          createdAt: new Date(),
          conversationId: state.activeConversationId!,
          userId: state.user?.id ?? '',
        };
        // Insert the image as an assistant message
        const assistantMsg: ChatMessage = {
          id: 'assistant_' + Date.now(),
          role: 'assistant',
          content: [{ type: 'image', image: `data:image/png;base64,${image}` }],
          createdAt: new Date(),
          conversationId: state.activeConversationId!,
          userId: state.user?.id ?? '',
          metadata: { modelId: currentModel.id }
        };
        setState(prev => ({
          ...prev,
          currentMessages: [...prev.currentMessages, userMsg, assistantMsg],
          isLoadingMessages: false
        }));
      } catch (error: any) {
        let errorMsg = error.message || 'Image generation failed';
        if (NoImageGeneratedError.isInstance(error)) {
          errorMsg = 'Upgrade your OpenAi API key to use this feature.';
        }
        setState(prev => ({
          ...prev,
          error: errorMsg,
          isLoadingMessages: false
        }));
      }
      return;
    }
    // --- END NEW: Image Generation Branch ---

    const currentProjectName = state.projectName;
    const currentParameters: ModelParameters = {
      temperature: state.temperature,
      topP: state.topP,
      frequencyPenalty: state.frequencyPenalty,
      presencePenalty: state.presencePenalty,
    };
    // Provide a safe default output budget for high reasoning on GPT-5
    if (/^gpt-5/.test(currentModel.id) && state.reasoningLevel !== 'off') {
      // OpenAI GPT-5 rejects max_tokens; do not send
      delete (currentParameters as any).maxTokens;
    }

    // Enforce OpenAI constraints for GPT‑5 family: temperature must be 1.0 for mini (and often family)
    if (/^gpt-5/.test(currentModel.id)) {
      currentParameters.temperature = 1.0;
    }

    // --- DEBUG: Log request body preview ---
    try {
      console.log('[ChatProvider] request preview', {
        model: { id: currentModel.id, providerId: currentModel.providerId },
        parameters: currentParameters,
        reasoningLevel: state.reasoningLevel,
      });
    } catch {}
    // --- Get selected pre-prompt content ---
    // If current model enforces a specific agent, honor it
    const modelLockedPromptId = currentModel.defaultPrePromptId;
    const currentPromptId = modelLockedPromptId || state.selectedPrePromptId;
    // Allow custom agents by passing raw content when ID does not match built-ins in future
    // Resolve system prompt: custom agent or builtin prePrompt
    let systemPromptContent: string;
    let _selectedPromptName: string;
    const builtinPrompt = getPrePromptById(currentPromptId);
    if (builtinPrompt) {
      // Built-ins already include TOOL_USE_PREPROMPT via prePrompts mapping
      systemPromptContent = builtinPrompt.content;
      _selectedPromptName = builtinPrompt.name;
    } else {
      // Try resolve from custom agents
      const custom = state.customAgents.find(a => a.id === currentPromptId);
      if (custom) {
        // Sanitize custom content and append standardized tool-use preprompt and document-first policy exactly once
        const base = sanitizePromptContent(custom.content || '');
        const hasPolicy = /OUTPUT MODE – DOCUMENT-FIRST|```chart/i.test(base);
        const hasToolUse = /TOOL-USE PREPROMPT \(APPEND TO ALL AGENTS/i.test(base);
        const parts: string[] = [base.trim()];
        if (!hasToolUse) parts.push(TOOL_USE_PREPROMPT);
        if (!hasPolicy) parts.push(DOCUMENT_FIRST_POLICY);
        systemPromptContent = parts.join('\n\n');
        _selectedPromptName = custom.name;
      } else {
        systemPromptContent = getDefaultPrePrompt().content;
        _selectedPromptName = getDefaultPrePrompt().name;
      }
    }

    // ---------------------------------------------

    if (!currentUserId) { setState(prev => ({ ...prev, error: "User session not found." })); return; }
    if (!currentModel) { setState(prev => ({ ...prev, error: "No LLM model selected." })); return; }
    if (attachedFiles.length > 0 && !currentModel.multiModal) {

      attachedFiles = [];
    }
    if (!content.trim() && attachedFiles.length === 0) {

      return;
    }
    if (abortControllerRef.current) {

      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    let conversationId = state.activeConversationId;
    let isLocal = state.activeConversationIsLocal;
    let messagesForHistory = state.currentMessages || [];

    if (!conversationId) {

      setState(prev => ({ ...prev, isLoadingMessages: true }));
      const newConvSummary = await createNewConversation('local', true);
      if (!newConvSummary || signal.aborted) {
        setState(prev => ({ ...prev, error: "Failed to auto-create conversation.", isLoadingMessages: false }));
        abortControllerRef.current = null;
        return;
      }
      conversationId = newConvSummary.id;
      isLocal = newConvSummary.isLocal;
      messagesForHistory = [];

    }
    if (!conversationId || signal.aborted) {
      setState(prev => ({ ...prev, error: "Critical Error: No valid conversation ID for sending message.", isLoadingMessages: false }));
      abortControllerRef.current = null;
      return;
    }
    const finalConversationId = conversationId;
    const finalIsLocal = isLocal;

    let base64ImageStrings: string[] = [];
    let fileAttachmentsForPreview: FileAttachment[] | undefined = undefined;
    try {
      if (attachedFiles.length > 0) {
        // Compress images client-side to reduce payload and speed up responses
        const optimized = await compressImagesBatch(attachedFiles, 1280, 'image/jpeg', 0.8);
        base64ImageStrings = await filesToDataURIs(optimized);
        fileAttachmentsForPreview = attachedFiles.map(file => ({
          id: uuidv4(),
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file),
          size: file.size
        }));
      }
    } catch (fileError) {

      setState(prev => ({ ...prev, error: "Failed to process attachments.", isLoadingMessages: false }));
      abortControllerRef.current = null;
      return;
    }

    const userMessageContent: ({ type: "text"; text: string } | { type: "image"; image: string | URL })[] = [
      { type: 'text', text: content.trim() }
    ];
    if (base64ImageStrings.length > 0) {
      base64ImageStrings.forEach(imgStr => {
        userMessageContent.push({ type: 'image', image: imgStr });
      });
    }
    const userMessageTempId = `temp_user_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageTempId,
      role: 'user',
      content: userMessageContent,
      createdAt: new Date(),
      conversationId: finalConversationId,
      userId: currentUserId,
      metadata: null,
      ...(fileAttachmentsForPreview ? { files: fileAttachmentsForPreview } : {})
    };

    const assistantPlaceholderTempId = `temp_assistant_${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantPlaceholderTempId,
      role: 'assistant',
      content: '',
      createdAt: new Date(Date.now() + 1),
      conversationId: finalConversationId,
      userId: currentUserId,
      metadata: null
    };

    setState(prev => ({
      ...prev,
      currentMessages: prev.activeConversationId === finalConversationId
        ? [...(prev.currentMessages || []), userMessage, assistantPlaceholder]
        : prev.currentMessages,
      error: null,
      isLoadingMessages: true,
    }));

    const historyForApi = messagesForHistory.filter(m => !m.id.startsWith('temp_')).concat(userMessage);
    const messagesToSend: CoreMessage[] = toCoreMessages(historyForApi);
    const providerOptions = buildProviderOptions(currentModel, state.reasoningLevel);

    if (messagesToSend.length === 0 && attachedFiles.length === 0) {

      setState(prev => ({
        ...prev,
        error: "Cannot send empty message.",
        isLoadingMessages: false,
        currentMessages: prev.currentMessages.filter(m => !m.id.startsWith('temp_'))
      }));
      abortControllerRef.current = null;
      return;
    }

    let assistantResponseContent = '';
    let finalAssistantMessage: ChatMessage | null = null;
    let finalUserMessageId = userMessage.id;

    try {




      // Use ref for latest value (prevents stale closure)
      const actualTableSearchEnabled = tableSearchEnabledRef.current;
      console.log("  -> Table Search Enabled (from state):", state.tableSearchEnabled);
      console.log("  -> Table Search Enabled (from ref):", actualTableSearchEnabled);
      console.log("  -> Project ID:", state.tableSearchSettings.projectId || state.projectName || 'N/A');
      console.log("  -> Table Search Settings:", JSON.stringify({
        projectId: state.tableSearchSettings.projectId,
        targetTable: state.tableSearchSettings.targetTable,
        tables: state.tableSearchSettings.maxTablesSearched,
        rows: state.tableSearchSettings.maxRowsPerTable,
        results: state.tableSearchSettings.maxResultsReturned
      }));

      const effectiveTableSearchEnabled = tableSearchEnabledRef.current;
      console.log("  -> Table Search Enabled (effective):", effectiveTableSearchEnabled);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend,
          model: currentModel,
          parameters: currentParameters,
          providerOptions: providerOptions,
          systemPrompt: systemPromptContent,
          vectorSearchEnabled: state.vectorSearchEnabled, // <<< INCLUDE vectorSearchEnabled
          tableSearchEnabled: effectiveTableSearchEnabled, // NEW: Use ref for latest value (prevents stale closure)
          webSearchEnabled: state.webSearchEnabled, // NEW: Include webSearchEnabled
          tableSearchSettings: {
            // NEW: Convert frontend settings to API format
            targetTable: state.tableSearchSettings.targetTable, // NEW: Include target table
            projectId: state.tableSearchSettings.projectId, // NEW: Include project from settings
            maxTableRows: state.tableSearchSettings.maxRowsPerTable,
            maxTablesSearched: state.tableSearchSettings.maxTablesSearched,
            maxResultsReturned: state.tableSearchSettings.maxResultsReturned,
            enableSemanticMatching: state.tableSearchSettings.enableSemanticMatching,
            prioritizeRecentData: state.tableSearchSettings.prioritizeRecentData,
            includeSystemTables: state.tableSearchSettings.includeSystemTables,
            includeAllRows: state.tableSearchSettings.includeAllRows ?? false,
          },
          projectName: state.tableSearchSettings.projectId || currentProjectName // Use projectId from settings or fallback to currentProjectName
        }),
        signal,
      });

      if (signal.aborted) throw new Error("Request cancelled before response");
      if (!response.ok) {
        let errorBody;
        try { errorBody = await response.json(); } catch { errorBody = { error: response.statusText }; }

        throw new Error(`API Error (${response.status}): ${errorBody.error || 'Unknown API error'}`);
      }
      if (!response.body) throw new Error("API Error: Response body is empty.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        if (signal.aborted) { reader.cancel(); throw new Error("Request cancelled during stream"); }
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunk.split('\n').filter(line => line.startsWith('0:')).forEach(line => {
          try {
            const textChunk = JSON.parse(line.substring(2));
            if (typeof textChunk === 'string') {
              assistantResponseContent += textChunk;
              setState(prev => {
                if (prev.activeConversationId === finalConversationId) {
                  return {
                    ...prev,
                    currentMessages: prev.currentMessages.map(msg =>
                      msg.id === assistantPlaceholderTempId ? { ...msg, content: assistantResponseContent } : msg
                    ),
                  };
                }
                return prev;
              });
            }
          } catch (parseError) {
            // --- DEBUG: log malformed chunk line ---
            try { console.warn('[ChatProvider] malformed stream line', line); } catch {}
          }
        });
      }

      // --- DEBUG: If still empty, log a warning before finalizing ---
      if (!assistantResponseContent.trim()) {
        try {
          console.warn('[ChatProvider] Empty response received', {
            model: currentModel.id,
            providerId: currentModel.providerId,
            parameters: currentParameters,
            reasoningLevel: state.reasoningLevel,
          });
        } catch {}
      }

      abortControllerRef.current = null;
      finalUserMessageId = finalizeMessageId(userMessageTempId, finalIsLocal);
      const finalAssistantMessageId = finalizeMessageId(assistantPlaceholderTempId, finalIsLocal);
      const userMessageToSave: ChatMessage = { ...userMessage, id: finalUserMessageId };
      const safePlaceholderMeta = (assistantPlaceholder.metadata && typeof assistantPlaceholder.metadata === 'object') ? assistantPlaceholder.metadata as Record<string, unknown> : {};
      finalAssistantMessage = {
        ...assistantPlaceholder,
        id: finalAssistantMessageId,
        content: assistantResponseContent.trim() || "[Empty Response]",
        createdAt: new Date(),
        metadata: { ...safePlaceholderMeta, modelId: currentModel.id }
      };

      try {
        if (finalIsLocal) {
          await storageService.addMessage(finalConversationId, userMessageToSave, currentUserId, finalIsLocal);
          await storageService.addMessage(finalConversationId, finalAssistantMessage, currentUserId, finalIsLocal);
        } else {
          await Promise.all([
            storageService.addMessage(finalConversationId, userMessageToSave, currentUserId, finalIsLocal),
            storageService.addMessage(finalConversationId, finalAssistantMessage, currentUserId, finalIsLocal)
          ]);
        }

      } catch (saveError) {

        setState(prev => ({ ...prev, error: "Failed to save messages." }));
      }

      await storageService.updateConversationModel(finalConversationId, currentModel.id, currentUserId, finalIsLocal)
        .catch(modelUpdateError => console.error('[ChatProvider] Error updating conversation model:', modelUpdateError));

      // *** NEW: Trigger title update if this is ASSISTANT'S FIRST MESSAGE ***
      const hasOnly2Messages =
        state.currentMessages.filter(m => !m.id.startsWith('temp_')).length === 0 &&
        state.currentMessages.length <= 2;
      const shouldUpdateTitle =
        (state.activeConversationId === finalConversationId)
        && (hasOnly2Messages ||
            !state.currentMessages.some(m => m.role === 'assistant' && m.id !== assistantPlaceholderTempId));
      if (shouldUpdateTitle) {
        await updateTitleAfterAssistant(finalAssistantMessage, finalConversationId, finalIsLocal, currentUserId);
      }

      setState(prev => {
        if (prev.activeConversationId === finalConversationId) {
          const finalMessages = prev.currentMessages
            .map(msg => {
              if (msg.id === userMessageTempId) return userMessageToSave;
              if (msg.id === assistantPlaceholderTempId) return finalAssistantMessage;
              return msg;
            })
            .filter(Boolean) as ChatMessage[];
          return { ...prev, currentMessages: finalMessages, isLoadingMessages: false };
        }
        return { ...prev, isLoadingMessages: false };
      });
      refreshConversationList();
    } catch (apiError: any) {
      // 1) Clean up the controller
      abortControllerRef.current = null;
    
      // 2) If the fetch was aborted, just log & return
      if (apiError.name === 'AbortError') {

        // stopGenerating() has already stamped “[Stopped]” into the UI
        return;
      }
    
      // 3) Otherwise fall through to your normal error‐rendering logic

      const isCancellation =
        apiError.message?.toLowerCase().includes('cancel') ||
        apiError.name === 'AbortError';
      const errorMessage = isCancellation
        ? 'Response generation stopped.'
        : apiError.message || 'Failed to get response.';
    
      // --- DEBUG: Log error context ---
      try {
        console.error('[ChatProvider] sendMessage error', {
          error: errorMessage,
          model: currentModel?.id,
          providerId: currentModel?.providerId,
          parameters: {
            temperature: state.temperature,
            topP: state.topP,
            frequencyPenalty: state.frequencyPenalty,
            presencePenalty: state.presencePenalty,
          },
          reasoningLevel: state.reasoningLevel,
        });
      } catch {}
      setState(prev => {
        if (prev.activeConversationId === finalConversationId) {
          const finalUserMessageIdOnError = finalizeMessageId(userMessageTempId, finalIsLocal);
          const finalMessages = prev.currentMessages
            .map(msg => {
              if (msg.id === userMessageTempId) {
                return { ...userMessage, id: finalUserMessageIdOnError };
              }
              if (msg.id === assistantPlaceholderTempId) {
                return {
                  ...assistantPlaceholder,
                  id: finalizeMessageId(assistantPlaceholderTempId, finalIsLocal),
                  role: 'system',
                  content: `[${isCancellation ? 'Info' : 'Error'}: ${errorMessage}]`,
                  createdAt: new Date(),
                } as ChatMessage;
              }
              return msg;
            })
            .filter(Boolean) as ChatMessage[];
    
          return {
            ...prev,
            currentMessages: finalMessages,
            isLoadingMessages: false,
            error: isCancellation ? null : errorMessage,
          };
        }
    
        return {
          ...prev,
          isLoadingMessages: false,
          error: isCancellation ? null : errorMessage,
        };
      });
    } finally {
      if (fileAttachmentsForPreview) {
        fileAttachmentsForPreview.forEach(f => URL.revokeObjectURL(f.url));
      }
    }
  }, [ 
    state.user,
    state.activeConversationId,
    state.activeConversationIsLocal,
    state.currentMessages,
    state.llmModel,
    state.temperature,
    state.topP,
    state.frequencyPenalty,
    state.presencePenalty,
    state.reasoningLevel,
    state.selectedPrePromptId,
    state.projectName,
    state.vectorSearchEnabled,
    updateTitleAfterAssistant,
    createNewConversation,
    refreshConversationList
  ]);

  // --- Parameter Actions ---
  const setTemperature = useCallback((value: number) => {
    setState(prev => {
      const next = { ...prev, temperature: value };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);
  const setTopP = useCallback((value: number) => {
    setState(prev => {
      const next = { ...prev, topP: value };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);
  const setFrequencyPenalty = useCallback((value: number) => {
    setState(prev => {
      const next = { ...prev, frequencyPenalty: value };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);
  const setPresencePenalty = useCallback((value: number) => {
    setState(prev => {
      const next = { ...prev, presencePenalty: value };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);
  const setReasoningLevel = useCallback((level: ReasoningLevel) => {

    setState(prev => {
      const next = { ...prev, reasoningLevel: level };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);
  const resetModelParameters = useCallback(() => {

    setState(prev => {
      const next = {
        ...prev,
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOP_P,
        frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
        presencePenalty: DEFAULT_PRESENCE_PENALTY,
        reasoningLevel: DEFAULT_REASONING_LEVEL
      };
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);

  // --- Pre-Prompt Action Implementation ---
  const setSelectedPrePromptId = useCallback((promptId: string) => {
    // Unconditionally accept selection; custom agents may not be loaded yet.
    setState(prev => {
      const next = { ...prev, selectedPrePromptId: promptId };
      try { localStorage.setItem(LAST_USED_AGENT_KEY, promptId); } catch {}
      if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
      saveGlobalSettings(next);
      return next;
    });
  }, []);

  // --- ADDED: Implement toggleVectorSearch ---
  const toggleVectorSearch = useCallback(() => {
    setState(prev => {
      const newState = !prev.vectorSearchEnabled;

      return { ...prev, vectorSearchEnabled: newState };
    });
  }, []);

  // --- NEW: Implement toggleTableSearch with persistence ---
  const toggleTableSearch = useCallback(() => {
    setState(prev => {
      const newState = !prev.tableSearchEnabled;
      
      console.log(`[TableSearch] Toggling: ${prev.tableSearchEnabled} → ${newState}`);
      
      // Update ref immediately (prevents stale closure in sendMessage)
      tableSearchEnabledRef.current = newState;
      
      // Persist to localStorage
      try {
        localStorage.setItem('ventiaam_table_search_enabled', JSON.stringify(newState));
        console.log(`[TableSearch] State persisted to localStorage: ${newState}`);
      } catch (error) {
        console.error('[TableSearch] Failed to persist state:', error);
      }

      return { ...prev, tableSearchEnabled: newState };
    });
  }, []);

  // --- NEW: Implement toggleWebSearch with persistence ---
  const toggleWebSearch = useCallback(() => {
    setState(prev => {
      const newState = !prev.webSearchEnabled;
      
      console.log(`[WebSearch] Toggling: ${prev.webSearchEnabled} → ${newState}`);
      
      // Persist to localStorage
      try {
        localStorage.setItem('ventiaam_web_search_enabled', JSON.stringify(newState));
        console.log(`[WebSearch] State persisted to localStorage: ${newState}`);
      } catch (error) {
        console.error('[WebSearch] Failed to persist state:', error);
      }

      return { ...prev, webSearchEnabled: newState };
    });
  }, []);

  // --- NEW: Implement setTableSearchSettings ---
  const setTableSearchSettings = useCallback((settings: TableSearchSettings) => {
    // Update both local state and persist to localStorage
    setState(prev => ({ ...prev, tableSearchSettings: settings }));
    updateSettings(settings);
  }, [updateSettings]);
  // -----------------------------------------

  // --- *** NEW ACTION: loadMoreConversations *** ---
  const loadMoreConversations = useCallback(async () => {
    if (state.isLoadingMoreConversations || !state.hasMoreConversations || !state.user || !state.conversationCursor) {
      console.log("[ChatProvider] loadMoreConversations: Skipping", { 
        isLoading: state.isLoadingMoreConversations, 
        hasMore: state.hasMoreConversations, 
        cursor: state.conversationCursor 
      });
      return;
    }

    setState(prev => ({ ...prev, isLoadingMoreConversations: true, error: null }));
    try {
      const { items: newRemoteItems, nextCursor: newNextCursor } = await storageService.getConversationList(
        state.user.id,
        state.conversationCursor,
        CONVERSATION_PAGE_LIMIT
      );

      setState(prev => {
        const currentIds = new Set(prev.conversationList.map(c => c.id));
        const uniqueNewItems = newRemoteItems.filter(item => !currentIds.has(item.id));
        const updatedList = [...prev.conversationList, ...uniqueNewItems];
        return {
          ...prev,
          conversationList: updatedList,
          conversationCursor: newNextCursor,
          hasMoreConversations: !!newNextCursor,
          isLoadingMoreConversations: false,
        };
      });
    } catch (error) {

      setState(prev => ({ ...prev, error: "Failed load more.", isLoadingMoreConversations: false }));
    }
  }, [state.isLoadingMoreConversations, state.hasMoreConversations, state.conversationCursor, state.user]);

  // --- Consolidate actions ---
  const actions: ChatActions = useMemo(() => ({
    selectConversation,
    createNewConversation,
    sendMessage,
    renameConversation,
    deleteConversation,
    deleteConversationsBulk,
    setLLMModel,
    refreshConversationList,
    clearConversations,
    resetLoadingState,
    stopGenerating,
    setTemperature,
    setTopP,
    setFrequencyPenalty,
    setPresencePenalty,
    setReasoningLevel,
    resetModelParameters,
    setSelectedPrePromptId,
    toggleVectorSearch,
    toggleTableSearch, // NEW: Add table search toggle
    toggleWebSearch, // NEW: Add web search toggle
    setTableSearchSettings, // NEW: Add table search settings action
    loadMoreConversations, // Add the new action
    setChatFontSize: (size: ChatFontSize) => {
      setState(prev => {
        const next = { ...prev, chatFontSize: size };
        try { localStorage.setItem('ventiaam_chat_font_size', size); } catch {}
        if (prev.activeConversationId) saveConversationSettings(prev.activeConversationId, next);
        return next;
      });
    },
    deleteMessage: async (messageId: string) => {
      const currentUser = state.user;
      const conversationId = state.activeConversationId;
      const isLocal = state.activeConversationIsLocal;
      if (!currentUser || !conversationId) return;
      // Optimistic update
      setState(prev => ({
        ...prev,
        currentMessages: prev.currentMessages.filter(m => m.id !== messageId)
      }));
      try {
        await storageService.deleteMessage(conversationId, messageId, currentUser.id, isLocal);
      } catch (err) {
        try {
          const convo = await storageService.getConversation(conversationId, currentUser.id);
          if (convo) setState(prev => ({ ...prev, currentMessages: convo.messages }));
        } catch {}
      }
    },
  }), [
    selectConversation,
    createNewConversation,
    sendMessage,
    renameConversation,
    deleteConversation,
    deleteConversationsBulk,
    setLLMModel,
    refreshConversationList,
    clearConversations,
    resetLoadingState,
    stopGenerating,
    setTemperature,
    setTopP,
    setFrequencyPenalty,
    setPresencePenalty,
    setReasoningLevel,
    resetModelParameters,
    setSelectedPrePromptId,
    toggleVectorSearch,
    toggleTableSearch, // NEW: Add table search toggle to dependencies
    toggleWebSearch, // NEW: Add web search toggle to dependencies
    setTableSearchSettings, // NEW: Add table search settings action to dependencies
    loadMoreConversations,
    state.user,
    state.activeConversationId,
    state.activeConversationIsLocal,
  ]);

  // --- Update actionsRef ---
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // Load persisted font size on mount
  useEffect(() => {
    try {
      const fs = localStorage.getItem('ventiaam_chat_font_size') as 'sm' | 'md' | 'lg' | null;
      if (fs && (fs === 'sm' || fs === 'md' || fs === 'lg')) {
        setState(prev => ({ ...prev, chatFontSize: fs }));
      }
    } catch {}
  }, []);

  // Load global model/parameters as defaults on mount
  useEffect(() => {
    const global = loadGlobalSettings(availableModels);
    if (global) {
      setState(prev => ({
        ...prev,
        llmModel: global.llmModel || prev.llmModel,
        selectedModel: global.selectedModel || prev.selectedModel,
        selectedPrePromptId: global.selectedPrePromptId || prev.selectedPrePromptId,
        temperature: global.temperature ?? prev.temperature,
        topP: global.topP ?? prev.topP,
        frequencyPenalty: global.frequencyPenalty ?? prev.frequencyPenalty,
        presencePenalty: global.presencePenalty ?? prev.presencePenalty,
        reasoningLevel: (global.reasoningLevel as any) || prev.reasoningLevel,
        chatFontSize: (global.chatFontSize as any) || prev.chatFontSize,
      }));
    }
  }, []);

  // --- Effect for Auto-Creating Initial Conversation ---
  // [DISABLED] Prevent auto-creation of blank conversations on every refresh.
  // Only create a new conversation when the user explicitly starts a chat.
  // This avoids polluting the conversation list with empty/blank entries.
  // useEffect(() => {
  //   if (
  //     state.user && !state.isLoadingUser && !state.isLoadingConversationList &&
  //     state.conversationList.length === 0 && !state.initialConversationCreated
  //   ) {
  //     if (actionsRef.current?.createNewConversation) {
  //       actionsRef.current.createNewConversation('local', true)
  //         .then(summary => { if (!summary) { setState(prev => ({ ...prev, error: "Failed to create initial chat." })); } })
  //         .catch(error => { console.error("[ChatProvider] Error during auto-creation call:", error); setState(prev => ({ ...prev, error: "Failed to create initial chat." })); });
  //     } else {
  //       console.warn("[ChatProvider] Auto-creation skipped: actionsRef not ready.");
  //     }
  //   }
  // }, [
  //   state.user,
  //   state.isLoadingUser,
  //   state.isLoadingConversationList,
  //   state.conversationList.length,
  //   state.initialConversationCreated
  // ]);

  // --- Effect: Restore Last Active Conversation ---
  // [DISABLED] Start with a clean slate - no conversation loaded on app open.
  // Users can manually select a conversation from the sidebar when they're ready.
  // useEffect(() => {
  //   if (state.isLoadingUser || state.isLoadingConversationList || state.activeConversationId) { return; }
  //   if (state.conversationList.length === 0) { try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch(e){} return; }
  //   
  //   let restored = false;
  //   try {
  //     const storedInfoRaw = localStorage.getItem(LAST_ACTIVE_CHAT_KEY);
  //     if (storedInfoRaw) {
  //       const storedInfo = JSON.parse(storedInfoRaw);
  //       const lastId = storedInfo?.id;
  //       const lastIsLocal = storedInfo?.isLocal;
  //       if (typeof lastId === 'string' && typeof lastIsLocal === 'boolean') {
  //         const exists = state.conversationList.some(c => c.id === lastId);
  //         if (exists && actionsRef.current?.selectConversation) {
  //           
  //           setTimeout(() => actionsRef.current!.selectConversation(lastId, lastIsLocal), 0);
  //           restored = true;
  //         } else if (!exists) {
  //          
  //           localStorage.removeItem(LAST_ACTIVE_CHAT_KEY);
  //         }
  //       } else {

  //         localStorage.removeItem(LAST_ACTIVE_CHAT_KEY);
  //       }
  //     }
  //   } catch (error) {

  //     try { localStorage.removeItem(LAST_ACTIVE_CHAT_KEY); } catch (e) {}
  //   }
  //   if (!restored && state.conversationList.length > 0 && actionsRef.current?.selectConversation) {
  //     const firstConversation = state.conversationList[0];
  //    
  //     setTimeout(() => actionsRef.current!.selectConversation(firstConversation.id, firstConversation.isLocal), 0);
  //   }
  // }, [
  //   state.isLoadingUser,
  //   state.isLoadingConversationList,
  //   state.conversationList,
  //   state.activeConversationId
  // ]);

  // --- Load last used agent (global default) on first mount if no conversation-level setting overrides ---
  useEffect(() => {
    if (state.selectedPrePromptId) return; // already set by initialState or conversation load
    try {
      const stored = localStorage.getItem(LAST_USED_AGENT_KEY);
      if (stored && (getPrePromptById(stored) || (state.customAgents || []).some(a => a.id === stored))) {
        setState(prev => ({ ...prev, selectedPrePromptId: stored }));
      }
    } catch {}
  }, [state.customAgents, state.selectedPrePromptId]);

  const contextValue: ChatContextProps = useMemo(() => ({
    ...state,
    actions
  }), [state, actions]);

  return (<ChatContext.Provider value={contextValue}> {children} </ChatContext.Provider>);
}

// Custom hook for consuming the context
export function useChatContext(): ChatContextProps {
  const context = useContext(ChatContext);
  if (!context) { throw new Error('useChatContext must be used within a ChatProvider'); }
  return context;
}

