// /components/chat/ChatInterface.tsx
'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ChangeEvent,
  SetStateAction
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Check,
  Copy,
  ChevronDown as ScrollDownIcon,
  StopCircle
} from 'lucide-react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageItem } from '@/components/chat/MessageItem';
import { ResizableSplitView } from '@/components/chat/ResizableSplitView';
import dynamic from 'next/dynamic';
import modelsData from '@/lib/models.json';
import type { LLMModel, ChatMessage, AgentDefinition, AgentPreference } from '@/lib/types';
import type { CodeBlock } from '@/lib/codeUtils';
import { extractCodeBlocks, enhancedCodeExtraction } from '@/lib/codeUtils';
// --- ADDED: Import prePrompts data ---
import { prePrompts } from '@/components/data/prePrompts';
// --- ADDED: Import useVirtualizer hook for virtualization ---
import { useVirtualizer } from '@tanstack/react-virtual';
import EmptyChatWelcome from '@/components/chat/EmptyChatWelcome';
import { RoutinesBar } from '@/components/chat/RoutinesBar';
import { HabitTrackerDialog } from '@/components/chat/HabitTrackerDialog';
import AgentManagerDialog from '@/components/chat/AgentManagerDialog';
import { toast } from 'sonner';

const OVERSCAN_COUNT = 10; // Render 10 items above/below viewport
const DEFAULT_ITEM_HEIGHT_ESTIMATE = 100; // Adjust based on typical message size

const MIN_CODE_LINES_TO_AUTO_SHOW = 5;
const SCROLL_THRESHOLD = 50; // Pixels from bottom to consider "at bottom"

// Limit the chat toolbar dropdown to a specific whitelist of model IDs
const allowedModelIds: string[] = [
  'gpt-4o',
  'gpt-5-chat-latest',
  'gpt-5-2025-08-07',
  'gpt-5',
  'gpt-5.1',
];
const availableModels: LLMModel[] = (modelsData.models as LLMModel[]).filter(m => allowedModelIds.includes(m.id));

function parseTimestamp(ts: Date | string | number): number {
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;

  if (typeof ts === 'string') {
    const iso = ts
      .trim()
      .replace(' ', 'T')
      .replace(/([+\-]\d{2})(\d{2})?$/, (_, h, m = '00') => `${h}:${m}`);

    const m = iso.match(
      /^([\d\-]+T\d{2}:\d{2}:\d{2})(\.\d+)?([Zz]|[+\-]\d{2}:\d{2})$/
    );
    if (m) {
      const [, baseDT, frac = '', tz] = m;
      const baseMs = Date.parse(baseDT + tz);
      if (isNaN(baseMs)) return NaN;
      const fracMs = (parseFloat(frac) || 0) * 1000;
      return baseMs + fracMs;
    }

    const f = Date.parse(iso);
    return isNaN(f) ? NaN : f;
  }

  return NaN;
}

