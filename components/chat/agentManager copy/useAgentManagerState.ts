// /components/chat/agentManager/useAgentManagerState.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentDefinition, AgentPreference } from '@/lib/types';
import { toast } from 'sonner';

export type BuiltinAgent = { id: string; name: string; description: string; content: string };

export type UnifiedAgent = {
  key: string; // unique key for DnD: builtin:<id> or custom:<id>
  kind: 'builtin' | 'custom';
  id: string; // builtin id or custom uuid
  name: string;
  description: string;
  content?: string; // preprompt/system prompt content
  iconKey: string;
  colorHex: string;
  isEnabled: boolean;
  sortOrder: number;
};

type ManagerStateParams = {
  builtins: BuiltinAgent[];
  initialCustomAgents?: AgentDefinition[];
  initialPreferences?: AgentPreference[];
};

type SaveAgentInput = Omit<AgentDefinition, 'id'> & { id?: string };

export function useAgentManagerState(params: ManagerStateParams) {
  const { builtins, initialCustomAgents = [], initialPreferences = [] } = params;

  const [customAgents, setCustomAgents] = useState<AgentDefinition[]>(initialCustomAgents);
  const [preferences, setPreferences] = useState<AgentPreference[]>(initialPreferences);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const prevOrderRef = useRef<string[] | null>(null);
  const lastStablePrefsRef = useRef<AgentPreference[] | null>(null);

  // Helpers to find preference by key
  const getPrefForKey = useCallback((key: string): AgentPreference | undefined => {
    if (key.startsWith('custom:')) {
      const id = key.split(':')[1];
      return preferences.find((p) => p.agentId === id);
    }
    const bid = key.split(':')[1];
    return preferences.find((p) => p.agentBuiltinId === bid);
  }, [preferences]);

  // Sync manager state when upstream props change (e.g., after loading from API)
  useEffect(() => {
    setCustomAgents(initialCustomAgents);
  }, [initialCustomAgents]);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  // Build a unified map for current enabled/disabled and ordering
  const unifiedEnabledList: UnifiedAgent[] = useMemo(() => {
    const builtinEnabled = new Map<string, boolean>();
    const customEnabled = new Map<string, boolean>();
    const builtinOrder = new Map<string, number>();
    const customOrder = new Map<string, number>();
    preferences.forEach((p) => {
      if (p.agentBuiltinId) {
        builtinEnabled.set(p.agentBuiltinId, p.isEnabled !== false);
        builtinOrder.set(p.agentBuiltinId, p.sortOrder ?? 0);
      }
      if (p.agentId) {
        customEnabled.set(p.agentId, p.isEnabled !== false);
        customOrder.set(p.agentId, p.sortOrder ?? 0);
      }
    });

    const builtinsUnified: UnifiedAgent[] = builtins.map((b) => ({
      key: `builtin:${b.id}`,
      kind: 'builtin',
      id: b.id,
      name: b.name,
      description: b.description,
      content: b.content,
      iconKey: 'Bot',
      colorHex: '#64748B',
      isEnabled: builtinEnabled.has(b.id) ? (builtinEnabled.get(b.id) as boolean) : true,
      sortOrder: builtinOrder.has(b.id) ? (builtinOrder.get(b.id) as number) : 9999,
    }));

    const customsUnified: UnifiedAgent[] = customAgents.map((a) => ({
      key: `custom:${a.id}`,
      kind: 'custom',
      id: a.id,
      name: a.name,
      description: a.description,
      content: a.content,
      iconKey: a.iconKey || 'Bot',
      colorHex: a.colorHex || '#10B981',
      isEnabled: customEnabled.has(a.id) ? (customEnabled.get(a.id) as boolean) : true,
      sortOrder: customOrder.has(a.id) ? (customOrder.get(a.id) as number) : 9999,
    }));

    return [...builtinsUnified, ...customsUnified]
      .filter((ua) => ua.isEnabled)
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }, [builtins, customAgents, preferences]);

  const allUnifiedList: UnifiedAgent[] = useMemo(() => {
    const enabledKeys = new Set(unifiedEnabledList.map((x) => x.key));
    // include disabled items as separate section; maintain stable order by name for browsing
    const disabledBuiltins: UnifiedAgent[] = builtins
      .map((b) => {
        const p = preferences.find((x) => x.agentBuiltinId === b.id);
        const enabled = p ? p.isEnabled !== false : true; // default enabled if no pref
        return {
          key: `builtin:${b.id}`,
          kind: 'builtin' as const,
          id: b.id,
          name: b.name,
          description: b.description,
          content: b.content,
          iconKey: 'Bot',
          colorHex: '#64748B',
          isEnabled: enabled,
          sortOrder: p?.sortOrder ?? 9999,
        };
      })
      .filter((ua) => !ua.isEnabled);
    const disabledCustoms: UnifiedAgent[] = customAgents
      .map((a) => {
        const p = preferences.find((x) => x.agentId === a.id);
        const enabled = p ? p.isEnabled !== false : true; // default enabled if no pref
        return {
          key: `custom:${a.id}`,
          kind: 'custom' as const,
          id: a.id,
          name: a.name,
          description: a.description,
          content: a.content,
          iconKey: a.iconKey || 'Bot',
          colorHex: a.colorHex || '#10B981',
          isEnabled: enabled,
          sortOrder: p?.sortOrder ?? 9999,
        };
      })
      .filter((ua) => !ua.isEnabled);
    return [
      ...unifiedEnabledList,
      ...[...disabledBuiltins, ...disabledCustoms].sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [builtins, customAgents, preferences, unifiedEnabledList]);

  const selectByKey = useCallback((key: string) => setSelectedKey(key), []);

  const selectedUnified = useMemo(() => {
    return allUnifiedList.find((ua) => ua.key === selectedKey) || null;
  }, [allUnifiedList, selectedKey]);

  const dispatchAgentsUpdated = () => {
    try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('agents-updated')); } catch {}
  };

  const batchUpsertPreferences = useCallback(async (items: Array<{ agentId: string | null; agentBuiltinId: string | null; isEnabled: boolean; sortOrder: number; }>) => {
    const res = await fetch('/api/agents/prefs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to persist preferences');
    }
  }, []);

  // Toggle enable/disable preference for a unified agent
  const toggleEnabled = useCallback(async (key: string, enable: boolean) => {
    const target = allUnifiedList.find((x) => x.key === key);
    if (!target) return;
    const pref: AgentPreference = target.kind === 'custom'
      ? { userId: '', agentId: target.id, isEnabled: enable, sortOrder: target.sortOrder }
      : { userId: '', agentBuiltinId: target.id, isEnabled: enable, sortOrder: target.sortOrder };

    // optimistic update
    setPreferences((prev) => {
      const others = prev.filter((p) => (pref.agentId ? p.agentId !== pref.agentId : p.agentBuiltinId !== pref.agentBuiltinId));
      return [...others, pref];
    });
    try {
      const res = await fetch('/api/agents/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: pref.agentId ?? null,
          agentBuiltinId: pref.agentBuiltinId ?? null,
          isEnabled: pref.isEnabled,
          sortOrder: pref.sortOrder,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to save preference');
      dispatchAgentsUpdated();
    } catch (e: any) {
      toast('Failed to update preference', { description: e?.message || 'Unknown error' });
      // rollback
      setPreferences((prev) => {
        const existing = getPrefForKey(key);
        const others = prev.filter((p) => (pref.agentId ? p.agentId !== pref.agentId : p.agentBuiltinId !== pref.agentBuiltinId));
        return existing ? [...others, existing] : others;
      });
    }
  }, [allUnifiedList, getPrefForKey]);

  // Expose disabled list for right pane panel of available agents
  const disabledList: UnifiedAgent[] = useMemo(() => allUnifiedList.filter((x) => !x.isEnabled), [allUnifiedList]);

  // Reorder enabled list based on new ordered keys
  const persistReorder = useCallback(async (orderedKeys: string[]) => {
    if (isBusy) return;
    setIsBusy(true);
    prevOrderRef.current = unifiedEnabledList.map((x) => x.key);
    // optimistic update preferences with new sortOrder per enabled item
    const enabledSet = new Set(orderedKeys);
    lastStablePrefsRef.current = preferences;
    const newPrefs: AgentPreference[] = preferences.map((p) => {
      const key = p.agentId ? `custom:${p.agentId}` : (p.agentBuiltinId ? `builtin:${p.agentBuiltinId}` : '');
      if (!key || !enabledSet.has(key)) return p; // unchanged or disabled
      const idx = orderedKeys.indexOf(key);
      return { ...p, sortOrder: idx };
    });
    setPreferences(newPrefs);
    try {
      const items = orderedKeys.map((key, idx) => {
        const ua = unifiedEnabledList.find((x) => x.key === key);
        if (!ua) return null;
        return {
          agentId: ua.kind === 'custom' ? ua.id : null,
          agentBuiltinId: ua.kind === 'builtin' ? ua.id : null,
          isEnabled: true,
          sortOrder: idx,
        };
      }).filter(Boolean) as Array<{ agentId: string | null; agentBuiltinId: string | null; isEnabled: boolean; sortOrder: number; }>;
      await batchUpsertPreferences(items);
      toast('Order updated', { description: 'Your agent order has been saved.' });
      dispatchAgentsUpdated();
    } catch (e: any) {
      toast('Reorder failed', { description: e?.message || 'Unknown error' });
      // rollback
      if (lastStablePrefsRef.current) setPreferences(lastStablePrefsRef.current);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, unifiedEnabledList, preferences, batchUpsertPreferences]);

  const enableAtPosition = useCallback(async (key: string, targetIndex: number) => {
    const ua = unifiedEnabledList.find((x) => x.key === key) || allUnifiedList.find((x) => x.key === key);
    if (!ua) return;
    const isAlreadyEnabled = ua.isEnabled;
    const currentOrder = unifiedEnabledList.map((x) => x.key);
    const nextOrder = [...currentOrder];
    if (isAlreadyEnabled) {
      // move within enabled
      const fromIdx = nextOrder.indexOf(key);
      if (fromIdx < 0) return;
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(Math.max(0, Math.min(targetIndex, nextOrder.length)), 0, key);
    } else {
      // enable and insert
      nextOrder.splice(Math.max(0, Math.min(targetIndex, nextOrder.length)), 0, key);
    }
    await persistReorder(nextOrder);
    // also ensure enabled flag is true when previously disabled
    if (!isAlreadyEnabled) await toggleEnabled(key, true);
  }, [allUnifiedList, unifiedEnabledList, persistReorder, toggleEnabled]);

  const resetOrder = useCallback(async () => {
    if (unifiedEnabledList.length === 0) return;
    const byName = [...unifiedEnabledList].sort((a, b) => a.name.localeCompare(b.name));
    const orderedKeys = byName.map((x) => x.key);
    await persistReorder(orderedKeys);
  }, [unifiedEnabledList, persistReorder]);

  const saveCustomAgent = useCallback(async (input: SaveAgentInput, addToEnabled?: boolean) => {
    if (!input.name?.trim() || !input.content?.trim() || !input.iconKey) {
      toast('Missing required fields', { description: 'Name, content, and icon are required.' });
      return null;
    }
    setIsBusy(true);
    try {
      const res = await fetch('/api/agents/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: input.id || null,
          name: input.name,
          description: input.description || '',
          content: input.content,
          colorHex: input.colorHex || '#6366F1',
          iconKey: input.iconKey || 'Bot',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to save agent');
      }
      const { id } = await res.json();
      const newId = Array.isArray(id) ? id[0]?.id ?? input.id : (typeof id === 'string' ? id : input.id);
      const finalId = newId || input.id || '';
      const saved: AgentDefinition = {
        id: finalId,
        name: input.name,
        description: input.description || '',
        content: input.content,
        colorHex: input.colorHex || '#6366F1',
        iconKey: input.iconKey || 'Bot',
        isBuiltin: false,
      };
      setCustomAgents((prev) => {
        const idx = prev.findIndex((a) => a.id === finalId);
        if (idx >= 0) { const arr = [...prev]; arr[idx] = saved; return arr; }
        return [...prev, saved];
      });
      if (addToEnabled) {
        // set enabled + sort order to end
        const nextIndex = unifiedEnabledList.length;
        await fetch('/api/agents/prefs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: finalId, agentBuiltinId: null, isEnabled: true, sortOrder: nextIndex })
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Failed to enable agent');
          setPreferences((prev) => {
            const others = prev.filter((p) => p.agentId !== finalId);
            return [...others, { userId: '', agentId: finalId, isEnabled: true, sortOrder: nextIndex }];
          });
        });
      }
      toast('Agent saved', { description: input.id ? 'Updated successfully.' : 'Created successfully.' });
      dispatchAgentsUpdated();
      return saved;
    } catch (e: any) {
      toast('Save failed', { description: e?.message || 'Unknown error' });
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [unifiedEnabledList.length]);

  const deleteCustomAgent = useCallback(async (agentId: string) => {
    setIsBusy(true);
    const prevAgents = customAgents;
    const prevPrefs = preferences;
    // optimistic
    setCustomAgents((p) => p.filter((a) => a.id !== agentId));
    setPreferences((p) => p.filter((x) => x.agentId !== agentId));
    try {
      const res = await fetch('/api/agents/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: agentId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to delete agent');
      toast('Deleted', { description: 'Agent removed.' });
      dispatchAgentsUpdated();
    } catch (e: any) {
      toast('Delete failed', { description: e?.message || 'Unknown error' });
      // rollback
      setCustomAgents(prevAgents);
      setPreferences(prevPrefs);
    } finally {
      setIsBusy(false);
    }
  }, [customAgents, preferences]);

  return {
    // state
    customAgents,
    preferences,
    unifiedEnabledList,
    allUnifiedList,
    disabledList,
    selectedUnified,
    selectedKey,
    isBusy,
    // actions
    selectByKey,
    toggleEnabled,
    persistReorder,
    enableAtPosition,
    resetOrder,
    saveCustomAgent,
    deleteCustomAgent,
  };
}


