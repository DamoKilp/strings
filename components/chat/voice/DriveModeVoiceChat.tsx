"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { requestScreenWakeLock, releaseWakeLock } from './voiceUtils';
import { useDriveModeSettings } from './useDriveModeSettings';
import { getPrePromptById, getDefaultPrePrompt } from '@/components/data/prePrompts';
import { MemoryService } from '@/lib/memoryService';
import { storageService } from '@/lib/storageService';
import type { ChatMessage, ConversationSummary } from '@/lib/types';

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
  
  // CRITICAL: Voice identity instructions MUST come FIRST and be EMPHATIC
  // The session already has core instructions, this reinforces them
  const voiceInstructions = `**REMINDER - YOU ARE VICTORIA (ALWAYS FOLLOW):**
• Your name is VICTORIA - you know this and respond when asked your name
• You MUST speak with a BRITISH POSH LONDON accent like Kate Beckinsale
• NEVER use American pronunciation or expressions
• Use British phrases: "rather", "quite", "lovely", "darling", "brilliant", "I must say"
• Be moderately flirty, witty with dry British humour, sympathetic, and encouraging
• Keep responses concise but charming for voice conversation`;
  
  // Combine cleaned content with voice instructions and personal context
  // Voice identity goes FIRST to ensure it's always followed
  const cleaned = voiceContent.trim();
  const baseInstructions = cleaned 
    ? `${voiceInstructions}\n\n${cleaned}` 
    : voiceInstructions;
  
  return `${baseInstructions}\n\n${USER_PERSONAL_CONTEXT}`;
}

