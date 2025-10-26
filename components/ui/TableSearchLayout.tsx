// Table Search Settings Layout Component (Two-pane structure matching AgentManagerLayout design)
"use client";

import React from 'react';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

export function TableSearchLayout({ left, right }: Props) {
  return (
    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(280px,400px)_1fr] gap-3 p-2">
      <div className="min-h-0 overflow-auto custom-scrollbar rounded-lg border rightpane-glass-card pl-2 pr-2 pb-4">
        <div className="sticky top-0 z-10 -mx-2 -mt-2 px-8 pt-2 pb-4 bg-background border-b border-border/50 backdrop-blur-sm rounded-t-lg">
          <div className="rightpane-card-title">Search Presets</div>
          <div className="rightpane-card-subtitle">Choose a preset or customize settings.</div>
        </div>
        <div className="mt-2">
          {left}
        </div>
      </div>
      <div className="min-h-0 overflow-auto custom-scrollbar rounded-lg border rightpane-glass-card p-4">
        {right}
      </div>
    </div>
  );
}

export default TableSearchLayout;

