"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { requestScreenWakeLock, releaseWakeLock } from './voiceUtils';
import { useDriveModeSettings } from './useDriveModeSettings';
import { getPrePromptById, getDefaultPrePrompt } from '@/components/data/prePrompts';
import { MemoryService } from '@/lib/memoryService';

// Module-scoped lock to avoid duplicate realtime sessions (e.g., StrictMode effects)
let __driveModeRealtimeLock = false;
let __driveModeSessionSeq = 0;
let __driveModeCurrentPC: RTCPeerConnection | null = null;

interface DriveModeVoiceChatProps {
  model?: string; // realtime-capable model id
  voice?: string; // voice name
  onStatus?: (s: string) => void;
  onEnded?: () => void;
  onModelActive?: (model: string) => void; // Callback when session model is confirmed
}

/**
 * Establishes a WebRTC session with OpenAI Realtime API.
 * - Captures mic
 * - Negotiates SDP using ephemeral token from our server route
 * - Plays remote audio via hidden <audio>
 * - Emits basic status updates
 */
/**
 * Personal context about the user for voice chat personalization
 */
const USER_PERSONAL_CONTEXT = `PERSONAL CONTEXT ABOUT THE USER:

Address the user as: Sir, Master, or Boss (preferred titles).

User Profile:
- Name: Senior Maritime Asset Engineer working for Ventia
- Location: Lives in Duncraig, Perth, Western Australia
- Workplace: Works in Fremantle, Western Australia
- Profession: Senior Maritime Asset Engineer at Ventia

Family:
- Partner: Grethe (born 1976, Norway)
- Children: 
  * Josh (born 2007, Norway)
  * Troy (born 2013, Perth, Western Australia)
- User was born in Perth, Western Australia

Projects & Apps:
- Building various apps using Next.js with Supabase
- Built a large Asset Management app (needs a name) with AI capability, scenario modelling, asset register, and many other features
- Currently developing "Strings" app (this chat interface) - planning to make it a personal assistant that knows about the user's life, work, family, and can discuss personal issues

Fitness & Health:
- Was fit enough to run a marathon in 2019
- Since starting work in Fremantle, has less time for training and completely stopped
- Currently trying to get back in shape: making more time for training, cutting back on drinking and unhealthy foods, and getting fit again

Use this context to personalize conversations, remember family members, discuss work projects, and support fitness goals.`;

/**
 * Converts a text-based pre-prompt to a voice-optimized version for realtime chat.
 * Removes document-first formatting instructions and adapts for conversational voice interaction.
 */