export function DriveModeVoiceChat({ model, voice, onStatus, onEnded, onModelActive }: DriveModeVoiceChatProps) {
  const chatContext = useChatContext();
  const { settings } = useDriveModeSettings();
  
  // Use model/voice from settings if not explicitly provided
  const effectiveModel = model || settings.model || 'gpt-realtime-mini-2025-10-06';
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
  const audioFocusElementRef = useRef<HTMLAudioElement | null>(null); // Dummy element for audio focus
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
  
  // Conversation tracking for saving voice chats to DB
  const voiceConversationIdRef = useRef<string | null>(null);
  const pendingUserTranscriptRef = useRef<string>(''); // Accumulate user speech
  const pendingAssistantTranscriptRef = useRef<string>(''); // Accumulate assistant speech
  const lastSavedUserMsgIdRef = useRef<string | null>(null);
  const lastSavedAssistantMsgIdRef = useRef<string | null>(null);
  
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
        
        // ======================================================================
        // AUDIO FOCUS: Claim exclusive audio focus BEFORE getting microphone
        // This pauses other audio apps (Audible, Spotify, etc.) on mobile
        // ======================================================================
        if (settings?.exclusiveAudioFocus !== false) {
          try {
            // 1. Set up Audio Session API if available (newer browsers)
            // This tells the platform we want exclusive audio for voice chat
            type AudioSessionAPI = {
              type: 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record' | 'auto';
            };
            const audioSession = (navigator as unknown as { audioSession?: AudioSessionAPI }).audioSession;
            if (audioSession) {
              // 'play-and-record' is designed for voice chat - it pauses other audio
              audioSession.type = 'play-and-record';
              log('Audio Session API: set type to play-and-record');
            }
            
            // 2. Media Session API - claim media focus and show in system UI
            if ('mediaSession' in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Drive Mode Voice Chat',
                artist: 'Strings Assistant',
                album: 'Voice Conversation',
                artwork: [
                  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
                  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
                ]
              });
              navigator.mediaSession.playbackState = 'playing';
              
              // Set up action handlers
              try {
                navigator.mediaSession.setActionHandler('pause', () => {
                  onStatusRef.current?.('Paused via system controls');
                  try { remoteAudioRef.current?.pause(); } catch {}
                });
                navigator.mediaSession.setActionHandler('play', () => {
                  onStatusRef.current?.('Resumed via system controls');
                  try { remoteAudioRef.current?.play(); } catch {}
                });
                navigator.mediaSession.setActionHandler('stop', () => {
                  onEndedRef.current?.();
                });
              } catch {}
              log('Media Session API: metadata and handlers set');
            }
            
            // 3. CRITICAL WORKAROUND: Play a silent audio element to claim Android audio focus
            // The Web Audio API doesn't request Android Audio Focus, but <audio> elements do
            // This forces other apps (Audible, etc.) to pause
            const focusElement = document.createElement('audio');
            focusElement.id = 'drive-mode-audio-focus-claim';
            // Use a data URI of a very short silent audio (1 sample of silence)
            // This is a valid WAV file with 1 sample of silence at 8kHz
            focusElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            focusElement.loop = true;
            focusElement.volume = 0.01; // Near-silent but not muted (muted won't claim focus)
            // @ts-expect-error - playsInline exists
            focusElement.playsInline = true;
            focusElement.setAttribute('data-audio-focus-claim', 'true');
            
            // Try to set the output device
            try {
              type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
              const sinkEl = focusElement as SinkAudioElement;
              if (typeof sinkEl.setSinkId === 'function' && settings?.audioOutputDeviceId && settings.audioOutputDeviceId !== 'default') {
                await sinkEl.setSinkId(settings.audioOutputDeviceId);
              }
            } catch {}
            
            document.body.appendChild(focusElement);
            audioFocusElementRef.current = focusElement;
            
            // Play the silent audio to claim focus - this will pause other apps
            await focusElement.play().catch((e) => {
              log('Audio focus element play failed (may need user gesture):', e);
            });
            
            // Small delay to let audio focus propagate
            await new Promise(r => setTimeout(r, 100));
            log('Audio focus claimed via silent audio element');
          } catch (focusErr) {
            log('Audio focus setup error (non-fatal):', focusErr);
          }
        }
        
        // ======================================================================
        // MICROPHONE: Enhanced constraints for car/Bluetooth audio
        // ======================================================================
        const voiceOptimized = settings?.voiceOptimizedAudio !== false;
        const sampleRate = settings?.sampleRate || 24000;
        
        const audioConstraints: MediaTrackConstraints = {
          // Echo cancellation is CRITICAL for car speakers feeding back into car mic
          echoCancellation: { ideal: true },
          // Noise suppression helps with road/engine noise
          noiseSuppression: { ideal: true },
          // Auto gain control helps with varying distances from car mic
          autoGainControl: { ideal: true },
        };
        
        if (voiceOptimized) {
          // Voice-optimized settings for better quality in cars
          Object.assign(audioConstraints, {
            // Mono is better for voice and more compatible with Bluetooth HFP profile
            channelCount: { ideal: 1 },
            // Sample rate: 24kHz is good for voice, but some Bluetooth only supports 16kHz
            sampleRate: { ideal: sampleRate, min: 8000 },
            // Latency: lower is better for real-time conversation
            latency: { ideal: 0.01 },
          });
        }
        
        // Apply preferred input device if specified
        if (settings?.audioInputDeviceId && settings.audioInputDeviceId !== 'default') {
          audioConstraints.deviceId = { exact: settings.audioInputDeviceId };
        }
        
        log('Requesting microphone with constraints:', JSON.stringify(audioConstraints));
        
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
            
            // Fetch relevant memories - load more for richer context
            let memoriesText = '';
            try {
              const memories = await MemoryService.getMemories({ limit: 100, minImportance: 1 });
              if (memories.length > 0) {
                memoriesText = MemoryService.formatMemoriesForPrompt(memories);
              }
            } catch (err) {
              // Error loading memories, continuing without
            }
            
            // Fetch the last 3 conversations for context continuity
            let recentConversationsText = '';
            try {
              const userId = userIdRef.current;
              if (userId) {
                const { items: recentConvos } = await storageService.getConversationList(userId, null, 3);
                if (recentConvos.length > 0) {
                  const convoSummaries: string[] = [];
                  
                  for (const convoSummary of recentConvos) {
                    try {
                      // Load full conversation to get messages
                      const fullConvo = await storageService.getConversation(convoSummary.id, userId);
                      if (fullConvo && fullConvo.messages && fullConvo.messages.length > 0) {
                        // Get the date and title
                        const dateStr = fullConvo.createdAt.toLocaleDateString();
                        const title = fullConvo.title || 'Conversation';
                        
                        // Extract key points from the conversation (first user message + assistant response summary)
                        const userMessages = fullConvo.messages.filter(m => m.role === 'user');
                        const assistantMessages = fullConvo.messages.filter(m => m.role === 'assistant');
                        
                        let summary = `"${title}" (${dateStr})`;
                        
                        // Get first user message as topic indicator
                        if (userMessages.length > 0) {
                          const firstUserMsg = typeof userMessages[0].content === 'string' 
                            ? userMessages[0].content 
                            : '';
                          const truncatedUser = firstUserMsg.length > 150 
                            ? firstUserMsg.substring(0, 150) + '...' 
                            : firstUserMsg;
                          if (truncatedUser) {
                            summary += `\n  - User asked: "${truncatedUser}"`;
                          }
                        }
                        
                        // Get last assistant message as outcome indicator
                        if (assistantMessages.length > 0) {
                          const lastContent = assistantMessages[assistantMessages.length - 1].content;
                          const lastAssistantMsg: string = typeof lastContent === 'string' ? lastContent : '';
                          const truncatedAssistant = lastAssistantMsg.length > 150
                            ? lastAssistantMsg.substring(0, 150) + '...'
                            : lastAssistantMsg;
                          if (truncatedAssistant) {
                            summary += `\n  - Victoria responded: "${truncatedAssistant}"`;
                          }
                        }
                        
                        convoSummaries.push(summary);
                      }
                    } catch {
                      // Skip conversations that fail to load
                    }
                  }
                  
                  if (convoSummaries.length > 0) {
                    recentConversationsText = `\n\n**RECENT CONVERSATIONS (for context continuity):**\nYou (Victoria) have recently had these conversations with the user. Use this to maintain continuity and remember what you've discussed:\n\n${convoSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}`;
                    console.log('[DriveMode] 📝 Loaded', convoSummaries.length, 'recent conversations for context');
                  }
                }
              }
            } catch (err) {
              console.warn('[DriveMode] Failed to load recent conversations (non-fatal):', err);
            }
            
            // Combine language preference with pre-prompt content and memories
            const languageInstruction = `Default spoken language: ${langName} (${langTag}). Always speak and respond in ${langName} unless the user explicitly asks to switch languages. If user mixes languages, politely continue in ${langName}.`;
            
            const parts: string[] = [];
            if (prePromptContent) parts.push(prePromptContent);
            if (memoriesText) parts.push(memoriesText);
            if (recentConversationsText) parts.push(recentConversationsText);
            parts.push(languageInstruction);
            
            // Add memory tool instructions
            const memoryToolInstructions = `\n\n**Memory System (IMPORTANT - YOU HAVE ACCESS TO MEMORIES):**\nYou have FULL ACCESS to the user's memories. The memories listed above under "RELEVANT MEMORIES" are YOUR knowledge about this user - USE THEM.\n\n**When user asks about memories:**\n- If they say "what do you know about me", "check my memories", "look at my memories", "what have I told you", etc. - refer to the RELEVANT MEMORIES section above AND use the search_memories tool for more specific queries.\n- NEVER say "I don't have access to your memories" - you DO have access!\n- Use the search_memories tool to find specific memories by category or keyword.\n\n**Memory Tools:**\n1. search_memories - Search/browse the memories database by category or keyword. Use this when the user asks about specific topics or wants to see what you remember.\n2. create_memory - Store NEW information about the user.\n\nStore memories with importance levels: 5-7 for general facts, 8-9 for important preferences, 10 for critical info.`;
            
            // Add voice command instructions
            const voiceCommandInstructions = `\n\n**Voice Commands & Protocols (IMPORTANT):**\nWhen the user mentions ANY of these phrases, you MUST use the get_protocol tool FIRST before doing anything else:\n- "run protocol", "run the [name] protocol", "execute protocol"\n- "follow protocol", "apply protocol", "use protocol"\n- "run voice protocol", "start protocol"\n\n**CRITICAL PROTOCOL WORKFLOW:**\n1. When user says "run the News protocol" or similar, call get_protocol with protocolName="News"\n2. The get_protocol tool will return the actual instructions stored in that protocol\n3. You MUST then follow those returned instructions exactly (which may include web searches, specific actions, etc.)\n4. Do NOT guess what a protocol does - ALWAYS retrieve it first\n\nProtocols are stored instructions that tell you exactly what to do. They may contain multi-step workflows like "search for X, then search for Y, then summarize". You must retrieve the protocol content first to know what actions to take.`;
            
            // Add web search instructions
            const webSearchInstructions = `\n\n**Web Search (YOU CAN SEARCH FOR ANYTHING):**\nYou have FULL ACCESS to search the internet for ANY topic. ALWAYS use web_search when:\n- The user asks about ANY current information (sports, news, weather, stocks, events)\n- The user wants to look up facts, research topics, find places, get recommendations\n- The user asks "what is", "how to", "where can I", "who won", "latest", "best"\n- You need information beyond your training data\n\n**NEVER say you cannot search for something** - you can search for ANY topic!\n\n**Search Depth - Choose based on query complexity:**\n- "basic" = Quick facts, simple answers (2-3 results) - use for: sports scores, weather, simple facts\n- "medium" = Balanced search (5 results, default) - use for: general questions, recommendations\n- "deep" = Comprehensive research (10+ results) - use for: complex topics, research, comparisons\n\n**Search Types:**\n- searchType="news" for news articles and headlines\n- searchType="general" for everything else (sports, facts, how-to, recommendations, etc.)\n\nSummarize results concisely for voice. Be natural and conversational.`;
            
            // Add conversation search instructions
            const conversationSearchInstructions = `\n\n**Previous Conversations:**\nYou have access to a search_conversations tool that searches through ALL previous conversations (both text and voice chats) with the user. Use this when:\n- The user asks "what did we talk about", "remember when we discussed", "look at our previous conversations"\n- The user wants to find a specific past conversation or topic\n- The user references something from a previous chat\n\nThis searches the full conversation history stored in the database, so you can find any past discussion.`;
            
            const instructions = parts.length > 0
              ? `${parts.join('\n\n')}${memoryToolInstructions}${voiceCommandInstructions}${webSearchInstructions}${conversationSearchInstructions}`
              : `${languageInstruction}\n\nYou are a helpful AI assistant in a real-time voice conversation. Speak naturally, keep responses concise, and vary your phrasing to avoid repetition.${memoryToolInstructions}${voiceCommandInstructions}${webSearchInstructions}${conversationSearchInstructions}`;
            
            // Add memory creation, protocol retrieval, and web search tools to session
            const tools = [
              {
                type: 'function',
                name: 'search_memories',
                description: 'Search and browse the user\'s memories database. Use this when the user asks "what do you know about me", "check my memories", "look at my memories", "what have I told you about X", or wants to see specific memories. You MUST use this tool instead of saying you don\'t have access to memories.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Optional search keyword to filter memories (e.g., "family", "work", "fitness"). Leave empty to get all memories.'
                    },
                    category: {
                      type: 'string',
                      enum: ['personal', 'work', 'family', 'fitness', 'preferences', 'projects', 'protocol', 'protocols', 'other'],
                      description: 'Optional category to filter memories by.'
                    },
                    limit: {
                      type: 'number',
                      minimum: 1,
                      maximum: 50,
                      description: 'Maximum number of memories to return. Default is 20.'
                    }
                  },
                  required: []
                }
              },
              {
                type: 'function',
                name: 'create_memory',
                description: 'Store a NEW memory about the user for future conversations. Use this when the user shares personal information, preferences, important facts, or things you should remember about them.',
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
                description: 'IMPORTANT: You MUST call this tool FIRST whenever the user mentions running, executing, or following a protocol. This retrieves stored instructions that tell you what actions to perform. For example, if user says "run the News protocol", call this with protocolName="News" to get the actual instructions, then follow those instructions. Never guess what a protocol does - always retrieve it first.',
                parameters: {
                  type: 'object',
                  properties: {
                    protocolName: {
                      type: 'string',
                      description: 'The name or keyword of the protocol to retrieve (e.g., "News", "Morning", "Weather"). Extract this from what the user says - if they say "run the News protocol", use "News".'
                    }
                  },
                  required: ['protocolName']
                }
              },
              {
                type: 'function',
                name: 'web_search',
                description: 'Search the internet for ANY topic - sports scores, news, weather, facts, research, entertainment, technology, science, health, finance, travel, recipes, how-to guides, and more. Use this whenever you need current information or to look up ANYTHING. NEVER say you cannot search for something - you can search for ANY topic!',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query. Be specific for better results (e.g., "Perth Scorchers vs Sydney Sixers score", "best Italian restaurants near Fremantle", "how to fix a leaking tap")'
                    },
                    searchDepth: {
                      type: 'string',
                      enum: ['basic', 'medium', 'deep'],
                      description: 'How thorough the search should be. "basic" = quick answer (2-3 results), "medium" = balanced (5 results, default), "deep" = comprehensive research (10+ results). Choose based on complexity: basic for simple facts, medium for general queries, deep for research or complex topics.'
                    },
                    searchType: {
                      type: 'string',
                      enum: ['general', 'news'],
                      description: 'Type of search. Use "news" for news articles, headlines, current events. Use "general" for everything else including sports scores, facts, how-to, etc. Default is "general".'
                    }
                  },
                  required: ['query']
                }
              },
              {
                type: 'function',
                name: 'search_conversations',
                description: 'Search through previous conversations (text and voice chats) with the user. Use this when the user asks "what did we talk about", "remember when we discussed X", "look at our previous conversations", or wants to find something from a past chat.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search keyword or topic to find in past conversations (e.g., "fitness", "work project", "family"). Leave empty to get recent conversations.'
                    },
                    limit: {
                      type: 'number',
                      minimum: 1,
                      maximum: 20,
                      description: 'Maximum number of conversations to search. Default is 10.'
                    }
                  },
                  required: []
                }
              }
            ];

            // Update session with instructions and tools
            sessionReadyRef.current = false; // Reset ready state
            const sessionUpdatePayload = { 
              type: 'session.update', 
              session: { 
                instructions,
                tools,
                // Enable input audio transcription for better context
                input_audio_transcription: { model: 'whisper-1' }
              } 
            };
            console.log('[DriveMode] Sending session.update with tools:', JSON.stringify({
              instructionsLength: instructions.length,
              toolsCount: tools.length,
              toolNames: tools.map((t: { name?: string }) => t.name)
            }));
            dc.send(JSON.stringify(sessionUpdatePayload));
            // Session updated with instructions and tools
            // CRITICAL: Wait for session.updated event before allowing any responses
            // This ensures the accent instructions are fully processed
            // Use a Promise that resolves on session.updated OR timeout (whichever first)
            await new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (sessionReadyRef.current) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 50);
              // Fallback timeout - 1500ms to give more time for instructions to process
              setTimeout(() => {
                clearInterval(checkInterval);
                if (!sessionReadyRef.current) {
                  sessionReadyRef.current = true;
                  console.log('[DriveMode] Session ready (timeout fallback after 1500ms)');
                }
                resolve();
              }, 1500);
            });
            
            // Create a conversation in the database to save this voice chat
            try {
              const userId = userIdRef.current;
              if (userId) {
                const now = new Date();
                const convo = await storageService.createConversation(
                  userId,
                  false, // Save to cloud, not local
                  `Voice Chat ${now.toLocaleString()}`,
                  undefined,
                  effectiveModel
                );
                if (convo) {
                  voiceConversationIdRef.current = convo.id;
                  log('Created voice conversation:', convo.id);
                }
              }
            } catch (convErr) {
              log('Failed to create voice conversation (non-fatal):', convErr);
            }
            
            // Optional: auto-greet to assert audio focus and confirm route
            // Only send after session is ready
            // CRITICAL: Include accent reinforcement in the greeting response
            try {
              const autoGreetEnabled = settings?.autoGreetEnabled !== false;
              // Default greeting introduces Victoria by name
              const greetText = (settings?.greetingText && String(settings.greetingText)) || "Hello darling, it's Victoria. How may I help you today?";
              if (autoGreetEnabled && sessionReadyRef.current) {
                // Include explicit voice identity instructions with the greeting
                // This ensures the FIRST response uses the correct accent and name
                const greetInstructions = `CRITICAL: You are VICTORIA. Speak with your British posh London Kate Beckinsale accent. Say this greeting in your charming British voice, introducing yourself: "${greetText}"`;
                dc.send(JSON.stringify({ 
                  type: 'response.create', 
                  response: { 
                    instructions: greetInstructions
                  } 
                }));
                console.log('[DriveMode] 🎤 Sent greeting with Victoria identity and British accent');
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
          
          // Check for session.created event - confirms initial session with instructions
          if (obj.type === 'session.created') {
            const session = (obj as { session?: { instructions?: string; voice?: string } }).session;
            console.log('[DriveMode] 🌟 Session created with:', {
              hasInstructions: !!session?.instructions,
              instructionsLength: session?.instructions?.length || 0,
              voice: session?.voice,
              // Log first 200 chars to confirm accent instructions are present
              instructionsPreview: session?.instructions?.substring(0, 200) || 'none'
            });
          }
          
          // Check for session.updated event to confirm session is ready with updated instructions
          if (obj.type === 'session.updated' || obj.type === 'session.update_completed') {
            sessionReadyRef.current = true;
            const session = (obj as { session?: { instructions?: string } }).session;
            console.log('[DriveMode] ✅ Session ready confirmed via event, instructions updated:', {
              hasInstructions: !!session?.instructions,
              instructionsLength: session?.instructions?.length || 0
            });
          }
          
          // ======================================================================
          // TRANSCRIPT CAPTURE: Save user and assistant speech to conversation
          // ======================================================================
          
          // Capture user speech transcription
          if (obj.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = (obj as { transcript?: string }).transcript;
            if (transcript && transcript.trim()) {
              const userId = userIdRef.current;
              const conversationId = voiceConversationIdRef.current;
              if (userId && conversationId) {
                try {
                  const userMessage: ChatMessage = {
                    id: storageService.generateLocalId(),
                    role: 'user',
                    content: transcript.trim(),
                    createdAt: new Date(),
                    conversationId: conversationId,
                    userId: userId,
                    metadata: { source: 'voice' }
                  };
                  storageService.addMessage(conversationId, userMessage, userId, false);
                  lastSavedUserMsgIdRef.current = userMessage.id;
                  console.log('[DriveMode] 💬 Saved user transcript:', transcript.substring(0, 50) + '...');
                } catch (saveErr) {
                  console.error('[DriveMode] Failed to save user message:', saveErr);
                }
              }
            }
          }
          
          // Capture assistant speech transcription (accumulate deltas)
          if (obj.type === 'response.audio_transcript.delta') {
            const delta = (obj as { delta?: string }).delta;
            if (delta) {
              pendingAssistantTranscriptRef.current += delta;
            }
          }
          
          // Save assistant transcript when response audio is done
          if (obj.type === 'response.audio_transcript.done' || obj.type === 'response.done') {
            const transcript = (obj as { transcript?: string }).transcript || pendingAssistantTranscriptRef.current;
            if (transcript && transcript.trim()) {
              const userId = userIdRef.current;
              const conversationId = voiceConversationIdRef.current;
              if (userId && conversationId) {
                try {
                  const assistantMessage: ChatMessage = {
                    id: storageService.generateLocalId(),
                    role: 'assistant',
                    content: transcript.trim(),
                    createdAt: new Date(),
                    conversationId: conversationId,
                    userId: userId,
                    metadata: { source: 'voice', model: effectiveModel }
                  };
                  storageService.addMessage(conversationId, assistantMessage, userId, false);
                  lastSavedAssistantMsgIdRef.current = assistantMessage.id;
                  console.log('[DriveMode] 🤖 Saved assistant transcript:', transcript.substring(0, 50) + '...');
                } catch (saveErr) {
                  console.error('[DriveMode] Failed to save assistant message:', saveErr);
                }
              }
              // Clear the pending transcript
              pendingAssistantTranscriptRef.current = '';
            }
          }
          
          // Check for function_call_output creation confirmation
          if (obj.type === 'conversation.item.created') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              const itemType = itemObj.type as string | undefined;
              // Log function_call_output confirmations
              if (itemType === 'function_call_output') {
                const callId = itemObj.call_id as string | undefined;
                const itemId = itemObj.id as string | undefined;
                console.log('[DriveMode] ✅ function_call_output confirmed by API, call_id:', callId, 'item_id:', itemId);
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
          
          // Check for function_call_output update confirmation
          if (obj.type === 'conversation.item.updated') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'function_call_output') {
                const callId = itemObj.call_id as string | undefined;
                const itemId = itemObj.id as string | undefined;
                console.log('[DriveMode] ✅ function_call_output updated and confirmed by API, call_id:', callId, 'item_id:', itemId);
                // Remove from pending if it was stored
                if (callId) {
                  pendingToolResultsRef.current.delete(callId);
                }
              }
            }
          }
          
          // Also check for function_call_output in response.output_item.added
          if (obj.type === 'response.output_item.added') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'function_call_output') {
                const callId = itemObj.call_id as string | undefined;
                console.log('[DriveMode] ✅ function_call_output added to response, call_id:', callId);
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
              try {
                // Use function_call_output format (correct for Realtime API)
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: pendingResult.result
                  }
                }));
                // Trigger response generation
                dc.send(JSON.stringify({ type: 'response.create' }));
                console.log('[DriveMode] ✅ Pending function_call_output sent for call_id:', callId);
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
          
          // Helper to send "searching" audio response while web search runs
          // Instead of sending a fake tool result (which doesn't work well),
          // we let the model naturally wait for the real result
          const sendWebSearchPlaceholder = (callId: string) => {
            if (placeholderSentRef.current.has(callId)) {
              return; // Already sent
            }
            placeholderSentRef.current.add(callId);
            // Don't send a placeholder tool result - the Realtime API doesn't handle
            // partial/placeholder function_call_output well. Instead, we'll just
            // let the search complete and send the real result.
            console.log('[DriveMode] 📝 Marked web_search as in-progress for call_id:', callId);
          };
          
          // Check when function calls are added to responses
          if (obj.type === 'response.output_item.added') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              if (itemObj.type === 'function_call' && itemObj.call_id) {
                const callId = itemObj.call_id as string;
                console.log('[DriveMode] Function call added to response, call_id:', callId);
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
              // This is the same timing as other tools send their results
              // We'll update it with real results when search completes
              if (functionName === 'web_search' && !placeholderSentRef.current.has(callId)) {
                console.log('[DriveMode] 🚀 Sending placeholder for web_search (arguments done, same timing as other tools)');
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
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error: Memory content is required.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
                return;
              }
              
              // Get user ID from ref
              const userId = userIdRef.current;
              if (!userId) {
                console.error('[DriveMode] create_memory: no user ID available');
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error: User not authenticated.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
                return;
              }

              console.log('[DriveMode] Creating memory:', memoryInput.content);
              
              // Create memory via API
              const memory = await MemoryService.createMemory({
                content: memoryInput.content,
                category: memoryInput.category,
                importance: memoryInput.importance
              });

              if (dc.readyState === 'open') {
                if (memory) {
                  console.log('[DriveMode] Memory created successfully:', memory.id);
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: `Memory stored successfully: "${memoryInput.content}"`
                    }
                  }));
                } else {
                  console.error('[DriveMode] create_memory: failed to create');
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Failed to store memory. Please try again.'
                    }
                  }));
                }
                // Trigger response generation
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            } catch (err) {
              console.error('[DriveMode] create_memory: error', err);
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error storing memory.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
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
                      type: 'function_call_output',
                      call_id: callId,
                      output: message
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
                return;
              }
              
              // Format protocols for the AI with explicit execution instructions
              console.log('[DriveMode] Protocol(s) retrieved:', protocols.length);
              
              // Build output that instructs the AI to execute the protocol
              let protocolOutput: string;
              if (protocols.length === 1) {
                protocolOutput = `PROTOCOL INSTRUCTIONS TO EXECUTE NOW:\n\n${protocols[0].content}\n\nYou must now execute these instructions step by step. Start immediately.`;
              } else {
                protocolOutput = `Found ${protocols.length} protocols. Execute the most relevant one:\n\n${protocols.map((p, idx) => `Protocol ${idx + 1}: ${p.content}`).join('\n\n')}\n\nExecute the instructions above step by step.`;
              }
              
              // Send protocol(s) back to Realtime API
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: protocolOutput
                  }
                }));
                // Trigger response generation
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            } catch (err) {
              console.error('[DriveMode] get_protocol: error', err);
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error retrieving protocol. Please try again.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
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
              const searchInput = input as { query?: string; searchDepth?: string; searchType?: string };
              console.log('[DriveMode] web_search input:', JSON.stringify(searchInput));
              
              if (!searchInput?.query) {
                console.warn('[DriveMode] web_search: missing query', searchInput);
                if (dc.readyState === 'open') {
                  // Use function_call_output format (correct for Realtime API)
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error: Search query is required for web search.'
                    }
                  }));
                  // Trigger response generation
                  dc.send(JSON.stringify({ type: 'response.create' }));
                  console.log('[DriveMode] Sent error function_call_output and response.create');
                }
                return;
              }
              
              const query = searchInput.query.trim();
              // Determine maxResults based on searchDepth
              const depthToResults: Record<string, number> = {
                'basic': 3,
                'medium': 5,
                'deep': 12
              };
              const searchDepth = searchInput.searchDepth || 'medium';
              const maxResults = depthToResults[searchDepth] || 5;
              console.log('[DriveMode] 🔍 Search depth:', searchDepth, '→', maxResults, 'results');
              
              console.log('[DriveMode] 🔍 Searching web for:', query);
              
              // Mark as in-progress (no placeholder sent)
              if (!placeholderSentRef.current.has(callId)) {
                sendWebSearchPlaceholder(callId);
              }
              
              // Perform the actual search (async, takes 2-3 seconds)
              const searchResponse = await fetch('/api/web-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ query, maxResults, searchType: searchInput.searchType || 'general' }),
              });
              
              if (!searchResponse.ok) {
                const errorData = await searchResponse.json().catch(() => ({ error: 'Search failed' }));
                throw new Error(errorData.error || `Search failed: ${searchResponse.statusText}`);
              }
              
              const searchData = await searchResponse.json() as { success: boolean; results?: Array<{ title: string; url: string; snippet: string }>; error?: string };
              
              if (!searchData.success || !searchData.results || searchData.results.length === 0) {
                const errorMsg = searchData.error || 'No search results found.';
                console.warn('[DriveMode] web_search: no results', errorMsg);
                
                if (dc.readyState === 'open') {
                  // Send function_call_output with error
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: `Web search completed but no results were found. ${errorMsg}`
                    }
                  }));
                  // IMPORTANT: Trigger response generation after function output
                  dc.send(JSON.stringify({ type: 'response.create' }));
                  console.log('[DriveMode] ✅ Sent no-results function_call_output and response.create');
                }
                return;
              }
              
              // Format results for voice consumption (concise, natural language)
              const results = searchData.results;
              const resultCount = results.length;
              
              // Create a concise summary for voice
              const summaries: string[] = [];
              results.forEach((result) => {
                const snippet = result.snippet || '';
                // Truncate long snippets for voice
                const shortSnippet = snippet.length > 200 ? snippet.substring(0, 200) + '...' : snippet;
                summaries.push(`${result.title || 'Result'}: ${shortSnippet}`);
              });
              
              const formattedResults = summaries.join('\n\n');
              
              console.log('[DriveMode] ✅ Web search completed:', resultCount, 'results');
              console.log('[DriveMode] Data channel state:', dc.readyState);
              
              if (dc.readyState === 'open') {
                // Send the search results as function_call_output (correct Realtime API format)
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: formattedResults
                  }
                }));
                console.log('[DriveMode] 📤 Sent function_call_output for call_id:', callId);
                
                // IMPORTANT: Request response generation so the model responds with the search results
                dc.send(JSON.stringify({ type: 'response.create' }));
                console.log('[DriveMode] 🎤 Sent response.create to trigger AI response with search results');
              } else {
                console.error('[DriveMode] ❌ Data channel not open, storing result for later');
                pendingToolResultsRef.current.set(callId, { callId, result: formattedResults });
              }
            } catch (err) {
              console.error('[DriveMode] web_search: error', err);
              try {
                if (dc.readyState === 'open') {
                  // Send error as function_call_output
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: `Error performing web search: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
                    }
                  }));
                  // Trigger response generation
                  dc.send(JSON.stringify({ type: 'response.create' }));
                  console.log('[DriveMode] Sent error function_call_output and response.create');
                }
              } catch (sendErr) {
                console.error('[DriveMode] Failed to send error result:', sendErr);
              }
            }
          };
          
          // Handle search_memories tool
          const handleMemorySearch = async (callId: string, input: Record<string, unknown>) => {
            // Prevent duplicate processing
            if (processedCallIdsRef.current.has(callId)) {
              console.log('[DriveMode] search_memories: already processed call_id', callId);
              return;
            }
            processedCallIdsRef.current.add(callId);
            
            try {
              const searchInput = input as { query?: string; category?: string; limit?: number };
              console.log('[DriveMode] search_memories input:', JSON.stringify(searchInput));
              
              // Fetch memories with optional filters
              const options: { limit?: number; category?: string } = {
                limit: searchInput.limit || 20
              };
              if (searchInput.category) {
                options.category = searchInput.category;
              }
              
              let memories = await MemoryService.getMemories(options);
              
              // If query provided, filter by keyword
              if (searchInput.query && searchInput.query.trim()) {
                const queryLower = searchInput.query.toLowerCase();
                memories = memories.filter(m => 
                  m.content.toLowerCase().includes(queryLower) ||
                  (m.category && m.category.toLowerCase().includes(queryLower))
                );
              }
              
              let output: string;
              if (memories.length === 0) {
                output = searchInput.query || searchInput.category
                  ? `No memories found matching your search. Try a different keyword or category.`
                  : `No memories stored yet. You can ask me to remember things about you.`;
              } else {
                // Format memories for voice output
                const formattedMemories = memories.map((m, idx) => {
                  const cat = m.category ? ` [${m.category}]` : '';
                  return `${idx + 1}. ${m.content}${cat}`;
                }).join('\n');
                output = `Found ${memories.length} memories:\n\n${formattedMemories}`;
              }
              
              console.log('[DriveMode] search_memories: found', memories.length, 'memories');
              
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output
                  }
                }));
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            } catch (err) {
              console.error('[DriveMode] search_memories: error', err);
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error searching memories. Please try again.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
              } catch {}
            }
          };
          
          // Handle search_conversations tool
          const handleConversationSearch = async (callId: string, input: Record<string, unknown>) => {
            // Prevent duplicate processing
            if (processedCallIdsRef.current.has(callId)) {
              console.log('[DriveMode] search_conversations: already processed call_id', callId);
              return;
            }
            processedCallIdsRef.current.add(callId);
            
            try {
              const searchInput = input as { query?: string; limit?: number };
              const userId = userIdRef.current;
              
              if (!userId) {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error: User not authenticated.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
                return;
              }
              
              console.log('[DriveMode] search_conversations input:', JSON.stringify(searchInput));
              
              // Get conversation list
              const limit = searchInput.limit || 10;
              const { items: conversations } = await storageService.getConversationList(userId, null, limit * 2);
              
              if (conversations.length === 0) {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'No previous conversations found.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
                return;
              }
              
              // If query provided, search through conversation messages
              let results: Array<{ title: string; date: string; preview: string }> = [];
              
              if (searchInput.query && searchInput.query.trim()) {
                const queryLower = searchInput.query.toLowerCase();
                
                // Search through conversations (load full messages to search)
                for (const convoSummary of conversations.slice(0, 20)) {
                  try {
                    const fullConvo = await storageService.getConversation(convoSummary.id, userId);
                    if (fullConvo && fullConvo.messages) {
                      // Search messages for the query
                      const matchingMessages = fullConvo.messages.filter(m => 
                        typeof m.content === 'string' && m.content.toLowerCase().includes(queryLower)
                      );
                      
                      if (matchingMessages.length > 0) {
                        // Get a preview from the first matching message
                        const firstMatch = matchingMessages[0];
                        const content = typeof firstMatch.content === 'string' ? firstMatch.content : '';
                        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
                        
                        results.push({
                          title: fullConvo.title || 'Untitled',
                          date: fullConvo.createdAt.toLocaleDateString(),
                          preview: preview
                        });
                      }
                    }
                  } catch {
                    // Skip conversations that fail to load
                  }
                  
                  if (results.length >= limit) break;
                }
              } else {
                // No query - load full conversations to show what was actually discussed
                for (const convoSummary of conversations.slice(0, limit)) {
                  try {
                    const fullConvo = await storageService.getConversation(convoSummary.id, userId);
                    if (fullConvo && fullConvo.messages && fullConvo.messages.length > 0) {
                      // Get actual message content, not just titles
                      const userMessages = fullConvo.messages.filter(m => m.role === 'user');
                      const assistantMessages = fullConvo.messages.filter(m => m.role === 'assistant');
                      
                      // Build a summary of what was discussed
                      let discussionSummary = '';
                      
                      // Get first few user messages to understand the topics
                      const topicMessages = userMessages.slice(0, 3);
                      if (topicMessages.length > 0) {
                        const topics = topicMessages.map(m => {
                          const content = typeof m.content === 'string' ? m.content : '';
                          return content.length > 80 ? content.substring(0, 80) + '...' : content;
                        }).filter(t => t).join(' | ');
                        discussionSummary = topics;
                      }
                      
                      // If no user messages, try assistant messages
                      if (!discussionSummary && assistantMessages.length > 0) {
                        const firstAssistant = assistantMessages[0];
                        const content = typeof firstAssistant.content === 'string' ? firstAssistant.content : '';
                        discussionSummary = content.length > 100 ? content.substring(0, 100) + '...' : content;
                      }
                      
                      results.push({
                        title: fullConvo.title || 'Conversation',
                        date: fullConvo.createdAt.toLocaleDateString(),
                        preview: discussionSummary || '(Empty conversation)'
                      });
                    }
                  } catch {
                    // Skip conversations that fail to load
                  }
                }
              }
              
              let output: string;
              if (results.length === 0) {
                output = searchInput.query 
                  ? `No conversations found mentioning "${searchInput.query}". Try a different search term.`
                  : 'No conversations found.';
              } else {
                const formatted = results.map((r, idx) => 
                  `${idx + 1}. "${r.title}" (${r.date}): ${r.preview}`
                ).join('\n\n');
                output = `Found ${results.length} conversation${results.length === 1 ? '' : 's'}:\n\n${formatted}`;
              }
              
              console.log('[DriveMode] search_conversations: found', results.length, 'results');
              
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output
                  }
                }));
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            } catch (err) {
              console.error('[DriveMode] search_conversations: error', err);
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: 'Error searching conversations. Please try again.'
                    }
                  }));
                  dc.send(JSON.stringify({ type: 'response.create' }));
                }
              } catch {}
            }
          };
          
          // Handle specific Realtime API event types that contain function calls
          // (eventType already declared above)
          
          // Helper to handle tool calls based on name
          const handleToolCall = (toolCall: { callId: string; name: string; arguments: Record<string, unknown> }) => {
            if (toolCall.name === 'search_memories') {
              console.log('[DriveMode] search_memories tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleMemorySearch(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'create_memory') {
              console.log('[DriveMode] create_memory tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleMemoryCreation(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'get_protocol') {
              console.log('[DriveMode] get_protocol tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleProtocolRetrieval(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'web_search') {
              console.log('[DriveMode] web_search tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleWebSearch(toolCall.callId, toolCall.arguments);
            } else if (toolCall.name === 'search_conversations') {
              console.log('[DriveMode] search_conversations tool call detected', { callId: toolCall.callId, arguments: toolCall.arguments });
              handleConversationSearch(toolCall.callId, toolCall.arguments);
            }
          };
          
          // 1. response.function_call_arguments.done - contains call_id, name, arguments
          if (eventType === 'response.function_call_arguments.done') {
            const responseId = (obj as { response_id?: string }).response_id as string | undefined;
            const toolCall = extractToolCall(obj);
            if (toolCall && (toolCall.name === 'search_memories' || toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search' || toolCall.name === 'search_conversations') && !processedCallIdsRef.current.has(toolCall.callId)) {
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
              if (toolCall && (toolCall.name === 'search_memories' || toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search' || toolCall.name === 'search_conversations') && !processedCallIdsRef.current.has(toolCall.callId)) {
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
                  if (toolCall && (toolCall.name === 'search_memories' || toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search' || toolCall.name === 'search_conversations') && !processedCallIdsRef.current.has(toolCall.callId)) {
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
            if (toolCall && (toolCall.name === 'search_memories' || toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search' || toolCall.name === 'search_conversations')) {
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
              
              if ((legacyName === 'search_memories' || legacyName === 'create_memory' || legacyName === 'get_protocol' || legacyName === 'web_search' || legacyName === 'search_conversations') && legacyCallId && legacyArgs) {
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
                      if (toolCall && (toolCall.name === 'search_memories' || toolCall.name === 'create_memory' || toolCall.name === 'get_protocol' || toolCall.name === 'web_search' || toolCall.name === 'search_conversations')) {
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
        // Clean up audio focus element
        if (audioFocusElementRef.current) {
          try { audioFocusElementRef.current.pause(); } catch {}
          try { document.body.removeChild(audioFocusElementRef.current); } catch {}
          audioFocusElementRef.current = null;
        }
        // Release Media Session
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.metadata = null;
          }
        } catch {}
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
      // Clean up audio focus element to release audio focus back to other apps
      if (audioFocusElementRef.current) {
        try { audioFocusElementRef.current.pause(); } catch {}
        try { document.body.removeChild(audioFocusElementRef.current); } catch {}
        audioFocusElementRef.current = null;
      }
      // Release Media Session so other apps can take over
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.metadata = null;
        }
      } catch {}
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
  }, [effectiveModel, effectiveVoice, settings.language, settings.audioInputDeviceId, settings.audioOutputDeviceId, settings.autoGreetEnabled, settings.greetingText, settings.bargeInEnabled, settings.stopIntentEnabled, settings.wakeLockEnabled, settings.exclusiveAudioFocus, settings.voiceOptimizedAudio, settings.sampleRate, extractCandidateText, selectedPrePromptId]);

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