export function ChatInterface() {
  // --- Get state and actions from context ---
  const {
    currentMessages,
    llmModel: selectedModel,
    error: chatProviderError,
    isLoadingMessages,
    vectorSearchEnabled,
    tableSearchEnabled,
    activeConversationId,
    selectedPrePromptId,             // ADDED: Get selectedPrePromptId from context
    customAgents,
    agentPreferences,
    actions: {
      sendMessage,
      setLLMModel,
      stopGenerating,
      setSelectedPrePromptId,          // ADDED: Get action from context
      deleteMessage,
      runRoutine
    }
  } = useChatContext();
  // ----------------------------------------

  // --- Local State ---
  // REMOVED: const [input, setInput] = useState('');
  // REMOVED: const [files, setFiles] = useState<File[]>([]); // No longer needed in ChatInterface
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);
  const [showCodeSection, setShowCodeSection] = useState(false);
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [userClosedCodeSection, setUserClosedCodeSection] = useState(false);
  const [documentMarkdown, setDocumentMarkdown] = useState<string>("");
  const [documentChartSpec, setDocumentChartSpec] = useState<unknown>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Record<string, boolean>>({});
  // Drive Mode state
  const [driveModeActive, setDriveModeActive] = useState(false);
  const [driveModeStatus, setDriveModeStatus] = useState<string>('');
  const [driveModeActiveModel, setDriveModeActiveModel] = useState<string>('');
  const [driveModeRestart, setDriveModeRestart] = useState(0); // Counter to force restart
  const [isAgentManagerOpen, setIsAgentManagerOpen] = useState(false);
  const [habitDialogOpen, setHabitDialogOpen] = useState(false);
  

  // Lazy load voice overlay and session component only when needed
  const DriveModeOverlay = useMemo(() => dynamic(() => import('@/components/chat/voice/DriveModeOverlay').then(m => m.DriveModeOverlay), { ssr: false }), []);
  const DriveModeVoiceChat = useMemo(() => dynamic(() => import('@/components/chat/voice/DriveModeVoiceChat').then(m => m.DriveModeVoiceChat), { ssr: false }), []);
  // Listen for global request to open Agent Manager
  useEffect(() => {
    const handler = () => setIsAgentManagerOpen(true);
    if (typeof window !== 'undefined') window.addEventListener('open-agent-manager', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('open-agent-manager', handler); };
  }, []);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // REMOVED: const messagesEndRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userScrolledUpRef = useRef(false);
  const lastProcessedMsgIdForCodeRef = useRef<string | null>(null);

  const memoizedCodeBlocks = useMemo(() => codeBlocks, [codeBlocks]);

  const sortedMessages: ChatMessage[] = useMemo(() => {
    // Normalize any non-Date createdAt values and sort strictly by timestamp then by original index
    const withSafeDates = currentMessages.map((m, i) => ({
      m,
      i,
      t: m?.createdAt instanceof Date && !isNaN(m.createdAt.getTime())
        ? m.createdAt.getTime()
        : new Date((m?.createdAt as unknown as string | number) ?? Date.now()).getTime(),
    }));
    withSafeDates.sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t; // ascending chronological
      return a.i - b.i; // stable fallback
    });
    return withSafeDates.map(x => ({ ...x.m, createdAt: new Date(x.t) }));
  }, [currentMessages]);

  // Adapt chat content max width based on side panel state: larger when no panel, narrower when open
  // On mobile, always full width; on desktop, adapt based on panel state
  const chatMaxWidthClass = useMemo(() => {
    if (showCodeSection) {
      return 'w-full sm:max-w-3xl';
    }
    return 'w-full sm:max-w-7xl';
  }, [showCodeSection]);

  // Compute context-aware thinking status text based on the latest user message and toggles
  const lastUserText: string = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const m = sortedMessages[i];
      if (m && m.role === 'user') {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .map(p => {
              if (p && typeof p === 'object' && 'type' in p && p.type === 'text' && 'text' in p) {
                return (p as { type: 'text'; text: string }).text;
              }
              return '';
            })
            .join(' ')
            .trim();
        }
        return '';
      }
    }
    return '';
  }, [sortedMessages]);

  const lastUserImageCount: number = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const m = sortedMessages[i];
      if (m && m.role === 'user') {
        if (Array.isArray(m.content)) {
          return m.content.reduce((acc, p) => {
            if (p && typeof p === 'object' && 'type' in p && p.type === 'image') {
              return acc + 1;
            }
            return acc;
          }, 0);
        }
        return 0;
      }
    }
    return 0;
  }, [sortedMessages]);

  const thinkingStatus: string = useMemo(() => {
    // Sanitize and extract short topic snippet from the user's text
    const topic = (lastUserText || '')
      .replace(/```[\s\S]*?```/g, '') // strip fenced code blocks
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    // Priority-specific messages based on toggles & content
    if (tableSearchEnabled) {
      return topic ? `Searching tables for: "${topic}"…` : 'Searching tables for relevant rows…';
    }
    if (vectorSearchEnabled) {
      return topic ? `Retrieving context from knowledge base: "${topic}"…` : 'Retrieving context from knowledge base…';
    }
    if ((selectedModel?.multiModal ?? false) && lastUserImageCount > 0) {
      const plural = lastUserImageCount > 1 ? 'images' : 'image';
      return topic ? `Analyzing ${lastUserImageCount} ${plural} and your request: "${topic}"…` : `Analyzing ${lastUserImageCount} ${plural}…`;
    }

    // General reasoning variants
    const generic: string[] = [
      topic ? `Considering "${topic}"…` : 'Thinking through your request…',
      topic ? `Planning an answer about "${topic}"…` : 'Planning the next steps…',
      topic ? `Evaluating options for "${topic}"…` : 'Evaluating possible approaches…',
    ];

    // Deterministic pick based on last message id to avoid flicker
    const lastId = sortedMessages[sortedMessages.length - 1]?.id || '';
    let acc = 0;
    for (let i = 0; i < lastId.length; i++) acc = (acc + lastId.charCodeAt(i)) % 997;
    return generic[acc % generic.length];
  }, [lastUserText, vectorSearchEnabled, tableSearchEnabled, selectedModel?.multiModal, lastUserImageCount, sortedMessages]);

  useEffect(() => {
    if (sortedMessages.length === 0) return;
    
    sortedMessages.forEach((m) => {
          });
    console.groupEnd();
  }, [sortedMessages, activeConversationId]);

  // *** ADDED: Setup the virtualizer hook ***
  const rowVirtualizer = useVirtualizer({
    count: sortedMessages.length, // Total number of messages
    getScrollElement: () => scrollAreaRef.current, // Provide the scroll container element
    getItemKey: (index: number) => sortedMessages[index]?.id ?? index,
    // Estimate the height of each message. Crucial for performance.
    // Make this estimate as accurate as possible for smoother scrolling.
    estimateSize: useCallback((index: number) => {
        const message = sortedMessages[index];
        if (!message) return DEFAULT_ITEM_HEIGHT_ESTIMATE; // Fallback

        let estimatedHeight = 80; // Base height (padding, timestamp, etc.)
        const content = message.content;

        if (typeof content === 'string') {
            estimatedHeight += Math.max(20, content.length / 4); // Very rough estimate based on chars
            if (content.includes('```')) estimatedHeight += 60; // Add for code blocks
        } else if (Array.isArray(content)) {
            content.forEach(part => {
                if (part.type === 'text') {
                    estimatedHeight += Math.max(20, part.text.length / 4);
                    if (part.text.includes('```')) estimatedHeight += 60;
                } else if (part.type === 'image') {
                    estimatedHeight += 160; // Add fixed height for images
                }
            });
        }
        return Math.max(80, estimatedHeight); // Ensure a minimum height
    }, [sortedMessages]),
    overscan: OVERSCAN_COUNT, // Render items slightly outside viewport
    // measureElement: (element) => element.getBoundingClientRect().height, // Optional for dynamic measurement
  });

  // Get the virtual items to render
  const virtualItems = rowVirtualizer.getVirtualItems();

  // *** UPDATED: Scrolling function using virtualizer ***
  const scrollToBottomOrIndex = useCallback((index?: number, behavior: "auto" | "smooth" = 'smooth', alignment: 'start' | 'center' | 'end' = 'end') => {
    if (!rowVirtualizer || !scrollAreaRef.current) return; // Check if virtualizer/ref is initialized

    const targetIndex = typeof index === 'number' ? index : sortedMessages.length - 1;

    if (targetIndex >= 0) {
      // Use timeout to ensure DOM updates before scrolling, especially for 'smooth'
      // It also helps ensure the loading indicator (if present) is accounted for in scrollHeight
      setTimeout(() => {
        if (!scrollAreaRef.current) return; // Re-check ref inside timeout

         // If scrolling to the end, scroll to the actual bottom of the container
         // This ensures the loading indicator (if visible) is scrolled into view below messages
        if (alignment === 'end' && typeof index === 'undefined') {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: behavior
            });
        } else {
            // Cast behavior to union type accepted by rowVirtualizer
            rowVirtualizer.scrollToIndex(targetIndex, { align: alignment, behavior: behavior });
        }
      }, 0); // Reduced timeout, 0 should be sufficient to wait for next tick
    } else if (alignment === 'end' && sortedMessages.length === 0) {
      // If list is empty and scrolling to end, scroll to top
       setTimeout(() => {
            if (!scrollAreaRef.current) return;
            scrollAreaRef.current.scrollTo({ top: 0, behavior: behavior });
       }, 0);
    }


    // Update state refs after initiating scroll
    // Only reset userScrolledUp flag IF we are actually intending to scroll to the end
    if (alignment === 'end') {
       // Check if the scroll was actually initiated towards the end
       const isScrollingToEnd = typeof index === 'undefined' || index === sortedMessages.length - 1;
       if (isScrollingToEnd) {
          userScrolledUpRef.current = false;
          setShowScrollButton(false);
       }
    }
  }, [rowVirtualizer, sortedMessages.length]); // Dependency: sortedMessages.length

  // --- UPDATED: Replace scrollToBottom with scrollToBottomOrIndex usage ---
  const scrollToBottom = useCallback((behavior: "auto" | "smooth" = 'smooth') => {
    scrollToBottomOrIndex(undefined, behavior, 'end');
  }, [scrollToBottomOrIndex]);

  const handleFormSubmit = useCallback(async (inputText: string, files: File[]) => {
    if (isLoadingMessages || (!inputText.trim() && files.length === 0)) return;

    // Reset code panel logic for new message
    setUserClosedCodeSection(false);
    userScrolledUpRef.current = false; // Assume user wants to see the new message

    try {
      // Call context action with the provided text and files.
      await sendMessage(inputText, files);
      // No need to clear input or file state here; ChatInput manages its internal state.
      // Scroll happens via useEffect on currentMessages change
    } catch (error) {

    }
  }, [isLoadingMessages, sendMessage]); // Dependency added: scrollToBottom

  const handleModelSelect = useCallback((modelId: string) => {
    const newModel = availableModels.find((m) => m.id === modelId);
    if (newModel && newModel.id !== selectedModel?.id) {

      setLLMModel(newModel);
      // If the model has a locked/default prePrompt, set it immediately
      try {
        if (newModel.defaultPrePromptId) {
          setSelectedPrePromptId(newModel.defaultPrePromptId);
        }
      } catch {}
      // If desired, additional cleanup of file attachments can be handled here.
    }
  }, [selectedModel, setLLMModel]);

  const handleStopGenerating = useCallback(() => {
    stopGenerating();
  }, [stopGenerating]);

    const handleDriveModeToggle = useCallback(() => {
    setDriveModeActive(!driveModeActive);
    if (!driveModeActive) {
      setDriveModeStatus('Starting…');
      setDriveModeActiveModel(''); // Will be set by voice chat component
    } else {
      setDriveModeStatus('');
      setDriveModeActiveModel('');
    }
  }, [driveModeActive]);

  const handleDriveModeModelSwitch = useCallback(() => {
    // Restart Drive Mode with new model from settings
    setDriveModeRestart(prev => prev + 1);
    setDriveModeStatus('Switching model…');
    setDriveModeActiveModel('');
  }, []);

  const handleMorningBriefingRun = useCallback(() => {
    runRoutine('morning_briefing');
  }, [runRoutine]);

  const handleWeeklyReviewRun = useCallback(() => {
    runRoutine('weekly_review');
  }, [runRoutine]);

  const handleProactiveCheckinRun = useCallback(() => {
    runRoutine('proactive_checkin');
  }, [runRoutine]);

  const handleOpenHabitTracker = useCallback(() => {
    setHabitDialogOpen(true);
  }, []);

  const handleConnectCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/google/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo: '/' }),
      });
      if (!res.ok) throw new Error('Failed to initiate Google OAuth');
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('[ChatInterface] connectCalendar error', error);
      toast.error('Calendar connection failed', { description: 'Please try again in a moment.' });
    }
  }, []);

  const handleConnectGmail = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/gmail/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo: '/' }),
      });
      if (!res.ok) throw new Error('Failed to initiate Gmail OAuth');
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('[ChatInterface] connectGmail error', error);
      toast.error('Gmail connection failed', { description: 'Please try again in a moment.' });
    }
  }, []);

  const handleQuickPrompt = useCallback((text: string) => {
    if (!text) return;
    // Route quick prompts to the Tutorial Agent with vector search context
    const tutorialId = 'tutorial-agent';
    const prevPromptId = selectedPrePromptId;
    // If current model locks a prompt, do not override
    if (selectedModel?.defaultPrePromptId) {
      handleFormSubmit(text, []);
      return;
    }
    const wasVectorEnabled = isLoadingMessages ? false : undefined; // not used directly here
    // Use context actions if available
    try {
      setSelectedPrePromptId(tutorialId);
    } catch {}
    // Optionally, future: toggle vector/table search via dedicated toolbar; keep UI state unchanged here
    handleFormSubmit(text, []).finally(() => {
      // Restore previous agent selection to avoid surprising the user
      try { setSelectedPrePromptId(prevPromptId); } catch {}
    });
  }, [handleFormSubmit, selectedPrePromptId, setSelectedPrePromptId]);

  const handleForceCodePanel = useCallback(() => {
    setShowCodeSection(true);
    setUserClosedCodeSection(false);
  }, []);

  const handleShowCodeInPreview = useCallback((code: string, language: string | undefined) => {
    if (!code) return;
    setCodeBlocks([{
      language: language || 'plaintext',
      code,
      filename: '',
      isValid: true
    }]);
    setShowCodeSection(true);
    setUserClosedCodeSection(false);
  }, []);

  const handleCodeSectionClose = useCallback(() => {
    setShowCodeSection(false);
    setUserClosedCodeSection(true);
  }, []);

  const handleCopyToClipboard = useCallback(async (text: string, idToMark: string) => {
    if (!text) return;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        Object.assign(temp.style, { position: 'absolute', left: '-9999px' });
        document.body.appendChild(temp);
        temp.select();
        success = document.execCommand('copy');
        document.body.removeChild(temp);
      }
    } catch (err) {

      alert('Could not copy text. Permission denied or unsupported.');
    }
    if (success) {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (idToMark.startsWith('msg-')) {
        setCopiedMessageId(idToMark);
        setCopiedCodeBlockId(null);
      } else {
        setCopiedCodeBlockId(idToMark);
        setCopiedMessageId(null);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId(null);
        setCopiedCodeBlockId(null);
      }, 2000);
    }
  }, []);

  const handleManualScroll = useCallback(() => {
    const c = scrollAreaRef.current;
    if (!c) return;
    const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < SCROLL_THRESHOLD;
    // Only show scroll button if the user *manually* scrolled up
    setShowScrollButton(!isNearBottom && userScrolledUpRef.current);
     // Update user scrolled up state ONLY if they are not near the bottom
    if (!isNearBottom) {
        userScrolledUpRef.current = true;
    } else {
        // If they reach the bottom again while NOT loading (e.g. manual scroll down), reset the flag
        if (!isLoadingMessages) {
            userScrolledUpRef.current = false;
        }
        // If loading, the auto-scroll useEffect will manage the flag.
    }
  }, [isLoadingMessages]); // Dependency: isLoadingMessages affects flag reset

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Code extraction effect
  useEffect(() => {
    if (!isLoadingMessages && currentMessages.length > 0) {
      const last = sortedMessages[sortedMessages.length - 1];
      if (
        last.role === 'assistant' &&
        !last.id.startsWith('temp_') &&
        last.id !== lastProcessedMsgIdForCodeRef.current
      ) {
        const text = typeof last.content === 'string'
          ? last.content
          : Array.isArray(last.content)
          ? last.content.map(p => p.type === 'text' ? p.text : '').join('')
          : '';

        // Optional: check for an inline chart spec fenced as ```chart {json}
        try {
          const chartFenceRegex = /```chart\s+([\s\S]*?)```/i;
          const jsonFenceRegex = /```json\s+([\s\S]*?)```/i;
          const chartMatch = text.match(chartFenceRegex);
          const jsonMatch = text.match(jsonFenceRegex);
          if (chartMatch && chartMatch[1]) {
            const parsed = JSON.parse(chartMatch[1]);
            setDocumentChartSpec(parsed);
            const cleaned = text.replace(chartMatch[0], '').trim();
            setDocumentMarkdown(cleaned);
          } else if (jsonMatch && jsonMatch[1]) {
            // If a json fence contains a valid chart, use it
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              const hasAnyData = (parsed && (Array.isArray(parsed.data) || (Array.isArray(parsed.datasets) && parsed.datasets.length > 0)));
              if (parsed && (parsed.type === 'bar' || parsed.type === 'line' || parsed.type === 'pie') && hasAnyData) {
                setDocumentChartSpec(parsed);
                const cleaned = text.replace(jsonMatch[0], '').trim();
                setDocumentMarkdown(cleaned);
              } else {
                // proceed to bare JSON search
                throw new Error('not a chart');
              }
            } catch {
              // proceed
              
            }
          } else {
            // Fallback: detect a JSON object anywhere and try parsing as chart spec
            const extractLeadingJsonObject = (src: string): { json: string; rest: string } | null => {
              // Search for first top-level JSON object outside fenced blocks
              const s = src;
              let i = 0;
              let inFence = false;
              while (i < s.length) {
                if (s.startsWith('```', i)) {
                  inFence = !inFence;
                  i += 3;
                  continue;
                }
                if (!inFence) {
                  // skip whitespace
                  if (/\s/.test(s[i])) { i++; continue; }
                  if (s[i] === '{') {
                    let idx = i;
                    let depth = 0;
                    let inStr = false;
                    let esc = false;
                    while (idx < s.length) {
                      const ch = s[idx];
                      if (inStr) {
                        if (esc) { esc = false; }
                        else if (ch === '\\') { esc = true; }
                        else if (ch === '"') { inStr = false; }
                      } else {
                        if (ch === '"') inStr = true;
                        else if (ch === '{') depth++;
                        else if (ch === '}') { depth--; if (depth === 0) { idx++; break; } }
                        if (!inStr && s.startsWith('```', idx)) break;
                      }
                      idx++;
                    }
                    if (depth === 0) {
                      const json = s.slice(i, idx);
                      const rest = s.slice(0, i) + s.slice(idx);
                      return { json, rest };
                    }
                  }
                }
                i++;
              }
              return null;
            };

            const leading = extractLeadingJsonObject(text);
            if (leading) {
              try {
                const parsed = JSON.parse(leading.json);
                const hasAnyData = parsed && (Array.isArray(parsed.data) || (Array.isArray(parsed.datasets) && parsed.datasets.length > 0));
                if (parsed && (parsed.type === 'bar' || parsed.type === 'line' || parsed.type === 'pie') && hasAnyData) {
                  setDocumentChartSpec(parsed);
                  setDocumentMarkdown(leading.rest.trim());
                } else {
                  setDocumentChartSpec(null);
                  setDocumentMarkdown(text);
                }
              } catch {
                setDocumentChartSpec(null);
                setDocumentMarkdown(text);
              }
            } else {
              setDocumentChartSpec(null);
              // Populate document panel content (markdown) unchanged when no chart
              setDocumentMarkdown(text);
            }
          }
        } catch {
          setDocumentChartSpec(null);
          setDocumentMarkdown(text);
        }

        // Use enhanced extraction for better code block parsing
        const blocks = enhancedCodeExtraction(text);
        setCodeBlocks(blocks);

        const hasLargeCodeBlock = blocks.some(
          (b) => b.isValid && b.code.split('\n').length >= MIN_CODE_LINES_TO_AUTO_SHOW
        );
        if (hasLargeCodeBlock && !userClosedCodeSection) {
          setShowCodeSection(true);
        }

        lastProcessedMsgIdForCodeRef.current = last.id;
      }
    }
     // Clear code blocks when loading starts to prevent showing stale code
     if (isLoadingMessages) {
        // Maybe only clear if there's actually an active conversation?
        // if(activeConversationId) setCodeBlocks([]);
        // Or clear immediately:
        setCodeBlocks([]);
  // Clear doc content while streaming new
  setDocumentMarkdown("");
  setDocumentChartSpec(null);
     }
  }, [isLoadingMessages, currentMessages, sortedMessages, userClosedCodeSection, activeConversationId]); // Dependencies updated

  // Auto-scroll effect - REFINED LOGIC (as discussed)
  useEffect(() => {
    // Only auto-scroll if the user hasn't manually scrolled up
    if (!userScrolledUpRef.current && scrollAreaRef.current) {
      const scrollEl = scrollAreaRef.current;
      // Check if near bottom. Use a slightly larger threshold during streaming?
      const checkThreshold = isLoadingMessages ? SCROLL_THRESHOLD * 2 : SCROLL_THRESHOLD;
      const isNearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < checkThreshold;

      if (isLoadingMessages) {
        // DURING STREAMING:
        // Only explicitly force scroll if we are NOT already near the bottom.
        // Let the browser handle incremental scrolls if we're already there.
        if (!isNearBottom) {
          // Not near bottom, force a scroll jump to catch up
          scrollToBottomOrIndex(undefined, 'auto');
          
        } else {
          // Already near bottom, do nothing, let browser handle content push
          // Ensure the flag remains false if we are at the bottom during loading
          userScrolledUpRef.current = false;
          setShowScrollButton(false);
         
        }
      } else {
        // AFTER STREAMING FINISHES (isLoadingMessages is false):
        // Scroll smoothly to the final position if messages exist and it's not the initial load/switch.
        const isInitialLoadOrSwitch = sortedMessages.length <= 1;
        if (sortedMessages.length > 0 && !isInitialLoadOrSwitch) {
             scrollToBottomOrIndex(undefined, 'smooth');
            
        } else if (sortedMessages.length > 0 && isInitialLoadOrSwitch) {
            // On initial load/switch, just 'auto' scroll once.
            scrollToBottomOrIndex(undefined, 'auto');
      
        }
         // Ensure the flag is reset if we ended up at the bottom
         if (isNearBottom) {
            userScrolledUpRef.current = false;
            setShowScrollButton(false);
         }
      }
    } else if (userScrolledUpRef.current && scrollAreaRef.current) {
        // User has scrolled up, ensure the button is showing if appropriate
        const scrollEl = scrollAreaRef.current;
        const isNearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < SCROLL_THRESHOLD;
        setShowScrollButton(!isNearBottom);
      
    }

  }, [currentMessages, isLoadingMessages, scrollToBottomOrIndex, sortedMessages.length]); // Dependencies remain the same


 // Scroll listener effect - Minor refinement
  useEffect(() => {
    const c = scrollAreaRef.current;
    // Define the handler using useCallback to ensure stability if handleManualScroll's deps change
    const listener = handleManualScroll;
    if (!c) return;
    // Passive listener for better scroll performance
    c.addEventListener('scroll', listener, { passive: true });
    // Initial check in case content is shorter than viewport
    listener(); // Call it once initially
    return () => {
      if (c) { // Ensure c exists on cleanup
         c.removeEventListener('scroll', listener);
      }
    };
  }, [handleManualScroll]); // Dependency: handleManualScroll callback

  // Effect for conversation switching
  useEffect(() => {
 
    // Reset state specific to the chat view when conversation changes
    setCodeBlocks([]);
    setShowCodeSection(false);
    setUserClosedCodeSection(false);
    setExpandedCodeBlocks({});
    lastProcessedMsgIdForCodeRef.current = null;
    userScrolledUpRef.current = false; // Reset scroll lock
    setShowScrollButton(false); // Hide scroll button

    // Use a minimal timeout to ensure state resets propagate and DOM is ready
    // Use 'auto' for instant jump on conversation switch
    setTimeout(() => scrollToBottomOrIndex(undefined, 'auto'), 50);

  }, [activeConversationId, scrollToBottomOrIndex]); // Dependencies: activeConversationId, scrollToBottomOrIndex

  // Effect to clear expanded code blocks when loading starts (optional)
  useEffect(() => {
     // Optionally clear expanded blocks when assistant *starts* thinking
     if (isLoadingMessages) {
       setExpandedCodeBlocks({});
     }
  }, [isLoadingMessages]);


  return (
    <div
      className={`chat-interface-container flex flex-col h-full w-full bg-transparent ${
        activeConversationId ? 'conversation-active' : 'no-conversation'
      }`}
      key={activeConversationId || 'new-chat-interface'} // Force re-render on conversation change
    >
      {/** Reduce reserved bottom space when there are no messages to make the welcome fit better */}
      <div className="px-2 sm:px-4 pt-2">
        {sortedMessages.length > 0 && <RoutinesBar onStartDriveMode={handleDriveModeToggle} />}
      </div>
      {/* Main Content Area (Messages + Code Panel) */}
      <div className="flex-1 overflow-hidden relative bg-transparent">
        <ResizableSplitView
          codeBlocks={memoizedCodeBlocks}
          showCodePanel={showCodeSection}
          onCloseCodePanel={handleCodeSectionClose}
          documentMarkdown={documentMarkdown}
          documentChartSpec={documentChartSpec}
          documentMessageId={sortedMessages[sortedMessages.length - 1]?.id || 'doc'}
          key={`split-view-${activeConversationId || 'new'}`} // Ensure split view also resets if needed
        >
          {/* Main scrollable chat area (the ONLY vertical scroll container) */}
          <div
            className="h-full w-full overflow-y-auto px-2 sm:px-4 py-2 pb-2 custom-scrollbar relative bg-transparent"
            ref={scrollAreaRef}
            style={{ paddingBottom: (sortedMessages.length === 0 ? 'clamp(60px, 10vh, 120px)' : 'clamp(30px, 12vh, 50px)') } as React.CSSProperties}
          >
            {/* Empty state welcome when there are no messages and not loading */}
            {sortedMessages.length === 0 && !isLoadingMessages && (
              <div className="flex items-start justify-center px-3 pt-2 pb-4 min-h-full">
                <EmptyChatWelcome
                  onQuickPrompt={handleQuickPrompt}
                  onStartDriveMode={handleDriveModeToggle}
                  onRunMorningBriefing={handleMorningBriefingRun}
                  onRunWeeklyReview={handleWeeklyReviewRun}
                  onRunProactiveCheckin={handleProactiveCheckinRun}
                  onOpenHabitTracker={handleOpenHabitTracker}
                  onConnectCalendar={handleConnectCalendar}
                  onConnectGmail={handleConnectGmail}
                />
              </div>
            )}
            {/* *** Outer wrapper div needed by virtualizer for total height *** */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`, // Sets the scrollable height for messages
                width: '100%',
                position: 'relative', // Needed for absolute positioning of virtual items
              }}
              className={`${chatMaxWidthClass} mx-auto bg-transparent pb-2`}
            >
              {/* *** Map over virtualItems *** */}
              {virtualItems.map((virtualRow) => {
                const message = sortedMessages[virtualRow.index];

                // Basic check in case message is somehow undefined
                if (!message) {

                  return null;
                }

                return (
                  // *** Inner wrapper div for absolute positioning and spacing ***
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index} // Useful for debugging
                    // Critical: let the virtualizer measure after render
                    ref={(node) => {
                      if (node) rowVirtualizer.measureElement(node);
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`, // Position item
                      paddingBottom: '12px', // Add spacing between items here
                    }}
                  >
                    <MessageItem
                      message={message} // Pass the correct message
                      selectedModelName={selectedModel?.name}
                      selectedModelProviderId={selectedModel?.providerId}
                      isLoadingMessages={false} // Individual messages aren't aware of global loading state
                      expandedCodeBlocks={expandedCodeBlocks}
                      setExpandedCodeBlocks={setExpandedCodeBlocks}
                      copiedCodeBlockId={copiedCodeBlockId}
                      onCopyToClipboard={handleCopyToClipboard}
                      onShowCodeInPreview={handleShowCodeInPreview}
                      isStreaming={isLoadingMessages && virtualRow.index === sortedMessages.length - 1 && message.role === 'assistant'}
                    onOpenInDoc={() => {
                      // When clicked, show this message's markdown in the document panel
                      const text = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                        ? message.content.map(p => p.type === 'text' ? p.text : '').join('\n')
                        : '';
                      // Extract first chart (if any) and strip it from markdown, reusing the same logic as main effect
                      try {
                        const chartFenceRegex = /```chart\s+([\s\S]*?)```/i;
                        const jsonFenceRegex = /```json\s+([\s\S]*?)```/i;
                        const chartMatch = text.match(chartFenceRegex);
                        const jsonMatch = text.match(jsonFenceRegex);
                        if (chartMatch && chartMatch[1]) {
                          setDocumentChartSpec(JSON.parse(chartMatch[1]));
                          setDocumentMarkdown(text.replace(chartMatch[0], '').trim());
                          setShowCodeSection(true);
                          return;
                        }
                        if (jsonMatch && jsonMatch[1]) {
                          const parsed = JSON.parse(jsonMatch[1]);
                          const hasAnyData = (parsed && (Array.isArray(parsed.data) || (Array.isArray(parsed.datasets) && parsed.datasets.length > 0)));
                          if (parsed && (parsed.type === 'bar' || parsed.type === 'line' || parsed.type === 'pie') && hasAnyData) {
                            setDocumentChartSpec(parsed);
                            setDocumentMarkdown(text.replace(jsonMatch[0], '').trim());
                            setShowCodeSection(true);
                            return;
                          }
                        }
                        // Fallback: set markdown as-is
                        setDocumentChartSpec(null);
                        setDocumentMarkdown(text);
                        setShowCodeSection(true);
                      } catch {
                        setDocumentChartSpec(null);
                        setDocumentMarkdown(text);
                        setShowCodeSection(true);
                      }
                    }}
                      isCopied={copiedMessageId === message.id}
                      onDelete={async (id) => {
                        try {
                          await deleteMessage(id);
                        } catch {}
                      }}
                    />
                  </div>
                );
              })}
            </div> {/* End of Virtualizer Container */}

            {/* REMOVED Loading Indicator from here */}

            {/* Scroll Button (Remains fixed relative to viewport) */}
            <Button
              variant="outline"
              size="icon"
              className={`fixed bottom-24 right-6 z-30 transition-all duration-300 rounded-full shadow-lg border bg-background/80 backdrop-blur-sm hover:bg-muted/80 ${
                showScrollButton
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 pointer-events-none scale-90'
              }`}
              // Updated onClick to ensure smooth scroll to the very end
              onClick={() => scrollToBottomOrIndex(undefined, 'smooth', 'end')}
              aria-label="Scroll to bottom"
            >
              <ScrollDownIcon className="h-5 w-5 text-muted-foreground" />
            </Button>

          </div> {/* End of Scrollable Area */}
        </ResizableSplitView>
      </div> {/* End of Main Content Area */}

      {/* Container for Thinking Indicator and Input */}
      <div className="flex flex-col border-t border-border/40 pt-2 pb-1 bg-transparent chat-input-sticky-spacer">
          {/* Loading Indicator (Moved Here) */}
          {isLoadingMessages && (
            // Note: Removed 'mt-4'. Added padding adjustments for placement.
            <div className="w-full flex justify-center pb-2"> {/* Removed mt-4, kept pb-2 */}
              <div className="flex justify-center py-1"> {/* Reduced py */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 dark:bg-muted/30 backdrop-blur-sm rounded-full shadow-sm text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <span
                      className="thinking-dot animate-pulse-gentle"
                      style={{ animationDelay: '0ms' }}
                    >
                      •
                    </span>
                    <span
                      className="thinking-dot animate-pulse-gentle"
                      style={{ animationDelay: '200ms' }}
                    >
                      •
                    </span>
                    <span
                      className="thinking-dot animate-pulse-gentle"
                      style={{ animationDelay: '400ms' }}
                    >
                      •
                    </span>
                  </div>
                  <span className="font-medium">{thinkingStatus}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 h-6 w-6 p-0 rounded-full"
                    onClick={handleStopGenerating}
                    aria-label="Stop generating"
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Input Area */}
          <div className="dark">
          <ChatInput
            // ADDED: Pass the updated form submit handler as onSubmit prop
            onSubmit={handleFormSubmit}
            // --- Pass other required props ---
            isProcessing={isLoadingMessages}
            error={chatProviderError ? new Error(chatProviderError) : null}
            selectedModel={selectedModel}
            availableModels={availableModels}
            handleModelSelect={handleModelSelect}
            handleStopGenerating={handleStopGenerating}
            prePrompts={prePrompts}                     // Pass prePrompts data
            selectedPrePromptId={selectedPrePromptId}   // Pass current selected pre-prompt ID
            handlePrePromptSelect={setSelectedPrePromptId} // Pass context action to update selected pre-prompt
            driveModeActive={driveModeActive}
            onDriveModeToggle={handleDriveModeToggle}
          />
          </div>
      </div> {/* End of Indicator/Input container */}

      {/* Drive Mode Overlay and Voice Session */}
      {driveModeActive && (
        <>
          <DriveModeOverlay
            visible={true}
            statusText={driveModeStatus || 'Listening…'}
            activeModel={driveModeActiveModel}
            onEnd={() => setDriveModeActive(false)}
            onModelSwitch={handleDriveModeModelSwitch}
            onRestart={() => setDriveModeRestart(prev => prev + 1)}
          />
          <DriveModeVoiceChat
            key={driveModeRestart} // Force restart when model changes
            onStatus={(s) => setDriveModeStatus(s)}
            onEnded={() => setDriveModeActive(false)}
            onModelActive={(model) => setDriveModeActiveModel(model)}
          />
        </>
      )}

      {/* Habit Tracker dialog (shared entry point for home screen) */}
      <HabitTrackerDialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen} />

      {/* Agent Manager Dialog (two-pane) */}
      <AgentManagerDialog
        open={isAgentManagerOpen}
        onOpenChange={setIsAgentManagerOpen}
        builtins={prePrompts.map(p => ({ id: p.id, name: p.name, description: p.description, content: p.content }))}
        initialCustomAgents={customAgents as AgentDefinition[]}
        initialPreferences={agentPreferences as AgentPreference[]}
      />
    </div>
  );
}

