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
    'Speak with a refined British London accent (Received Pronunciation/posh accent).',
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
  log('start requested', { model: effectiveModel, voice: effectiveVoice });
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
        log('mic granted', { tracks: stream.getTracks().length });

        // Keep screen awake if possible
        wakeLockRef.current = await requestScreenWakeLock();
        if (wakeLockRef.current) log('wake lock acquired');

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
            log('ontrack: remote stream attached', { tracks: remote.getTracks().length });
            // Apply preferred audio output sink if supported
            try {
              type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
              const sinkEl = audioEl as SinkAudioElement;
              if (typeof sinkEl.setSinkId === 'function' && settings?.audioOutputDeviceId) {
                sinkEl
                  .setSinkId(settings.audioOutputDeviceId)
                  .then(() => {
                  log('audio sink set', settings.audioOutputDeviceId);
                }).catch((err: unknown) => {
                  const msg = typeof err === 'object' && err && 'message' in (err as { message?: unknown }) ? String((err as { message?: unknown }).message) : String(err);
                  log('audio sink set failed', msg);
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
          log('connectionstate', st);
        };
        pc.onsignalingstatechange = () => log('signalingstate', pc.signalingState);
        pc.onicegatheringstatechange = () => log('icegathering', pc.iceGatheringState);
        pc.oniceconnectionstatechange = () => log('iceconnection', pc.iceConnectionState);

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
            log('transceiver added (sendrecv) with mic');
          } else {
            // Fallback: add tracks if no specific audio track
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
            log('local tracks added (fallback)');
          }
        } catch (err) {
          try { console.error('[DriveMode][sid=' + sid + '] transceiver/addTrack failed', err); } catch {}
          return;
        }

        // Data channel (optional - can be used for control/events)
        const dc = pc.createDataChannel('oai-events');
        dcRef.current = dc;
        dc.onopen = async () => {
          log('datachannel open');
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
                log('using pre-prompt for voice', { id: prePrompt.id, name: prePrompt.name });
              }
            } catch (err) {
              log('error getting pre-prompt, using default voice instructions', err);
            }
            
            // Fetch relevant memories
            let memoriesText = '';
            try {
              const memories = await MemoryService.getMemories({ limit: 20, minImportance: 3 });
              if (memories.length > 0) {
                memoriesText = MemoryService.formatMemoriesForPrompt(memories);
                log('loaded memories for voice', { count: memories.length });
              }
            } catch (err) {
              log('error loading memories, continuing without', err);
            }
            
            // Combine language preference with pre-prompt content and memories
            const languageInstruction = `Default spoken language: ${langName} (${langTag}). Always speak and respond in ${langName} unless the user explicitly asks to switch languages. If user mixes languages, politely continue in ${langName}.`;
            
            const parts: string[] = [];
            if (prePromptContent) parts.push(prePromptContent);
            if (memoriesText) parts.push(memoriesText);
            parts.push(languageInstruction);
            
            // Add memory tool instructions
            const memoryToolInstructions = `\n\n**Memory Management:**\nYou have access to a create_memory tool. Use it to store important information about the user when they share:\n- Personal information (preferences, family details, important dates)\n- Goals and aspirations (fitness goals, work projects)\n- Important facts about their life, work, or relationships\nStore memories with appropriate importance levels (5-7 for general facts, 8-9 for important preferences, 10 for critical information like how to address the user).`;
            
            const instructions = parts.length > 0
              ? `${parts.join('\n\n')}${memoryToolInstructions}`
              : `${languageInstruction}\n\nYou are a helpful AI assistant in a real-time voice conversation. Speak naturally, keep responses concise, and vary your phrasing to avoid repetition.${memoryToolInstructions}`;
            
            // Add memory creation tool to session
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
                }
              }
            ];

            // Update session with instructions and tools
            dc.send(JSON.stringify({ 
              type: 'session.update', 
              session: { 
                instructions,
                tools
              } 
            }));
            log('session.update sent with pre-prompt, memories, tools, and language preference', { 
              instructionsLength: instructions.length,
              hasPrePrompt: !!prePromptContent,
              hasMemories: !!memoriesText,
              toolsCount: tools.length,
              tools: JSON.stringify(tools),
              userId: userIdRef.current
            });
          } catch {}
          // Optional: auto-greet to assert audio focus and confirm route
          try {
            const autoGreetEnabled = settings?.autoGreetEnabled !== false;
            const greetText = (settings?.greetingText && String(settings.greetingText)) || "I'm ready. How can I help?";
            if (autoGreetEnabled) {
              const greet = greetText;
              dc.send(JSON.stringify({ type: 'response.create', response: { instructions: greet } }));
              log('auto greet sent');
            }
          } catch {}
        };
        dc.onmessage = (ev) => {
          const raw = typeof ev.data === 'string' ? ev.data : '';
          log('datachannel message', raw.slice(0, 500)); // Increased log length to see tool calls
          // Attempt to parse event JSON
          let obj: Record<string, unknown> | null = null;
          try { obj = JSON.parse(raw) as Record<string, unknown>; } catch {}
          if (!obj || typeof obj !== 'object') return;
          
          // Log all event types to debug tool calls
          if (obj.type && typeof obj.type === 'string') {
            log('Realtime API event type:', obj.type);
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

          // Barge-in: if user speech starts while assistant is speaking, cancel current response
          if ((settings?.bargeInEnabled ?? true) && obj.type === 'input_audio_buffer.speech_started' && assistantSpeakingRef.current) {
            try {
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({ type: 'response.cancel' }));
                log('sent response.cancel for barge-in');
              }
            } catch {}
            try { remoteAudioRef.current?.pause(); } catch {}
            onStatusRef.current?.('Listening…');
            return;
          }

          // Handle tool calls (e.g., create_memory)
          // Tool calls can appear in various event types - check multiple locations
          const checkForToolCalls = (data: Record<string, unknown>, path = 'root'): void => {
            // Check if this object itself is a tool call
            if (data.type === 'tool_call' || data.type === 'function_call') {
              const toolCall = data as { tool_call_id?: string; name?: string; input?: unknown; function_call_id?: string; function?: { name?: string; arguments?: string } };
              const toolName = toolCall.name || toolCall.function?.name;
              const toolCallId = toolCall.tool_call_id || toolCall.function_call_id;
              const input = toolCall.input || (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : undefined);
              
              if (toolName === 'create_memory' && toolCallId) {
                log('create_memory tool call detected at path:', path, { toolCallId, input });
                handleMemoryCreation(toolCallId, input);
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
          
          const handleMemoryCreation = async (toolCallId: string, input: unknown) => {
            try {
              const memoryInput = input as { content?: string; category?: string; importance?: number } | undefined;
              if (!memoryInput?.content) {
                log('create_memory: missing content', memoryInput);
                return;
              }
              
              // Get user ID from ref
              const userId = userIdRef.current;
              if (!userId) {
                log('create_memory: no user ID available');
                return;
              }

              log('Creating memory with input:', memoryInput);
              
              // Create memory via API
              const memory = await MemoryService.createMemory({
                content: memoryInput.content,
                category: memoryInput.category,
                importance: memoryInput.importance
              });

              if (memory) {
                log('create_memory: success', { id: memory.id });
                // Send tool result back to Realtime API
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      tool_call_id: toolCallId,
                      content: [
                        {
                          type: 'text',
                          text: `Memory stored successfully: "${memoryInput.content}"`
                        }
                      ]
                    }
                  }));
                  log('Sent tool result to Realtime API');
                }
              } else {
                log('create_memory: failed to create');
                // Send error result
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      tool_call_id: toolCallId,
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
              log('create_memory: error', err);
              // Send error result
              try {
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'tool_result',
                      tool_call_id: toolCallId,
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
          
          // Check for tool calls in the entire event object
          checkForToolCalls(obj);
          
          // Also check specific event types that commonly contain tool calls
          if (obj.type === 'conversation.item.input_audio_transcription.completed' || 
              obj.type === 'conversation.item.created' ||
              obj.type === 'response.output_item.done' ||
              obj.type === 'response.done' ||
              obj.type === 'response.created') {
            const item = (obj as { item?: unknown; response?: { item?: unknown } }).item || 
                        ((obj as { response?: { item?: unknown } }).response?.item);
            if (item && typeof item === 'object' && 'role' in item) {
              const role = (item as { role?: unknown }).role;
              if (role === 'assistant') {
                const content = (item as { content?: unknown }).content;
                if (Array.isArray(content)) {
                  // Check for tool calls in content
                  for (const part of content) {
                    if (part && typeof part === 'object' && 'type' in part) {
                      if (part.type === 'tool_call' || part.type === 'function_call') {
                        const toolCall = part as { tool_call_id?: string; name?: string; input?: unknown; function_call_id?: string; function?: { name?: string; arguments?: string } };
                        const toolName = toolCall.name || toolCall.function?.name;
                        const toolCallId = toolCall.tool_call_id || toolCall.function_call_id;
                        const input = toolCall.input || (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : undefined);
                        
                        if (toolName === 'create_memory' && toolCallId) {
                          log('create_memory tool call detected in content array', { toolCallId, input });
                          handleMemoryCreation(toolCallId, input);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Legacy handler (keeping for backward compatibility)
          if (obj.type === 'conversation.item.input_audio_transcription.completed' || 
              obj.type === 'conversation.item.created') {
            const item = (obj as { item?: unknown }).item;
            if (item && typeof item === 'object' && 'role' in item) {
              const role = (item as { role?: unknown }).role;
              if (role === 'assistant') {
                const content = (item as { content?: unknown }).content;
                if (Array.isArray(content)) {
                  // Check for tool calls in content
                  for (const part of content) {
                    if (part && typeof part === 'object' && 'type' in part && part.type === 'tool_call') {
                      const toolCall = part as { tool_call_id?: string; name?: string; input?: unknown };
                      if (toolCall.name === 'create_memory' && toolCall.tool_call_id) {
                        log('create_memory tool call detected (legacy handler)', toolCall);
                        // Handle memory creation asynchronously
                        (async () => {
                          try {
                            const input = toolCall.input as { content?: string; category?: string; importance?: number } | undefined;
                            if (!input?.content) {
                              log('create_memory: missing content', input);
                              return;
                            }
                            
                            // Get user ID from ref
                            const userId = userIdRef.current;
                            if (!userId) {
                              log('create_memory: no user ID available');
                              return;
                            }

                            // Create memory via API
                            const memory = await MemoryService.createMemory({
                              content: input.content,
                              category: input.category,
                              importance: input.importance
                            });

                            if (memory) {
                              log('create_memory: success', { id: memory.id });
                              // Send tool result back to Realtime API
                              if (dc.readyState === 'open') {
                                dc.send(JSON.stringify({
                                  type: 'conversation.item.create',
                                  item: {
                                    type: 'tool_result',
                                    tool_call_id: toolCall.tool_call_id,
                                    content: [
                                      {
                                        type: 'text',
                                        text: `Memory stored successfully: "${input.content}"`
                                      }
                                    ]
                                  }
                                }));
                              }
                            } else {
                              log('create_memory: failed to create');
                              // Send error result
                              if (dc.readyState === 'open') {
                                dc.send(JSON.stringify({
                                  type: 'conversation.item.create',
                                  item: {
                                    type: 'tool_result',
                                    tool_call_id: toolCall.tool_call_id,
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
                            log('create_memory: error', err);
                            // Send error result
                            try {
                              if (dc.readyState === 'open' && toolCall.tool_call_id) {
                                dc.send(JSON.stringify({
                                  type: 'conversation.item.create',
                                  item: {
                                    type: 'tool_result',
                                    tool_call_id: toolCall.tool_call_id,
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
                        })();
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
            log('voice stop intent detected', stopText);
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
        log('local offer created/set');

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
        log('ephemeral token received (truncated)', ek.slice(0, 8) + '…');
        
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
            log('remote answer set');
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