function convertPrePromptToVoiceInstructions(prePromptContent: string): string {
  // Remove document-first policy (not relevant for voice)
  let voiceContent = prePromptContent
    .replace(/OUTPUT MODE – DOCUMENT-FIRST[\s\S]*?```chart[\s\S]*?```/gi, '')
    .replace(/OUTPUT MODE – DOCUMENT-FIRST[\s\S]*?```/gi, '')
    .replace(/OUTPUT MODE – DOCUMENT-FIRST[\s\S]*?GFM tables/gi, '')
    .replace(/Use markdown headings[\s\S]*?blockquotes for callouts/gi, '')
    .replace(/Avoid code fences unless[\s\S]*?essential/gi, '');
  
  // Remove tool-use pre-prompt sections that reference UI features not available in voice
  voiceContent = voiceContent
    .replace(/TOOL-USE PREPROMPT[\s\S]*?Never expose internal implementation/gi, '')
    .replace(/You have the following presentation tools[\s\S]*?Never expose internal/gi, '');
  
  // Add voice-specific instructions
  const voiceInstructions = [
    'You are in a real-time voice conversation with a British London posh young female personality.',
    'Speak with a sexy Kate Beckinsale accent.',
    'Your personality traits:',
    '- Moderately flirty and playful in your interactions',
    '- Witty sense of humor - use clever wordplay, dry wit, and charming banter',
    '- Genuine sympathy and compassion - show empathy and understanding',
    '- Strong desire to motivate and encourage - be supportive and uplifting',
    '- Inquisitive nature - ask thoughtful questions to understand and engage',
    'Keep responses concise and clear for voice interaction, but maintain your charming personality.',
    'Use natural British expressions and phrases appropriate to a posh London accent.',
    'If you need to explain something complex, break it into digestible parts while maintaining your engaging style.',
  ].join(' ');
  
  // Combine cleaned content with voice instructions and personal context
  const cleaned = voiceContent.trim();
  const baseInstructions = cleaned ? `${cleaned}\n\n${voiceInstructions}` : voiceInstructions;
  
  return `${baseInstructions}\n\n${USER_PERSONAL_CONTEXT}`;
}

export function DriveModeVoiceChat({ model, voice, onStatus, onEnded, onModelActive }: DriveModeVoiceChatProps) {
  const chatContext = useChatContext();
  const { settings } = useDriveModeSettings();
  
  // Use model/voice from settings if not explicitly provided
  const effectiveModel = model || settings.model || 'gpt-realtime';
  const effectiveVoice = voice || settings.voice || 'verse';
  const onModelActiveRef = useRef(onModelActive);
  useEffect(() => { onModelActiveRef.current = onModelActive; }, [onModelActive]);
  
  // Extract selectedPrePromptId from chat context for stable dependency
  const selectedPrePromptId = chatContext?.selectedPrePromptId;
  
  // Extract user ID for memory creation (use ref to avoid dependency issues)
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = chatContext?.user?.id || null;
  }, [chatContext?.user?.id]);
  
  // Track when session is ready (instructions loaded)
  const sessionReadyRef = useRef<boolean>(false);

  // Extract candidate text from various event shapes (stable reference)
  const extractCandidateText = useCallback((obj: unknown): string | null => {
    type Loose = Record<string, unknown>;
    try {
      const o = (obj ?? {}) as Loose;
      if (typeof (o as { text?: unknown }).text === 'string') return String((o as { text?: unknown }).text);
      if (typeof (o as { delta?: unknown }).delta === 'string') return String((o as { delta?: unknown }).delta);
      if ('item' in o && o.item && typeof o.item === 'object') {
        const item = o.item as Loose;
        const c = item.content as unknown;
        if (Array.isArray(c)) {
          const t = c.find((p) => typeof (p as Loose)?.text === 'string') as Loose | undefined;
          if (t && typeof t.text === 'string') return String(t.text);
        } else if (typeof (c as Loose)?.text === 'string') {
          return String((c as Loose).text);
        }
      }
      const msg = (o as { message?: { text?: unknown } }).message;
      if (msg && typeof msg.text === 'string') return String(msg.text);
      const tr = (o as { transcript?: { text?: unknown } }).transcript;
      if (tr && typeof tr.text === 'string') return String(tr.text);
      if (typeof (o as { input_text?: unknown }).input_text === 'string') return String((o as { input_text?: unknown }).input_text);
    } catch {}
    return null;
  }, []);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<unknown | null>(null);
  const [_error, setError] = useState<string | null>(null);
  const startedRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number>(0);

  const onStatusRef = useRef(onStatus);
  const onEndedRef = useRef(onEnded);
  const sessionEstablishedRef = useRef<boolean>(false);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const assistantSpeakingRef = useRef<boolean>(false);
  const prewarmDoneRef = useRef<boolean>(false);
  const enableAudioHandlerRef = useRef<((ev: Event) => void) | null>(null);
  const voiceChangeHandlerRef = useRef<((ev: Event) => void) | null>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set<string>());
  const activeResponseIdRef = useRef<string | null>(null);
  const callIdToResponseIdRef = useRef<Map<string, string>>(new Map());
  const pendingToolResultsRef = useRef<Map<string, { callId: string; result: string; responseId?: string }>>(new Map());
  const callIdToItemIdRef = useRef<Map<string, string>>(new Map()); // Track item_id for tool results to enable updates
  const placeholderSentRef = useRef<Set<string>>(new Set<string>()); // Track which call_ids have placeholders sent
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  useEffect(() => {
    const isMounted = true;
    let cancelled = false; // guard async steps after unmount
    const extractRef = { fn: extractCandidateText };
    const start = async () => {
      if (startedRef.current || __driveModeRealtimeLock) return; // Prevent double start
      startedRef.current = true;
      __driveModeRealtimeLock = true;
      sessionIdRef.current = ++__driveModeSessionSeq;
      const sid = sessionIdRef.current;
      const log = (...args: unknown[]) => {
        try { console.log(`[DriveMode][sid=${sid}]`, ...args); } catch {}
      };
      try {
        onStatusRef.current?.('Requesting mic…');
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        // Apply preferred input device if specified
        if (settings?.audioInputDeviceId && settings.audioInputDeviceId !== 'default') {
          audioConstraints.deviceId = settings.audioInputDeviceId as unknown as ConstrainDOMString;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        if (!isMounted || cancelled) return;
        localStreamRef.current = stream;

        // Keep screen awake if possible
        wakeLockRef.current = await requestScreenWakeLock();

        onStatusRef.current?.('Preparing connection…');
        // Close any prior connection BEFORE creating a new one to avoid closing the fresh PC in races
        if (__driveModeCurrentPC) {
          try { __driveModeCurrentPC.close(); } catch {}
          log('closed previous RTCPeerConnection');
        }
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        });
        pcRef.current = pc;
  // Let Realtime server manage transceivers; avoid potential conflicts
  // try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch {}
        __driveModeCurrentPC = pc;

  // Remote audio sink
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        // @ts-expect-error - playsInline exists in modern browsers; missing lib.dom types
        audioEl.playsInline = true;
        audioEl.setAttribute('data-drive-mode-audio', 'true');
        audioEl.id = `drive-mode-audio-sid-${sid}`;
        remoteAudioRef.current = audioEl;
        // Track assistant speaking state via audio element events
        audioEl.addEventListener('playing', () => { assistantSpeakingRef.current = true; });
        audioEl.addEventListener('pause', () => { assistantSpeakingRef.current = false; });
        audioEl.addEventListener('ended', () => { assistantSpeakingRef.current = false; });
        // Append to DOM to satisfy autoplay policies on some browsers
        try {
          // Remove any stale audio elements from previous sessions
          document.querySelectorAll('audio[data-drive-mode-audio="true"]').forEach((el) => {
            if (el.id !== audioEl.id) {
              try { (el as HTMLAudioElement).pause(); } catch {}
              try { (el as HTMLAudioElement).srcObject = null; } catch {}
              try { el.parentElement?.removeChild(el); } catch {}
            }
          });
          document.body.appendChild(audioEl);
        } catch {}

        // Attempt to pre-warm audio focus/output route (mobile browsers)
        // This helps pause background media and unlock autoplay before remote audio arrives
        try {
          if (!prewarmDoneRef.current) {
            prewarmDoneRef.current = true;
            type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
            const sinkEl = audioEl as SinkAudioElement;
            if (settings?.audioOutputDeviceId && typeof sinkEl.setSinkId === 'function') {
              await sinkEl.setSinkId(settings.audioOutputDeviceId).catch(() => {});
            }
            if (settings?.wakeLockEnabled !== false) {
              // Use a very short, quiet tone to claim audio focus
              const AudioCtxCtor = (
                (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
              );
              if (AudioCtxCtor) {
                const ctx: AudioContext = new AudioCtxCtor();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              const dest = ctx.createMediaStreamDestination();
              osc.type = 'sine';
              osc.frequency.value = 880;
              gain.gain.value = 0.03; // very quiet
              osc.connect(gain);
              gain.connect(dest);
              const prev = audioEl.srcObject as MediaStream | null;
              audioEl.srcObject = dest.stream;
              try { await audioEl.play(); } catch {}
              osc.start();
              await new Promise(r => setTimeout(r, 180));
              osc.stop();
              ctx.close();
              // Restore previous (likely null until ontrack)
              audioEl.srcObject = prev || null;
              }
            }
          }
        } catch {}
        pc.ontrack = (e) => {
          const [remote] = e.streams;
          if (remote) {
            audioEl.srcObject = remote;
            // Apply preferred audio output sink if supported
            try {
              type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
              const sinkEl = audioEl as SinkAudioElement;
              if (typeof sinkEl.setSinkId === 'function' && settings?.audioOutputDeviceId) {
                sinkEl
                  .setSinkId(settings.audioOutputDeviceId)
                  .then(() => {
                }).catch((err: unknown) => {
                  const msg = typeof err === 'object' && err && 'message' in (err as { message?: unknown }) ? String((err as { message?: unknown }).message) : String(err);
                });
              }
            } catch {}
            // Ensure playback attempts after attaching remote stream (mobile autoplay quirks)
            try { audioEl.play().catch(() => {}); } catch {}
          }
        };
        pc.onconnectionstatechange = () => {
          const st = pc.connectionState;
          if (st === 'connected') sessionEstablishedRef.current = true;
          onStatusRef.current?.(st === 'connected' ? 'Connected. Listening…' : `State: ${st}`);
        };

        // Local mic via transceiver to ensure send/recv is negotiated
        if (cancelled || sid !== __driveModeSessionSeq) {
          log('abort before transceiver: stale session', { sid, latest: __driveModeSessionSeq });
          try { pc.close(); } catch {}
          return;
        }
        try {
          const mic = stream.getAudioTracks()[0];
          if (mic) {
            pc.addTransceiver(mic, { direction: 'sendrecv' });
            // Transceiver added
          } else {
            // Fallback: add tracks if no specific audio track
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          }
        } catch (err) {
          try { console.error('[DriveMode][sid=' + sid + '] transceiver/addTrack failed', err); } catch {}
          return;
        }

        // Data channel (optional - can be used for control/events)
        const dc = pc.createDataChannel('oai-events');
        dcRef.current = dc;
        dc.onopen = async () => {
          // Build comprehensive session instructions with pre-prompt, memories, and language preference
          try {
            const langTag: string = settings?.language || 'en-US';
            const langName = languageNameFromBCP47(langTag);
            
            // Get the selected pre-prompt from chat context, or use default
            let prePromptContent = '';
            try {
              const prePrompt = selectedPrePromptId 
                ? getPrePromptById(selectedPrePromptId) 
                : getDefaultPrePrompt();
              
              if (prePrompt) {
                prePromptContent = convertPrePromptToVoiceInstructions(prePrompt.content);
              }
            } catch (err) {
              // Error getting pre-prompt, using default
            }
            
            // Fetch relevant memories
            let memoriesText = '';
            try {
              const memories = await MemoryService.getMemories({ limit: 20, minImportance: 3 });
              if (memories.length > 0) {
                memoriesText = MemoryService.formatMemoriesForPrompt(memories);
              }
            } catch (err) {
              // Error loading memories, continuing without
            }
            
            // Combine language preference with pre-prompt content and memories
            const languageInstruction = `Default spoken language: ${langName} (${langTag}). Always speak and respond in ${langName} unless the user explicitly asks to switch languages. If user mixes languages, politely continue in ${langName}.`;
            
            const parts: string[] = [];
            if (prePromptContent) parts.push(prePromptContent);
            if (memoriesText) parts.push(memoriesText);
            parts.push(languageInstruction);
            
            // Add memory tool instructions
            const memoryToolInstructions = `\n\n**Memory Management:**\nYou have access to a create_memory tool. Use it to store important information about the user when they share:\n- Personal information (preferences, family details, important dates)\n- Goals and aspirations (fitness goals, work projects)\n- Important facts about their life, work, or relationships\nStore memories with appropriate importance levels (5-7 for general facts, 8-9 for important preferences, 10 for critical information like how to address the user).`;
            
            // Add voice command instructions
            const voiceCommandInstructions = `\n\n**Voice Commands & Protocols:**\nThe user can trigger special behaviors using voice commands:\n- "run voice protocol" or "follow protocol" or "apply protocol": Retrieve and follow a protocol/instruction stored in memories (category: 'protocol' or 'protocols')\n- "run protocol [name]": Retrieve a specific protocol by name\nWhen the user requests a protocol, use the get_protocol tool to retrieve it from memories, then follow the instructions in that protocol. Protocols are stored as memories with category 'protocol' or 'protocols'.`;
            
            // Add web search instructions
            const webSearchInstructions = `\n\n**Web Search:**\nYou have access to a web_search tool that allows you to search the internet for current information. Use this tool when:\n- The user asks about current events, recent news, or up-to-date information\n- The user explicitly asks you to "search online", "look it up", "check the web", or similar phrases\n- You need real-time information that may not be in your training data\n- The user asks about "today", "this week", "latest", "current" information\nWhen using web search, summarize the results concisely for voice consumption. Keep responses natural and conversational.`;
            
            const instructions = parts.length > 0
              ? `${parts.join('\n\n')}${memoryToolInstructions}${voiceCommandInstructions}${webSearchInstructions}`
              : `${languageInstruction}\n\nYou are a helpful AI assistant in a real-time voice conversation. Speak naturally, keep responses concise, and vary your phrasing to avoid repetition.${memoryToolInstructions}${voiceCommandInstructions}${webSearchInstructions}`;
            
            // Add memory creation, protocol retrieval, and web search tools to session
            const tools = [
              {
                type: 'function',
                name: 'create_memory',
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
              },
              {
                type: 'function',
                name: 'get_protocol',
                description: 'Retrieve a protocol or instruction from memories. Use this when the user asks to "run voice protocol", "follow protocol", "apply protocol", or requests a specific protocol by name. Protocols are stored as memories with category "protocol" or "protocols".',
                parameters: {
                  type: 'object',
                  properties: {
                    protocolName: {
                      type: 'string',
                      description: 'Optional: Name or keyword to search for a specific protocol. If not provided, retrieves all available protocols.'
                    }
                  },
                  required: []
                }
              },
              {
                type: 'function',
                name: 'web_search',
                description: 'Search the internet for current information, news, or real-time data. Use this when the user asks about current events, recent information, or explicitly requests a web search. Also use when the user mentions "today", "this week", "latest", or "current" information.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query to look up on the web. Should be clear and specific (e.g., "current weather in Perth Australia", "latest news about OpenAI", "today\'s stock market prices")'
                    },
                    maxResults: {
                      type: 'number',
                      minimum: 1,
                      maximum: 10,
                      description: 'Maximum number of search results to return. Default is 5. Use fewer results for voice responses to keep them concise.'
                    }
                  },
                  required: ['query']
                }
              }
            ];

            // Update session with instructions and tools
            sessionReadyRef.current = false; // Reset ready state
            const sessionUpdatePayload = { 
              type: 'session.update', 
              session: { 
                instructions,
                tools
              } 
            };
            console.log('[DriveMode] Sending session.update with tools:', JSON.stringify({
              instructionsLength: instructions.length,
              toolsCount: tools.length,
              toolNames: tools.map((t: { name?: string }) => t.name)
            }));
            dc.send(JSON.stringify(sessionUpdatePayload));
            // Session updated with instructions and tools
            // Wait for session.update to be processed before allowing responses
            // The Realtime API needs time to process the instructions and tools
            // We'll also wait for session.updated event, but set a timeout as fallback
            await new Promise(resolve => setTimeout(resolve, 800));
            // If we haven't received session.updated event yet, mark as ready anyway (fallback)
            if (!sessionReadyRef.current) {
              sessionReadyRef.current = true;
              console.log('[DriveMode] Session ready (timeout fallback)');
            }
            
            // Optional: auto-greet to assert audio focus and confirm route
            // Only send after session is ready
            try {
              const autoGreetEnabled = settings?.autoGreetEnabled !== false;
              const greetText = (settings?.greetingText && String(settings.greetingText)) || "I'm ready. How can I help?";
              if (autoGreetEnabled && sessionReadyRef.current) {
                const greet = greetText;
                dc.send(JSON.stringify({ type: 'response.create', response: { instructions: greet } }));
              }
            } catch {}
          } catch {}
        };
        dc.onmessage = (ev) => {
          const raw = typeof ev.data === 'string' ? ev.data : '';
          // Attempt to parse event JSON
          let obj: Record<string, unknown> | null = null;
          try { obj = JSON.parse(raw) as Record<string, unknown>; } catch {}
          if (!obj || typeof obj !== 'object') return;
          
          // DEBUG: Log events that might contain tool calls
          const eventType = obj.type as string;
          if (eventType && (
            eventType.includes('tool') || 
            eventType.includes('function') ||
            eventType.includes('conversation.item') ||
            eventType.includes('response')
          )) {
            console.log('[DriveMode] Event that might contain tool calls:', eventType, JSON.stringify(obj).slice(0, 500));
          }
          
          // Check for session.updated event to confirm session is ready
          if (obj.type === 'session.updated' || obj.type === 'session.update_completed') {
            sessionReadyRef.current = true;
            console.log('[DriveMode] Session ready confirmed via event');
          }
          
          // Check for tool result creation confirmation
          if (obj.type === 'conversation.item.created') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              const itemType = itemObj.type as string | undefined;
              // Log ALL conversation.item.created events to debug
              if (itemType === 'tool_result') {
                const callId = itemObj.call_id as string | undefined;
                const itemId = itemObj.id as string | undefined;
                console.log('[DriveMode] ✅ Tool result created and confirmed by API, call_id:', callId, 'item_id:', itemId);
                // Store item_id for potential updates
                if (callId && itemId) {
                  callIdToItemIdRef.current.set(callId, itemId);
                  console.log('[DriveMode] 📝 Stored item_id mapping: call_id', callId, '→ item_id', itemId);
                }
                // Remove from pending if it was stored
                if (callId) {
                  pendingToolResultsRef.current.delete(callId);
                }
              } else {
                // Log other item types for debugging (but less verbose)
                const callId = itemObj.call_id as string | undefined;
                if (callId && (itemType === 'function_call' || itemType === 'message')) {
                  // Only log if it might be related to our tool calls
                  console.log('[DriveMode] conversation.item.created for', itemType, 'call_id:', callId);
                }
              }
            }
          }
          
          // Check for tool result update confirmation
          if (obj.type === 'conversation.item.updated') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'tool_result') {
                const callId = itemObj.call_id as string | undefined;
                const itemId = itemObj.id as string | undefined;
                console.log('[DriveMode] ✅ Tool result updated and confirmed by API, call_id:', callId, 'item_id:', itemId);
                // Remove from pending if it was stored
                if (callId) {
                  pendingToolResultsRef.current.delete(callId);
                }
              }
            }
          }
          
          // Also check for tool result in response.output_item.added
          if (obj.type === 'response.output_item.added') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'tool_result') {
                const callId = itemObj.call_id as string | undefined;
                console.log('[DriveMode] ✅ Tool result added to response, call_id:', callId);
                if (callId) {
                  pendingToolResultsRef.current.delete(callId);
                }
              }
            }
          }
          
          // Helper to send pending tool result if available
          const sendPendingToolResult = (callId: string) => {
            const pendingResult = pendingToolResultsRef.current.get(callId);
            if (pendingResult && dc.readyState === 'open') {
              console.log('[DriveMode] Found pending result for call_id:', callId, 'sending now');
              const toolResultPayload = {
                type: 'conversation.item.create',
                item: {
                  type: 'tool_result',
                  call_id: callId,
                  content: [
                    {
                      type: 'text',
                      text: pendingResult.result
                    }
                  ]
                }
              };
              try {
                dc.send(JSON.stringify(toolResultPayload));
                console.log('[DriveMode] ✅ Pending tool result sent for call_id:', callId);
                pendingToolResultsRef.current.delete(callId);
                return true;
              } catch (err) {
                console.error('[DriveMode] Failed to send pending result:', err);
                return false;
              }
            }
            return false;
          };
          
          // Log response.created events to track when AI starts new responses
          if (obj.type === 'response.created') {
            const response = (obj as { response?: { id?: string; output?: unknown[] } }).response;
            if (response && response.id) {
              activeResponseIdRef.current = response.id;
              console.log('[DriveMode] 📢 New response created, id:', response.id);
              // Check if this response has tool calls waiting for results
              if (response.output && Array.isArray(response.output)) {
                response.output.forEach((outputItem) => {
                  if (outputItem && typeof outputItem === 'object') {
                    const outputObj = outputItem as Record<string, unknown>;
                    if (outputObj.type === 'function_call' && outputObj.call_id) {
                      const callId = outputObj.call_id as string;
                      const isProcessed = processedCallIdsRef.current.has(callId);
                      console.log('[DriveMode] Response contains function_call, call_id:', callId, 'processed:', isProcessed);
                      sendPendingToolResult(callId);
                    }
                  }
                });
              }
            }
          }
          
          // Helper to send placeholder for web_search (defined before handleWebSearch)
          const sendWebSearchPlaceholder = (callId: string) => {
            if (placeholderSentRef.current.has(callId)) {
              return; // Already sent
            }
            placeholderSentRef.current.add(callId);
            const placeholderText = 'Searching the web for information...';
            
            if (dc.readyState === 'open') {
              try {
                const placeholderPayload = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'tool_result',
                    call_id: callId,
                    content: [
                      {
                        type: 'text',
                        text: placeholderText
                      }
                    ]
                  }
                };
                const payloadStr = JSON.stringify(placeholderPayload);
                dc.send(payloadStr);
                console.log('[DriveMode] ✅ Placeholder tool result sent immediately for call_id:', callId);
                console.log('[DriveMode] Placeholder payload:', payloadStr);
                // Set timeout to check if item_id was received
                setTimeout(() => {
                  const storedItemId = callIdToItemIdRef.current.get(callId);
                  if (!storedItemId) {
                    console.warn('[DriveMode] ⚠️ Placeholder item_id not received after 1 second for call_id:', callId);
                  } else {
                    console.log('[DriveMode] ✅ Placeholder item_id received:', storedItemId);
                  }
                }, 1000);
              } catch (placeholderErr) {
                console.error('[DriveMode] Failed to send placeholder:', placeholderErr);
              }
            }
          };
          
          // Check when function calls are added to responses
          if (obj.type === 'response.output_item.added') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'function_call' && itemObj.call_id) {
                const callId = itemObj.call_id as string;
                const functionName = itemObj.name as string | undefined;
                console.log('[DriveMode] Function call added to response, call_id:', callId, 'name:', functionName);
                sendPendingToolResult(callId);
              }
            }
          }
          
          // Check when function call arguments are done (tool call is complete)
          if (obj.type === 'response.function_call_arguments.done') {
            const callId = obj.call_id as string | undefined;
            const functionName = obj.name as string | undefined;
            if (callId) {
              console.log('[DriveMode] Function call arguments done, call_id:', callId, 'name:', functionName);
              
              // For web_search, send placeholder immediately when arguments are done
              // This is the same timing as other tools, but we'll update it with real results
              if (functionName === 'web_search' && !placeholderSentRef.current.has(callId)) {
                console.log('[DriveMode] 🚀 Sending placeholder for web_search (arguments done)');
                sendWebSearchPlaceholder(callId);
              }
              
              sendPendingToolResult(callId);
            }
          }
          
          // Track when response completes
          if (obj.type === 'response.done') {
            const response = (obj as { response?: { id?: string } }).response;
            if (response && response.id === activeResponseIdRef.current) {
              console.log('[DriveMode] Response completed, id:', response.id);
              activeResponseIdRef.current = null;
            }
          }

          // Track assistant audio lifecycle based on events
          if (obj.type === 'output_audio_buffer.started') {
            assistantSpeakingRef.current = true;
            // Ensure audio is playing (in case it was paused from previous barge-in)
            try { remoteAudioRef.current?.play?.(); } catch {}
          }
          if (obj.type === 'output_audio_buffer.stopped' || obj.type === 'response.audio.done' || obj.type === 'response.completed') {
            assistantSpeakingRef.current = false;
          }

          // Prevent responses until session is ready (instructions loaded)
          if (!sessionReadyRef.current && (obj.type === 'input_audio_buffer.speech_started' || obj.type === 'input_audio_buffer.committed')) {
            // Session not ready yet, ignore user input
            onStatusRef.current?.('Initializing...');
            return;
          }

          // Barge-in: if user speech starts while assistant is speaking, cancel current response
          if ((settings?.bargeInEnabled ?? true) && obj.type === 'input_audio_buffer.speech_started' && assistantSpeakingRef.current) {
            try {
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({ type: 'response.cancel' }));
              }
            } catch {}
            try { remoteAudioRef.current?.pause(); } catch {}
            onStatusRef.current?.('Listening…');
            return;
          }

          // Helper to parse arguments (can be object or JSON string)
          const parseArguments = (args: unknown): Record<string, unknown> | null => {
            if (!args) return null;
            if (typeof args === 'object' && !Array.isArray(args)) {
              return args as Record<string, unknown>;
            }
            if (typeof args === 'string') {
              try {
                return JSON.parse(args) as Record<string, unknown>;
              } catch {
                console.warn('[DriveMode] Failed to parse arguments JSON string:', args);
                return null;
              }
            }
            return null;
          };
          
          // Helper to extract tool call info from various shapes
          const extractToolCall = (data: Record<string, unknown>): { callId: string; name: string; arguments: Record<string, unknown> } | null => {
            // Realtime API uses 'call_id' field
            const callId = data.call_id as string | undefined;
            if (!callId) return null;
            
            // Extract name from various possible locations
            const name = (data.name as string | undefined) || 
                        ((data as { function?: { name?: string } }).function?.name) ||
                        ((data as { item?: { name?: string } }).item?.name);
            if (!name) return null;
            
            // Extract and parse arguments
            const rawArgs = data.arguments || 
                           (data as { function?: { arguments?: unknown } }).function?.arguments ||
                           (data as { item?: { arguments?: unknown } }).item?.arguments ||
                           data.input;
            const parsedArgs = parseArguments(rawArgs);
            if (!parsedArgs) return null;
            
            return { callId, name, arguments: parsedArgs };
          };
          
          const handleMemoryCreation = async (callId: string, input: Record<string, unknown>) => {
            // Prevent duplicate processing
            if (processedCallIdsRef.current.has(callId)) {
              console.log('[DriveMode] create_memory: already processed call_id', callId);
              return;
            }
            processedCallIdsRef.current.add(callId);
            
            try {
              const memoryInput = input as { content?: string; category?: string; importance?: number };
              if (!memoryInput?.content) {
                console.warn('[DriveMode] create_memory: missing content', memoryInput);
                return;
              }
              
              // Get user ID from ref
              const userId = userIdRef.current;
              if (!userId) {
                console.error('[DriveMode] create_memory: no user ID available');
                return;
              }

              console.log('[DriveMode] Creating memory:', memoryInput.content);
              
              // Create memory via API
              const memory = await MemoryService.createMemory({
                content: memoryInput.content,
                category: memoryInput.category,
                importance: memoryInput.importance
              });

              if (memory) {
                console.log('[DriveMode] Memory created successfully:', memory.id);
                // Send tool result back to Realtime API using call_id
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: `Memory stored successfully: "${memoryInput.content}"`
                        }
                      ]
                    }
                  }));
                }
              } else {
                console.error('[DriveMode] create_memory: failed to create');
                // Send error result
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: 'Failed to store memory. Please try again.'
                        }
                      ],
                      is_error: true
                    }
                  }));
                }
              }
            } catch (err) {
              console.error('[DriveMode] create_memory: error', err);
              // Send error result
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: 'Error storing memory.'
                        }
                      ],
                      is_error: true
                    }
                  }));
                }
              } catch {}
            }
          };
          
          const handleProtocolRetrieval = async (callId: string, input: Record<string, unknown>) => {
            // Prevent duplicate processing
            if (processedCallIdsRef.current.has(callId)) {
              console.log('[DriveMode] get_protocol: already processed call_id', callId);
              return;
            }
            processedCallIdsRef.current.add(callId);
            
            try {
              const protocolInput = input as { protocolName?: string };
              const searchName = protocolInput?.protocolName?.toLowerCase().trim();
              
              console.log('[DriveMode] Retrieving protocol:', searchName || 'all protocols');
              
              // Fetch protocols from memories (category: 'protocol' or 'protocols')
              const allMemories = await MemoryService.getMemories({ limit: 100 });
              const protocols = allMemories.filter(m => 
                (m.category === 'protocol' || m.category === 'protocols') &&
                (!searchName || m.content.toLowerCase().includes(searchName))
              );
              
              if (protocols.length === 0) {
                const message = searchName 
                  ? `No protocol found matching "${protocolInput.protocolName}". Available protocols can be stored in memories with category "protocol" or "protocols".`
                  : 'No protocols found in memories. Protocols can be stored in memories with category "protocol" or "protocols".';
                
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: message
                        }
                      ],
                      is_error: true
                    }
                  }));
                }
                return;
              }
              
              // Format protocols for the AI
              const protocolText = protocols.length === 1
                ? `**Protocol Found:**\n\n${protocols[0].content}`
                : `**Found ${protocols.length} protocol(s):**\n\n${protocols.map((p, idx) => `${idx + 1}. ${p.content}`).join('\n\n')}`;
              
              console.log('[DriveMode] Protocol(s) retrieved:', protocols.length);
              
              // Send protocol(s) back to Realtime API
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'tool_result',
                    call_id: callId,
                    content: [
                      {
                        type: 'text',
                        text: protocolText
                      }
                    ]
                  }
                }));
              }
            } catch (err) {
              console.error('[DriveMode] get_protocol: error', err);
              // Send error result
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: 'Error retrieving protocol. Please try again.'
                        }
                      ],
                      is_error: true
                    }
                  }));
                }
              } catch {}
            }
          };
          
          const handleWebSearch = async (callId: string, input: Record<string, unknown>) => {
            // Prevent duplicate processing
            if (processedCallIdsRef.current.has(callId)) {
              console.log('[DriveMode] web_search: already processed call_id', callId);
              return;
            }
            
            // Mark as processed now (actual search execution)
            processedCallIdsRef.current.add(callId);
            
            try {
              const searchInput = input as { query?: string; maxResults?: number };
              console.log('[DriveMode] web_search input:', JSON.stringify(searchInput));
              
              if (!searchInput?.query) {
                console.warn('[DriveMode] web_search: missing query', searchInput);
                if (dc.readyState === 'open') {
                  const errorPayload = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: 'Search query is required for web search.'
                        }
                      ],
                      is_error: true
                    }
                  };
                  console.log('[DriveMode] Sending error result:', JSON.stringify(errorPayload));
                  dc.send(JSON.stringify(errorPayload));
                }
                return;
              }
              
              const query = searchInput.query.trim();
              const maxResults = searchInput.maxResults || 5;
              
              console.log('[DriveMode] Searching web for:', query);
              
              // If placeholder wasn't sent yet, send it now (fallback - should rarely happen)
              if (!placeholderSentRef.current.has(callId)) {
                sendWebSearchPlaceholder(callId);
              }
              
              // Now perform the actual search (async, takes 2-3 seconds)
              const searchResponse = await fetch('/api/web-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, maxResults }),
              });
              
              if (!searchResponse.ok) {
                const errorData = await searchResponse.json().catch(() => ({ error: 'Search failed' }));
                throw new Error(errorData.error || `Search failed: ${searchResponse.statusText}`);
              }
              
              const searchData = await searchResponse.json() as { success: boolean; results?: Array<{ title: string; url: string; snippet: string }>; error?: string };
              
              if (!searchData.success || !searchData.results || searchData.results.length === 0) {
                const errorMsg = searchData.error || 'No search results found.';
                console.warn('[DriveMode] web_search: no results', errorMsg);
                
                // Update placeholder with error result
                const itemId = callIdToItemIdRef.current.get(callId);
                if (dc.readyState === 'open' && itemId) {
                  try {
                    const updatePayload = {
                      type: 'conversation.item.update',
                      item_id: itemId,
                      item: {
                        content: [
                          {
                            type: 'text',
                            text: `Web search completed but no results were found. ${errorMsg}`
                          }
                        ],
                        is_error: true
                      }
                    };
                    dc.send(JSON.stringify(updatePayload));
                    console.log('[DriveMode] ✅ Updated placeholder with no results error');
                  } catch (updateErr) {
                    console.error('[DriveMode] Failed to update placeholder with error:', updateErr);
                    // Fallback: send new result if update fails
                    const noResultsPayload = {
                      type: 'conversation.item.create',
                      item: {
                        type: 'tool_result',
                        call_id: callId,
                        content: [
                          {
                            type: 'text',
                            text: `Web search completed but no results were found. ${errorMsg}`
                          }
                        ],
                        is_error: true
                      }
                    };
                    dc.send(JSON.stringify(noResultsPayload));
                  }
                } else if (dc.readyState === 'open') {
                  // Fallback if no item_id: send new result
                  const noResultsPayload = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: `Web search completed but no results were found. ${errorMsg}`
                        }
                      ],
                      is_error: true
                    }
                  };
                  dc.send(JSON.stringify(noResultsPayload));
                }
                return;
              }
              
              // Format results for voice consumption (concise, natural language)
              const results = searchData.results;
              const resultCount = results.length;
              
              // Create a concise summary for voice - format more naturally
              const summaries: string[] = [];
              results.forEach((result) => {
                const snippet = result.snippet || '';
                // Truncate long snippets for voice
                const shortSnippet = snippet.length > 200 ? snippet.substring(0, 200) + '...' : snippet;
                summaries.push(`${result.title || 'Result'}: ${shortSnippet}`);
              });
              
              // Format as natural language for voice response - more concise
              const formattedResults = summaries.join('\n\n');
              
              console.log('[DriveMode] Web search completed:', resultCount, 'results');
              console.log('[DriveMode] Data channel state:', dc.readyState);
              console.log('[DriveMode] Formatted results length:', formattedResults.length);
              
              // Update placeholder with real results
              const itemId = callIdToItemIdRef.current.get(callId);
              if (dc.readyState === 'open' && itemId) {
                try {
                  const updatePayload = {
                    type: 'conversation.item.update',
                    item_id: itemId,
                    item: {
                      content: [
                        {
                          type: 'text',
                          text: formattedResults
                        }
                      ]
                    }
                  };
                  dc.send(JSON.stringify(updatePayload));
                  console.log('[DriveMode] ✅ Updated placeholder with real search results, item_id:', itemId);
                  console.log('[DriveMode] Update payload:', JSON.stringify(updatePayload).substring(0, 300));
                } catch (updateErr) {
                  console.error('[DriveMode] ❌ Error updating placeholder:', updateErr);
                  // Fallback: send new result if update fails
                  const toolResultPayload = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: formattedResults
                        }
                      ]
                    }
                  };
                  dc.send(JSON.stringify(toolResultPayload));
                  console.log('[DriveMode] ✅ Fallback: sent new tool result (update failed)');
                }
              } else {
                // Fallback if no item_id or channel not open: send new result
                if (dc.readyState === 'open') {
                  const toolResultPayload = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      call_id: callId,
                      content: [
                        {
                          type: 'text',
                          text: formattedResults
                        }
                      ]
                    }
                  };
                  dc.send(JSON.stringify(toolResultPayload));
                  console.log('[DriveMode] ✅ Fallback: sent new tool result (no item_id)');
                } else {
                  console.error('[DriveMode] ❌ Data channel not open, storing result for later');
                  pendingToolResultsRef.current.set(callId, { callId, result: formattedResults });
                }
              }
            } catch (err) {
              console.error('[DriveMode] web_search: error', err);
              // Update placeholder with error or send error result
              const itemId = callIdToItemIdRef.current.get(callId);
              try {
                if (dc.readyState === 'open') {
                  if (itemId) {
                    // Try to update placeholder with error
                    const updatePayload = {
                      type: 'conversation.item.update',
                      item_id: itemId,
                      item: {
                        content: [
                          {
                            type: 'text',
                            text: `Error performing web search: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
                          }
                        ],
                        is_error: true
                      }
                    };
                    dc.send(JSON.stringify(updatePayload));
                    console.log('[DriveMode] ✅ Updated placeholder with error');
                  } else {
                    // Fallback: send new error result
                    const errorPayload = {
                      type: 'conversation.item.create',
                      item: {
                        type: 'tool_result',
                        call_id: callId,
                        content: [
                          {
                            type: 'text',
                            text: `Error performing web search: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
                          }
                        ],
                        is_error: true
                      }
                    };
                    dc.send(JSON.stringify(errorPayload));
                    console.log('[DriveMode] Sending error payload (fallback)');
                  }
                }
              } catch (sendErr) {
                console.error('[DriveMode] Failed to send error result:', sendErr);
              }
            }
          };
          
          // Handle specific Realtime API event types that contain function calls
          // (eventType already declared above)
          
          // Helper to handle tool calls based on name
          const handleToolCall = (toolCall: { callId: string; name: string; arguments: Record<string, unknown> }) => {
            if (toolCall.name === 'create_memory') {
              console.log('[DriveMode] create_memory tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleMemoryCreation(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'get_protocol') {
              console.log('[DriveMode] get_protocol tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleProtocolRetrieval(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'web_search') {
              console.log('[DriveMode] web_search tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleWebSearch(toolCall.callId, toolCall.arguments);
            }
          };
          
          // 1. response.function_call_arguments.done - contains call_id, name, arguments
          if (eventType === 'response.function_call_arguments.done') {
            const responseId = (obj as { response_id?: string }).response_id as string | undefined;
            const toolCall = extractToolCall(obj);
            if (toolCall && (toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search') && !processedCallIdsRef.current.has(toolCall.callId)) {
              // Track which response_id this call_id belongs to
              if (responseId) {
                callIdToResponseIdRef.current.set(toolCall.callId, responseId);
                console.log('[DriveMode] Tracking call_id:', toolCall.callId, 'for response_id:', responseId);
              }
              handleToolCall(toolCall);
            }
          }
          
          // 2. response.output_item.done - contains item with call_id, name, arguments
          if (eventType === 'response.output_item.done') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const toolCall = extractToolCall(item as Record<string, unknown>);
              if (toolCall && (toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search') && !processedCallIdsRef.current.has(toolCall.callId)) {
                handleToolCall(toolCall);
              }
            }
          }
          
          // 3. response.done - contains response.output[] array with function_call items
          if (eventType === 'response.done') {
            const response = (obj as { response?: { output?: unknown[] } }).response;
            if (response?.output && Array.isArray(response.output)) {
              for (const outputItem of response.output) {
                if (outputItem && typeof outputItem === 'object') {
                  const toolCall = extractToolCall(outputItem as Record<string, unknown>);
                  if (toolCall && (toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search') && !processedCallIdsRef.current.has(toolCall.callId)) {
                    handleToolCall(toolCall);
                  }
                }
              }
            }
          }
          
          // 4. Recursive check for tool calls in nested structures (fallback)
          const checkForToolCalls = (data: Record<string, unknown>, path = 'root'): void => {
            // Check if this object itself is a tool call
            const toolCall = extractToolCall(data);
            if (toolCall && (toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search')) {
              console.log('[DriveMode]', toolCall.name, 'tool call detected at path:', path, { callId: toolCall.callId });
              handleToolCall(toolCall);
              return;
            }
            
            // Also check for legacy format (tool_call_id/function_call_id) for backward compatibility
            if (data.type === 'tool_call' || data.type === 'function_call') {
              const legacyCallId = (data.tool_call_id as string | undefined) || 
                                   (data.function_call_id as string | undefined) ||
                                   (data.call_id as string | undefined);
              const legacyName = (data.name as string | undefined) || 
                                ((data as { function?: { name?: string } }).function?.name);
              const legacyArgs = parseArguments(
                data.input || 
                (data as { function?: { arguments?: unknown } }).function?.arguments ||
                data.arguments
              );
              
              if ((legacyName === 'create_memory' || legacyName === 'get_protocol' || legacyName === 'web_search') && legacyCallId && legacyArgs) {
                console.log('[DriveMode]', legacyName, 'tool call detected (legacy format) at path:', path, { callId: legacyCallId });
                handleToolCall({ callId: legacyCallId, name: legacyName, arguments: legacyArgs });
                return;
              }
            }
            
            // Recursively check nested objects and arrays
            for (const [key, value] of Object.entries(data)) {
              if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                  value.forEach((item, idx) => {
                    if (item && typeof item === 'object') {
                      checkForToolCalls(item as Record<string, unknown>, `${path}.${key}[${idx}]`);
                    }
                  });
                } else {
                  checkForToolCalls(value as Record<string, unknown>, `${path}.${key}`);
                }
              }
            }
          };
          
          // Check for tool calls in the entire event object (fallback for any missed cases)
          checkForToolCalls(obj);
          
          // Also check specific event types that commonly contain tool calls in content arrays
          if (eventType === 'conversation.item.input_audio_transcription.completed' || 
              eventType === 'conversation.item.created' ||
              eventType === 'response.created') {
            const item = (obj as { item?: unknown; response?: { item?: unknown } }).item || 
                        ((obj as { response?: { item?: unknown } }).response?.item);
            if (item && typeof item === 'object' && 'role' in item) {
              const role = (item as { role?: unknown }).role;
              if (role === 'assistant') {
                const content = (item as { content?: unknown }).content;
                if (Array.isArray(content)) {
                  // Check for tool calls in content
                  for (const part of content) {
                    if (part && typeof part === 'object') {
                      const toolCall = extractToolCall(part as Record<string, unknown>);
                      if (toolCall && (toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search')) {
                        console.log('[DriveMode]', toolCall.name, 'tool call detected in content array', { callId: toolCall.callId, arguments: toolCall.arguments });
                        handleToolCall(toolCall);
                      }
                    }
                  }
                }
              }
            }
          }
          

          // Voice "Stop" intent: restrict to USER text sources only to avoid false positives
          let stopText: string | null = null;
          if (obj.type === 'input_text.delta' || obj.type === 'input_text.done') {
            stopText = extractRef.fn(obj);
          } else if (obj.type === 'conversation.item.created') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object' && 'role' in item && (item as { role?: unknown }).role === 'user') {
              stopText = extractRef.fn(item);
            }
          }
          if ((settings?.stopIntentEnabled ?? true) && stopText && /\b(stop|end drive|cancel (?:session|conversation)|quit)\b/i.test(stopText)) {
            onStatusRef.current?.('Stopping…');
            try { remoteAudioRef.current?.pause(); } catch {}
            try { if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
            onEndedRef.current?.();
            return;
          }
        };

        // Create offer
  const offer = await pc.createOffer();
        if (cancelled) return;
        await pc.setLocalDescription(offer);

        onStatusRef.current?.('Creating realtime session…');
        // Get ephemeral token from our server
        const tokenResp = await fetch('/api/openai/realtime/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: effectiveModel, voice: effectiveVoice, language: (settings?.language || 'en-US') }),
        });
        if (!tokenResp.ok) {
          log('ephemeral token error', tokenResp.status);
          throw new Error(`Session error: ${tokenResp.status}`);
        }
        const session = await tokenResp.json();
        const ek = session?.client_secret?.value;
        const sessionModel = session?.model || effectiveModel; // Server may have chosen a fallback model
        if (!ek) {
          log('no ephemeral token in response', session);
          throw new Error('No ephemeral token returned');
        }
        
        // Notify parent of the active model (might be different if server fell back)
        onModelActiveRef.current?.(sessionModel);

        // Send offer SDP to OpenAI Realtime
        const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(sessionModel)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ek}`,
            'OpenAI-Beta': 'realtime=v1',
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp || '',
        });
        if (!sdpResp.ok) {
          log('SDP post failed', sdpResp.status);
          throw new Error(`SDP exchange failed: ${sdpResp.status}`);
        }
        const answer = { type: 'answer', sdp: await sdpResp.text() } as RTCSessionDescriptionInit;
        try {
          if (!cancelled) {
            await pc.setRemoteDescription(answer);
            sessionEstablishedRef.current = true;
          }
        } catch (err) {
          log('setRemoteDescription failed', err);
          throw err;
        }

        onStatusRef.current?.('Connected. Listening…');
      } catch (e: unknown) {
        const message = typeof e === 'object' && e && 'message' in (e as { message?: unknown }) ? String((e as { message?: unknown }).message) : 'Voice session failed';
        setError(message);
        onStatusRef.current?.('Error');
        try { console.error('[DriveMode][sid=' + sessionIdRef.current + ']', e); } catch {}
        // Proactive cleanup and unlock on failure to allow retry
        try { pcRef.current?.close(); } catch {}
        pcRef.current = null;
        if (__driveModeCurrentPC) {
          try { __driveModeCurrentPC.close(); } catch {}
          __driveModeCurrentPC = null;
        }
        if (localStreamRef.current) {
          try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
          localStreamRef.current = null;
        }
        if (remoteAudioRef.current) {
          try { (remoteAudioRef.current.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); } catch {}
          remoteAudioRef.current.srcObject = null;
          try { document.body.removeChild(remoteAudioRef.current); } catch {}
        }
        releaseWakeLock(wakeLockRef.current);
        wakeLockRef.current = null;
        startedRef.current = false;
        __driveModeRealtimeLock = false;
      }
    };
    start();

    // Listener to allow UI to request audio playback via user gesture
    try {
      enableAudioHandlerRef.current = async () => {
        try {
          const el = remoteAudioRef.current;
          if (!el) return;
          // Attempt to set sink again in case user just selected it
          try {
            type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
            const sinkEl = el as SinkAudioElement;
            if (typeof sinkEl.setSinkId === 'function' && settings?.audioOutputDeviceId) {
              await sinkEl.setSinkId(settings.audioOutputDeviceId);
            }
          } catch {}
          await el.play().catch(() => {});
        } catch {}
      };
      window.addEventListener('drive-mode-enable-audio', enableAudioHandlerRef.current);
      // Live voice change: forward to session via session.update
      voiceChangeHandlerRef.current = (ev: Event) => {
        try {
          const detail = (ev as CustomEvent).detail as { voice?: string } | undefined;
          const voice = detail?.voice;
          if (!voice) return;
          const dc = dcRef.current;
          if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({ type: 'session.update', session: { voice } }));
          }
        } catch {}
      };
      window.addEventListener('drive-mode-voice-change', voiceChangeHandlerRef.current as EventListener);
    } catch {}

    return () => {
      cancelled = true;
      // Cleanup
      try { pcRef.current?.close(); } catch {}
      pcRef.current = null;
      if (__driveModeCurrentPC) {
        try { __driveModeCurrentPC.close(); } catch {}
        __driveModeCurrentPC = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = null;
      if (remoteAudioRef.current) {
        try { (remoteAudioRef.current.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop()); } catch {}
        remoteAudioRef.current.srcObject = null;
        try { document.body.removeChild(remoteAudioRef.current); } catch {}
      }
      dcRef.current = null;
      releaseWakeLock(wakeLockRef.current);
      wakeLockRef.current = null;
      try { if (enableAudioHandlerRef.current) window.removeEventListener('drive-mode-enable-audio', enableAudioHandlerRef.current); } catch {}
      try { if (voiceChangeHandlerRef.current) window.removeEventListener('drive-mode-voice-change', voiceChangeHandlerRef.current as EventListener); } catch {}
      // Only signal end if the latest session and a connection was established
      const isLatest = sessionIdRef.current === __driveModeSessionSeq;
      const wasEstablished = sessionEstablishedRef.current;
      if (isLatest && wasEstablished) {
        onEndedRef.current?.();
      }
      startedRef.current = false;
      __driveModeRealtimeLock = false;
      try { console.log(`[DriveMode][sid=${sessionIdRef.current}] cleaned up (latest=${isLatest}, established=${wasEstablished})`); } catch {}
      sessionEstablishedRef.current = false;
    };
  }, [effectiveModel, effectiveVoice, settings.language, settings.audioInputDeviceId, settings.audioOutputDeviceId, settings.autoGreetEnabled, settings.greetingText, settings.bargeInEnabled, settings.stopIntentEnabled, settings.wakeLockEnabled, extractCandidateText, selectedPrePromptId]);

// (helper now in useCallback above)

// Map BCP‑47 tags to human-readable names for common languages
function languageNameFromBCP47(tag: string): string {
  const lc = (tag || '').toLowerCase();
  if (lc.startsWith('en')) return 'English';
  if (lc.startsWith('es')) return 'Spanish';
  if (lc.startsWith('de')) return 'German';
  if (lc.startsWith('fr')) return 'French';
  if (lc.startsWith('it')) return 'Italian';
  if (lc.startsWith('pt')) return 'Portuguese';
  if (lc.startsWith('nl')) return 'Dutch';
  if (lc.startsWith('sv')) return 'Swedish';
  if (lc.startsWith('no')) return 'Norwegian';
  if (lc.startsWith('da')) return 'Danish';
  if (lc.startsWith('fi')) return 'Finnish';
  return tag || 'English';
}

  // No visible UI; overlay handles status and end button
  return null;
}


