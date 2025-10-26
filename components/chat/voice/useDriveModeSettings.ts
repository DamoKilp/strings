"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';

export type DriveModeSettings = {
  language: string; // BCP-47, e.g., en-US
  voice: string; // OpenAI voice id, e.g., "verse"
  model: string; // realtime-capable model id
  bargeInEnabled: boolean;
  stopIntentEnabled: boolean;
  wakeLockEnabled: boolean;
  // Input and output device preferences
  // - audioInputDeviceId: microphone device to use ('default' or deviceId)
  // - audioOutputDeviceId: speaker device to use ('default' or sinkId)
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string; // 'default' or specific sinkId (where supported)
  // Greeting behavior
  autoGreetEnabled?: boolean;
  greetingText?: string;
};

const STORAGE_KEY = 'ventiaam_drive_mode_settings_v1';

export function getDefaultDriveModeSettings(): DriveModeSettings {
  return {
    language: 'en-US',
    voice: 'verse',
    // Default to latest GA realtime model; server will fallback if unavailable
    model: 'gpt-realtime',
    bargeInEnabled: true,
    stopIntentEnabled: true,
    wakeLockEnabled: true,
    audioInputDeviceId: 'default',
    audioOutputDeviceId: 'default',
    autoGreetEnabled: true,
    greetingText: 'I\'m ready. How can I help? Keep it short and conversational.',
  };
}

export function useDriveModeSettings() {
  const [settings, setSettings] = useState<DriveModeSettings>(getDefaultDriveModeSettings());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...getDefaultDriveModeSettings(), ...parsed });
      }
    } catch {}
    setLoaded(true);
  }, []);

  const save = useCallback((next: DriveModeSettings) => {
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const update = useCallback((partial: Partial<DriveModeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return useMemo(() => ({ settings, loaded, save, update }), [settings, loaded, save, update]);
}



