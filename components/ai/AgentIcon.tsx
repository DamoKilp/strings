// /components/ai/AgentIcon.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import * as Lucide from 'lucide-react';

export interface AgentIconProps {
  iconKey?: string; // lucide icon name, e.g., 'Bot'
  colorHex?: string; // hex color used for badge/background
  className?: string;
  size?: number; // px size of icon glyph
}

export function AgentIcon({ iconKey = 'Bot', colorHex = '#6366F1', className, size = 14 }: AgentIconProps) {
  const IconComponent = (Lucide as unknown as Record<string, React.ComponentType<any>>)[iconKey] || Lucide.Bot;
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-sm', className)}
      aria-hidden
      style={{ backgroundColor: `${colorHex}1A`, color: colorHex, width: size + 8, height: size + 8 }}
    >
      <IconComponent width={size} height={size} />
    </span>
  );
}

export default AgentIcon;



