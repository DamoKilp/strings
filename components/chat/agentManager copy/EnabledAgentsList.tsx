// /components/chat/agentManager/EnabledAgentsList.tsx
"use client";

import React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/components/ui/switch';
import AgentTile from './AgentTile';

export type EnabledItem = {
  key: string; // builtin:<id> or custom:<id>
  name: string;
  description?: string;
  iconKey: string;
  colorHex: string;
};

type Props = {
  items: EnabledItem[];
  onToggle: (key: string, enabled: boolean) => void;
  isEnabled: (key: string) => boolean;
  onSelect: (key: string) => void;
  selectedKey?: string | null;
};

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children instanceof Object && 'props' in (children as any)
        ? React.cloneElement(children as any, { dragHandleProps: listeners })
        : children}
    </div>
  );
}

export function EnabledAgentsList({ items, onToggle, isEnabled, onSelect, selectedKey }: Props) {
  return (
    <div className="flex flex-col gap-2 pt-2" role="listbox" aria-label="Enabled agents (reorderable)">
      <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.key} id={item.key}>
            <AgentTile
              name={item.name}
              description={item.description}
              iconKey={item.iconKey}
              colorHex={item.colorHex}
              isSelected={selectedKey === item.key}
              onClick={() => onSelect(item.key)}
              rightSlot={
                <Switch
                  checked={isEnabled(item.key)}
                  onCheckedChange={(v) => onToggle(item.key, v)}
                  aria-label={isEnabled(item.key) ? 'Disable agent' : 'Enable agent'}
                />
              }
            />
          </SortableRow>
        ))}
      </SortableContext>
    </div>
  );
}

export default EnabledAgentsList;


