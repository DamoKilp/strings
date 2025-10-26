// /components/chat/agentManager/AgentTile.tsx
"use client";

import React from 'react';
import AgentIcon from '@/components/ai/AgentIcon';
import { cn } from '@/lib/utils';

type Props = {
  name: string;
  description?: string;
  iconKey: string;
  colorHex: string;
  isSelected?: boolean;
  onClick?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  rightSlot?: React.ReactNode; // e.g., toggle
};

export function AgentTile({ name, description, iconKey, colorHex, isSelected, onClick, dragHandleProps, rightSlot }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md border bg-background/60 backdrop-blur custom-scrollbar',
        isSelected ? 'ring-2 ring-primary/40' : ''
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <button
        aria-label="Drag to reorder"
        className="w-6 h-6 shrink-0 rounded-sm border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
        {...dragHandleProps}
      >
        {/* drag grip */}
        <span className="w-3 h-3 grid grid-cols-2 gap-[2px]">
          <span className="w-1 h-1 bg-current/60 rounded" />
          <span className="w-1 h-1 bg-current/60 rounded" />
          <span className="w-1 h-1 bg-current/60 rounded" />
          <span className="w-1 h-1 bg-current/60 rounded" />
        </span>
      </button>

      <AgentIcon iconKey={iconKey} colorHex={colorHex} />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{name}</div>
        {description && (
          <div className="text-xs text-muted-foreground truncate" title={description}>{description}</div>
        )}
      </div>
      {rightSlot}
    </div>
  );
}

export default AgentTile;


