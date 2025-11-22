"use client";
import React, { useMemo, useRef } from 'react';
import { Dialog, DialogContentGlass, DialogHeaderGlass, DialogFooterGlass, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import { useDriveModeSettings, getDefaultDriveModeSettings } from './useDriveModeSettings';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DriveModeSettingsModalProps {
  triggerClassName?: string;
  activeModel?: string; // optional model override from overlay
}

// Expanded voice options commonly available for OpenAI realtime/TTS (subject to model support)
const VOICE_CHOICES = [
  { id: 'verse', label: 'Verse' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'aria', label: 'Aria' },
  { id: 'amber', label: 'Amber' },
  { id: 'breeze', label: 'Breeze' },
  { id: 'cobalt', label: 'Cobalt' },
  { id: 'coral', label: 'Coral' },
  { id: 'charlie', label: 'Charlie' },
  { id: 'opal', label: 'Opal' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'pearl', label: 'Pearl' },
  { id: 'sage', label: 'Sage' },
  { id: 'nova', label: 'Nova' },
  // New high-naturalness voices announced with gpt-realtime
  { id: 'marin', label: 'Marin' },
  { id: 'cedar', label: 'Cedar' },
];

const LANGUAGE_CHOICES = [
  'en-US','en-GB','en-AU','de-DE','fr-FR','es-ES','it-IT','pt-PT','nl-NL','sv-SE','no-NO','da-DK','fi-FI'
];

export function DriveModeSettingsModal({ triggerClassName, activeModel }: DriveModeSettingsModalProps) {
  const { settings, loaded, update } = useDriveModeSettings();
  const defaults = useMemo(getDefaultDriveModeSettings, []);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [supportedVoices, setSupportedVoices] = useState<string[] | null>(null);
  const lastVoicesModelRef = useRef<string | null>(null);
  const effectiveModel = activeModel || settings.model || defaults.model;

  useEffect(() => {
    // Enumerate audio devices when modal mounts (requires https context and permissions)
    const enumerate = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const sinks = devices.filter(d => d.kind === 'audiooutput');
        const sources = devices.filter(d => d.kind === 'audioinput');
        setAudioOutputs(sinks);
        setAudioInputs(sources);
      } catch {}
    };
    enumerate();
    // Refresh when the underlying devices list changes (e.g., Bluetooth connected)
    const handleChange = () => enumerate();
    try { navigator.mediaDevices?.addEventListener?.('devicechange', handleChange); } catch {}
    return () => {
      try { navigator.mediaDevices?.removeEventListener?.('devicechange', handleChange); } catch {}
    };
  }, []);

  // Fetch supported voices for effective model
  useEffect(() => {
    let cancelled = false;
    async function loadVoices() {
      try {
        // Avoid refetch if already loaded for this model
        if (lastVoicesModelRef.current === effectiveModel && Array.isArray(supportedVoices) && supportedVoices.length) return;
        lastVoicesModelRef.current = effectiveModel;
        const r = await fetch(`/api/openai/realtime/voices?model=${encodeURIComponent(effectiveModel)}`);
        const json = await r.json();
        if (!cancelled && Array.isArray(json?.voices)) {
          setSupportedVoices(json.voices);
          // If current voice not supported, switch to first available
          if (json.voices.length && !json.voices.includes(settings.voice)) {
            update({ voice: json.voices[0] });
          }
        }
      } catch {
        if (!cancelled) setSupportedVoices(null);
      }
    }
    loadVoices();
    return () => { cancelled = true };
  }, [effectiveModel, settings.voice, update, supportedVoices]);

  const handleSystemOutputPicker = async () => {
    try {
      // Experimental: Not supported in all browsers
      // @ts-expect-error - Experimental selectAudioOutput not in lib.dom
      if (navigator.mediaDevices?.selectAudioOutput) {
        // @ts-expect-error - Experimental selectAudioOutput not in lib.dom
        const device: MediaDeviceInfo = await navigator.mediaDevices.selectAudioOutput();
        if (device?.deviceId) {
          update({ audioOutputDeviceId: device.deviceId });
        }
      }
    } catch {}
  };

  const handleTestOutput = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const audioEl = (testAudioRef.current ||= document.createElement('audio'));
      audioEl.autoplay = false;
      // @ts-expect-error - playsInline exists in modern browsers
      audioEl.playsInline = true;
      audioEl.setAttribute('data-drive-mode-test', 'true');
      audioEl.muted = false;
      // Build a short tone using Web Audio, then route into the audio element via MediaStreamDestination
  const AudioCtxCtor = (window.AudioContext || ((window as unknown) && (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)) as unknown as (new () => AudioContext) | undefined;
  const ctx: AudioContext = new (AudioCtxCtor ?? (window.AudioContext as unknown as new () => AudioContext))();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5 beep
      gain.gain.value = 0.06; // quiet
      osc.connect(gain);
      gain.connect(dest);
      audioEl.srcObject = dest.stream;
      // Apply selected output when available
      try {
        const audioAny = audioEl as unknown as { setSinkId?: (id: string) => Promise<void> };
        if (typeof audioAny.setSinkId === 'function' && settings?.audioOutputDeviceId) {
          await audioAny.setSinkId(settings.audioOutputDeviceId);
        }
      } catch {}
      osc.start();
      await audioEl.play().catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      osc.stop();
      ctx.close();
    } catch {}
    setIsTesting(false);
  };

  return (
    <Dialog>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button type="button" className={`toolbar-btn ${triggerClassName || ''}`}>
                <Settings className="toolbar-icon" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip bg-slate-900! text-slate-200! border border-slate-700 pointer-events-none">
            <div className="flex flex-col">
              <span className="font-semibold">Drive Mode Settings</span>
              <span className="text-xs opacity-80">Configure voice, language, audio output, and safety options</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContentGlass className="h-[90vh] max-h-[90vh]">
        <DialogHeaderGlass>
          <div>
            <DialogTitle className="text-lg sm:text-xl font-semibold glass-text-primary">
              Drive Mode Settings
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm glass-text-secondary mt-1">
              Configure voice, language, audio output, and safety options
            </DialogDescription>
          </div>
        </DialogHeaderGlass>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="glass-text-secondary">Loading settings…</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Audio & Voice Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Audio & Voice</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Language */}
                  <div className="space-y-2 p-4 rounded-lg border bg-background/50">
                    <Label htmlFor="dm-language" className="text-sm font-medium">Default language (BCP‑47)</Label>
                    <Select value={settings.language} onValueChange={(v) => update({ language: v })}>
                      <SelectTrigger id="dm-language">
                        <SelectValue placeholder={defaults.language} />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_CHOICES.map(code => (
                          <SelectItem key={code} value={code}>{code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Voice (filtered per model) */}
                  <div className="space-y-2 p-4 rounded-lg border bg-background/50">
                    <Label htmlFor="dm-voice" className="text-sm font-medium">Voice</Label>
                    <Select value={settings.voice} onValueChange={(v) => update({ voice: v })}>
                      <SelectTrigger id="dm-voice">
                        <SelectValue placeholder={supportedVoices ? 'Select voice' : 'Loading…'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(supportedVoices || VOICE_CHOICES.map(v => v.id))
                          .filter((id) => typeof id === 'string' && id.trim().length > 0)
                          .map(id => {
                          const meta = VOICE_CHOICES.find(v => v.id === id);
                          return (
                            <SelectItem key={id} value={id}>{meta?.label || id}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground mt-1">Model: {effectiveModel}</div>
                  </div>

                  {/* Model */}
                  <div className="space-y-2 p-4 rounded-lg border bg-background/50">
                    <Label htmlFor="dm-model" className="text-sm font-medium">Realtime model</Label>
                    {(() => {
                      const recommended = ['gpt-realtime'];
                      const known = [
                        'gpt-4o-realtime-preview-2025-06-03',
                        'gpt-4o-realtime-preview-2024-12-17',
                        'gpt-4o-realtime-preview-2024-10-01',
                        'gpt-4o-realtime-preview',
                        'gpt-4o-mini-realtime-preview-2024-12-17',
                        'gpt-4o-mini-realtime-preview',
                      ];
                      const modelOptions = Array.from(new Set([
                        ...recommended,
                        defaults.model,
                        settings.model,
                        ...known,
                      ].filter(Boolean)));
                      return (
                        <Select value={settings.model} onValueChange={(v) => update({ model: v })}>
                          <SelectTrigger id="dm-model">
                            <SelectValue placeholder={defaults.model} />
                          </SelectTrigger>
                          <SelectContent>
                            {modelOptions
                              .filter((m) => typeof m === 'string' && m.trim().length > 0)
                              .map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Device Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Device Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Output */}
                  <div className="space-y-2 p-4 rounded-lg border bg-background/50">
                    <Label htmlFor="dm-output" className="text-sm font-medium">Audio output (Bluetooth / speakers)</Label>
                    <Select value={settings.audioOutputDeviceId || 'default'} onValueChange={(v) => update({ audioOutputDeviceId: v || 'default' })}>
                      <SelectTrigger id="dm-output">
                        <SelectValue placeholder="System default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System default</SelectItem>
                        {audioOutputs
                          .filter(d => typeof d.deviceId === 'string' && d.deviceId.trim().length > 0)
                          .map(d => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0,6)}…`}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleSystemOutputPicker}>
                        Choose from system…
                      </Button>
                      <Button type="button" size="sm" onClick={handleTestOutput} disabled={isTesting}>
                        {isTesting ? 'Testing…' : 'Test output'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Tip: Pair your car/Bluetooth headset, then select it here. On some mobile browsers, output selection must be done via the system UI.</p>
                  </div>

                  {/* Input */}
                  <div className="space-y-2 p-4 rounded-lg border bg-background/50">
                    <Label htmlFor="dm-input" className="text-sm font-medium">Microphone input (Bluetooth / built‑in)</Label>
                    <Select value={settings.audioInputDeviceId || 'default'} onValueChange={(v) => update({ audioInputDeviceId: v || 'default' })}>
                      <SelectTrigger id="dm-input">
                        <SelectValue placeholder="System default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System default</SelectItem>
                        {audioInputs
                          .filter(d => typeof d.deviceId === 'string' && d.deviceId.trim().length > 0)
                          .map(d => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}…`}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">If mics are unnamed, grant mic permission first so labels populate.</p>
                  </div>
                </div>
              </div>

              {/* Behavior Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Behavior Settings</h3>
                <div className="space-y-3">
                  {/* Barge-in */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Barge‑in</Label>
                      <p className="text-xs text-muted-foreground">Interrupt assistant by speaking</p>
                    </div>
                    <Switch checked={settings.bargeInEnabled} onCheckedChange={(v) => update({ bargeInEnabled: !!v })} />
                  </div>

                  {/* Voice Stop intent */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Voice Stop intent</Label>
                      <p className="text-xs text-muted-foreground">Say &ldquo;Stop&rdquo; to end Drive Mode</p>
                    </div>
                    <Switch checked={settings.stopIntentEnabled} onCheckedChange={(v) => update({ stopIntentEnabled: !!v })} />
                  </div>

                  {/* Keep screen awake */}
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Keep screen awake</Label>
                      <p className="text-xs text-muted-foreground">Use Wake Lock when available</p>
                    </div>
                    <Switch checked={settings.wakeLockEnabled} onCheckedChange={(v) => update({ wakeLockEnabled: !!v })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        
        {/* Footer */}
        <DialogFooterGlass>
          <Button 
            variant="glass" 
            onClick={() => {}}
            className="glass-small glass-interactive px-6 rounded-xl"
          >
            Close
          </Button>
        </DialogFooterGlass>
      </DialogContentGlass>
    </Dialog>
  );
}



