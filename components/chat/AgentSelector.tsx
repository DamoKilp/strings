// /components/chat/AgentSelector.tsx
'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Settings } from 'lucide-react';
import AgentIcon from '@/components/ai/AgentIcon';
import { PrePrompt } from '@/components/data/prePrompts';
import { useChatContext } from '@/components/contexts/ChatProvider';

interface AgentSelectorProps {
  prePrompts: PrePrompt[];
  selectedPromptId: string;
  onPromptSelect: (promptId: string) => void;
  onOpenManager?: () => void; // optional handler to open Agent Manager dialog
}

export function AgentSelector({ 
  prePrompts, 
  selectedPromptId, 
  onPromptSelect,
  onOpenManager,
}: AgentSelectorProps) {
  const { customAgents, agentPreferences } = useChatContext();
  const selectedBuiltin = prePrompts.find(p => p.id === selectedPromptId);
  const selectedCustom = (customAgents || []).find(a => a.id === selectedPromptId);
  const selectedPromptName = selectedCustom?.name || selectedBuiltin?.name || prePrompts[0]?.name || 'Agent';

  // Built-in icon/color metadata to improve visual cues
  // Edit this mapping to adjust icons/colors for built-in agents shown in the selector and trigger.
  // Keys must match built-in `PrePrompt.id` values from `components/data/prePrompts.ts`.
  const BUILTIN_META: Record<string, { iconKey: string; colorHex: string }> = {
    'tutorial-agent': { iconKey: 'BookOpen', colorHex: '#6366F1' },
    'helpful-ai-assistant': { iconKey: 'Bot', colorHex: '#64748B' },
    'data-processing-specialist': { iconKey: 'Database', colorHex: '#06B6D4' },
    'location-mapping-specialist': { iconKey: 'Map', colorHex: '#10B981' },
    'debug-data-viewer': { iconKey: 'Search', colorHex: '#F59E0B' },
    'strategic-asset-manager': { iconKey: 'BarChart3', colorHex: '#8B5CF6' },
    'marine-facility-asset-engineer': { iconKey: 'Wrench', colorHex: '#0EA5E9' },
    'navaid-asset-engineer': { iconKey: 'Globe', colorHex: '#0EA5E9' },
    'geotech-engineer': { iconKey: 'Hammer', colorHex: '#F43F5E' },
    'civil-engineer': { iconKey: 'Wrench', colorHex: '#F59E0B' },
    'structural-engineer': { iconKey: 'Layers', colorHex: '#84CC16' },
    'electrical-engineer': { iconKey: 'Zap', colorHex: '#F59E0B' },
    'mechanical-engineer': { iconKey: 'Cog', colorHex: '#64748B' },
    'maths-tutor': { iconKey: 'Calculator', colorHex: '#06B6D4' },
  };
  const DEFAULT_BUILTIN = { iconKey: 'Bot', colorHex: '#64748B' };

  // Merge effective list: enabled built-ins + custom agents, apply preference ordering when present
  // Preference maps: treat missing preferences as enabled by default
  const builtinPrefEnabled = new Map<string, boolean>();
  const customPrefEnabled = new Map<string, boolean>();
  (agentPreferences || []).forEach(p => {
    if (p.agentBuiltinId) builtinPrefEnabled.set(p.agentBuiltinId, p.isEnabled !== false);
    if (p.agentId) customPrefEnabled.set(p.agentId, p.isEnabled !== false);
  });
  const effectiveBuiltins = prePrompts.filter(p => {
    if (!agentPreferences) return true;
    if (!builtinPrefEnabled.has(p.id)) return true; // default to enabled when no explicit pref
    return builtinPrefEnabled.get(p.id) as boolean;
  });
  const sortOrderByBuiltin = new Map<string, number>();
  const sortOrderByCustom = new Map<string, number>();
  (agentPreferences || []).forEach(p => {
    if (p.agentBuiltinId) sortOrderByBuiltin.set(p.agentBuiltinId, p.sortOrder ?? 0);
    if (p.agentId) sortOrderByCustom.set(p.agentId, p.sortOrder ?? 0);
  });

  type Option = {
    id: string;
    kind: 'builtin' | 'custom';
    name: string;
    description?: string;
    iconKey: string;
    colorHex: string;
    sortOrder: number;
  };

  const builtinOptions: Option[] = effectiveBuiltins.map((p) => {
    const meta = BUILTIN_META[p.id] || DEFAULT_BUILTIN;
    return {
      id: p.id,
      kind: 'builtin',
      name: p.name,
      description: p.description,
      iconKey: meta.iconKey,
      colorHex: meta.colorHex,
      sortOrder: sortOrderByBuiltin.has(p.id) ? (sortOrderByBuiltin.get(p.id) as number) : 9999,
    };
  });

  const customOptions: Option[] = (customAgents || [])
    .filter(a => {
      if (!agentPreferences) return true;
      if (!customPrefEnabled.has(a.id)) return true;
      return customPrefEnabled.get(a.id) as boolean;
    })
    .map(a => ({
      id: a.id,
      kind: 'custom',
      name: a.name,
      description: a.description,
      iconKey: a.iconKey || 'Bot',
      colorHex: a.colorHex || '#10B981',
      sortOrder: sortOrderByCustom.has(a.id) ? (sortOrderByCustom.get(a.id) as number) : 9999,
    }));

  const allOptions: Option[] = [...builtinOptions, ...customOptions]
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

  const selectedOption: Option | undefined = selectedCustom
    ? {
        id: selectedCustom.id,
        kind: 'custom',
        name: selectedCustom.name,
        description: selectedCustom.description,
        iconKey: selectedCustom.iconKey || 'Bot',
        colorHex: selectedCustom.colorHex || '#10B981',
        sortOrder: sortOrderByCustom.has(selectedCustom.id) ? (sortOrderByCustom.get(selectedCustom.id) as number) : 9999,
      }
    : (selectedBuiltin
        ? {
            id: selectedBuiltin.id,
            kind: 'builtin',
            name: selectedBuiltin.name,
            description: selectedBuiltin.description,
            iconKey: (BUILTIN_META[selectedBuiltin.id] || DEFAULT_BUILTIN).iconKey,
            colorHex: (BUILTIN_META[selectedBuiltin.id] || DEFAULT_BUILTIN).colorHex,
            sortOrder: sortOrderByBuiltin.has(selectedBuiltin.id) ? (sortOrderByBuiltin.get(selectedBuiltin.id) as number) : 9999,
          }
        : undefined);

  return (
    <TooltipProvider>
      <Select value={selectedPromptId} onValueChange={(val) => {
        if (val === '__manage_agents__') {
          onOpenManager?.();
          return; // keep selection unchanged
        }
        onPromptSelect(val);
      }}>
        <SelectTrigger className="chat-control-btn agent-selector-enhanced w-[160px] lg:w-[140px] md:w-[120px] sm:w-[110px] h-7 text-[10px] text-slate-200 dark:text-slate-200 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-700 data-[placeholder]:text-slate-400">
          <SelectValue placeholder="Select agent">
            <span className="flex items-center gap-1">
              {selectedOption ? (
                <AgentIcon iconKey={selectedOption.iconKey} colorHex={selectedOption.colorHex} size={12} />
              ) : (
                <AgentIcon iconKey={DEFAULT_BUILTIN.iconKey} colorHex={DEFAULT_BUILTIN.colorHex} size={12} />
              )}
              <span className="truncate">{selectedPromptName}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="!bg-slate-900 !text-slate-200 border border-slate-700">
          {allOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} className="text-slate-200 focus:bg-slate-800 focus:text-slate-100">
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-2">
                  <AgentIcon iconKey={opt.iconKey} colorHex={opt.colorHex} />
                  <span className="font-medium">{opt.name}</span>
                </div>
                {opt.description && (
                  <p className="text-xs text-muted-foreground mt-1 pl-5">{opt.description}</p>
                )}
              </div>
            </SelectItem>
          ))}
          {/* Agent Manager entry */}
          <SelectItem value="__manage_agents__" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100">
            <div className="flex items-center gap-2">
              <Settings className="h-3 w-3" />
              <span className="font-medium">Manage agents…</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </TooltipProvider>
  );
}