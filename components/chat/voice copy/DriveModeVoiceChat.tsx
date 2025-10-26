"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { requestScreenWakeLock, releaseWakeLock } from './voiceUtils';
import { useDriveModeSettings } from './useDriveModeSettings';

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
export function DriveModeVoiceChat({ model, voice, onStatus, onEnded, onModelActive }: DriveModeVoiceChatProps) {
  useChatContext();
  const { settings } = useDriveModeSettings();
  
  // Use model/voice from settings if not explicitly provided
  const effectiveModel = model || settings.model || 'gpt-realtime';
  const effectiveVoice = voice || settings.voice || 'verse';
  const onModelActiveRef = useRef(onModelActive);
  useEffect(() => { onModelActiveRef.current = onModelActive; }, [onModelActive]);

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
        dc.onopen = () => {
          log('datachannel open');
          // Apply default language preference via session instructions
          try {
            const langTag: string = settings?.language || 'en-US';
            const langName = languageNameFromBCP47(langTag);
            const instructions = `Default spoken language: ${langName} (${langTag}). Always speak and respond in ${langName} unless the user explicitly asks to switch languages. If user mixes languages, politely continue in ${langName}.`;
            dc.send(JSON.stringify({ type: 'session.update', session: { instructions } }));
            log('session.update sent with language preference', instructions);
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
          log('datachannel message', raw.slice(0, 200));
          // Attempt to parse event JSON
          let obj: Record<string, unknown> | null = null;
          try { obj = JSON.parse(raw) as Record<string, unknown>; } catch {}
          if (!obj || typeof obj !== 'object') return;

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
  }, [effectiveModel, effectiveVoice, settings.language, settings.audioInputDeviceId, settings.audioOutputDeviceId, settings.autoGreetEnabled, settings.greetingText, settings.bargeInEnabled, settings.stopIntentEnabled, settings.wakeLockEnabled, extractCandidateText]);

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


