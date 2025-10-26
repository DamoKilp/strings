"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
// Note: Select removed from header to reduce width on small screens
import dynamic from 'next/dynamic';
import { Mic, RotateCcw } from 'lucide-react';
import { useDriveModeSettings } from './useDriveModeSettings';

export interface DriveModeOverlayProps {
  visible: boolean;
  statusText?: string;
  activeModel?: string; // Model name currently being used by the session
  onEnd: () => void;
  onModelSwitch?: () => void; // Callback to restart with different model
  onRestart?: () => void; // Generic restart (e.g., apply voice change)
}

export function DriveModeOverlay({ visible, statusText = 'Listening…', activeModel, onEnd, onModelSwitch, onRestart: _onRestart }: DriveModeOverlayProps) {
  const { settings, update } = useDriveModeSettings();
  // Lazy load settings modal trigger to keep overlay light
  const DriveModeSettingsModal = React.useMemo(() => dynamic(() => import('@/components/chat/voice/DriveModeSettingsModal').then(m => m.DriveModeSettingsModal), { ssr: false }), []);
  // Keep fetching supported voices (used by settings modal), but don't render a header dropdown
  const [_, setSupportedVoices] = React.useState<string[] | null>(null);

  const effectiveModel = activeModel || settings.model || 'gpt-realtime';

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setSupportedVoices(null);
        const r = await fetch(`/api/openai/realtime/voices?model=${encodeURIComponent(effectiveModel)}`);
        const json = await r.json();
        if (!cancelled && Array.isArray(json?.voices)) {
          setSupportedVoices(json.voices);
          if (json.voices.length && !json.voices.includes(settings.voice)) {
            update({ voice: json.voices[0] });
          }
        }
      } catch {
        if (!cancelled) setSupportedVoices(null);
      }
    }
    load();
    return () => { cancelled = true };
  }, [effectiveModel, settings.voice, update]);

  // Apply voice change live via session.update if the datachannel is open
  React.useEffect(() => {
    try {
      const ev = new CustomEvent('drive-mode-voice-change', { detail: { voice: settings.voice } });
      window.dispatchEvent(ev);
    } catch {}
  }, [settings.voice]);
  
  // Quick model toggle between gpt-realtime and gpt-4o-realtime-preview
  const handleQuickModelSwitch = () => {
    const currentModel = activeModel || settings.model;
    const newModel = currentModel === 'gpt-realtime' 
      ? 'gpt-4o-realtime-preview' 
      : 'gpt-realtime';
    
    update({ model: newModel });
    onModelSwitch?.(); // Notify parent to restart session with new model
  };

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-40">
      {/* Gradient ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-[#0b0f1a]/80 to-black/80" />
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl bg-gradient-to-br from-indigo-600/30 via-purple-600/30 to-fuchsia-600/30" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full blur-3xl bg-gradient-to-br from-fuchsia-600/25 via-indigo-600/25 to-purple-600/25" />

      {/* Centered content */}
      <div className="relative h-full flex items-stretch sm:items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full sm:w-[560px] max-w-[100vw] m-0 sm:m-6 p-[1px] h-full sm:h-auto rounded-none sm:rounded-2xl bg-gradient-to-br from-indigo-500/50 via-purple-500/40 to-fuchsia-500/40 shadow-[0_0_60px_rgba(99,102,241,0.25)]">
          <div className="rounded-none sm:rounded-2xl h-full sm:h-auto bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/5 p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300">
                  Drive Mode
                </h2>
                {/* Active model display */}
                <div className="text-lg sm:text-xl font-bold text-white/90 mt-1">
                  {activeModel || settings.model || 'gpt-realtime'}
                </div>
              </div>
            <div className="flex items-center gap-2">
                {/* Settings modal trigger (compact icon) */}
                <DriveModeSettingsModal
                  triggerClassName="h-8 w-8 p-0 inline-flex items-center justify-center border border-indigo-500/30 bg-indigo-900/20 text-indigo-200 hover:text-indigo-100 hover:bg-indigo-900/30 rounded-md"
                  activeModel={activeModel || settings.model}
                />
                {/* Quick model switch (hide on xs to save space) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQuickModelSwitch}
                  className="hidden sm:inline-flex border-purple-500/30 bg-purple-900/20 text-purple-200 hover:text-purple-100 hover:bg-purple-900/30"
                  title="Switch between gpt-realtime and gpt-4o-realtime-preview"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Switch
                </Button>
                {/* Enable audio (hide on xs) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      const ev = new Event('drive-mode-enable-audio');
                      window.dispatchEvent(ev);
                    } catch {}
                  }}
                  className="hidden sm:inline-flex border-indigo-500/30 bg-indigo-900/20 text-indigo-200 hover:text-indigo-100 hover:bg-indigo-900/30"
                >
                  Audio
                </Button>
                {/* End always visible */}
                <Button
                variant="outline"
                size="sm"
                onClick={onEnd}
                className="border-rose-500/30 bg-rose-900/20 text-rose-300 hover:text-rose-200 hover:bg-rose-900/30"
                >
                  End
                </Button>
              </div>
            </div>

            {/* Mic ring and status (centered vertically) */}
            <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center text-center py-3 sm:py-4">
              {/* Make the mic ring the primary END button */}
              <button
                type="button"
                onClick={onEnd}
                className="group relative mb-5 sm:mb-6 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label="End Drive Mode"
                title="Tap to end Drive Mode"
              >
                <div className="h-36 w-36 sm:h-48 sm:w-48 rounded-full p-[3px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-fuchsia-500 shadow-[0_0_50px_rgba(99,102,241,0.35)] transition-transform duration-150 group-active:scale-95">
                  <div className="h-full w-full rounded-full bg-black/70 flex items-center justify-center">
                    <Mic className="h-10 w-10 sm:h-12 sm:w-12 text-indigo-200" />
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-fuchsia-500/20" />
              </button>

              {/* Label under microphone */}
              <div className="-mt-3 mb-4 text-sm font-medium tracking-wide uppercase text-rose-300/90">
                Stop
              </div>

              <div className="text-2xl sm:text-4xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300">
                {statusText}
              </div>
              <div className="text-indigo-200/70 text-xs sm:text-base">
                Tap the mic to end • Say “Stop” to end hands‑free
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



