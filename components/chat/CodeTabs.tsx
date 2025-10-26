// /components/chat/CodeTabs.tsx
"use client";

import React from "react";
import { CodeBlock } from "@/lib/codeUtils";
import { getCodeBlockUIIndicators } from "@/lib/codeUtils";
import { AlertTriangle, CheckCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CodeTabsProps {
  codeBlocks: CodeBlock[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

/**
 * CodeTabs displays selectable tabs for each code block.
 * Labels use filename. Includes validity indicators.
 */
const CodeTabs: React.FC<CodeTabsProps> = ({ codeBlocks, activeTab, onTabChange }) => {

  const getBaseFilename = (filepath: string): string => {
    if (!filepath) return "untitled";
    const parts = filepath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || "untitled";
  };

  return (
    <div className="bg-muted/60 dark:bg-gray-800/70 border-b border-border dark:border-gray-700 overflow-hidden">
      <div
        className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
        role="tablist"
        aria-label="Code Snippets"
      >
        {codeBlocks.map((block, idx) => {
          const label = getBaseFilename(block.filename);
          const { showWarningIcon, warningTooltip, severity } = getCodeBlockUIIndicators(block);
          const isActive = activeTab === idx;

          return (
            <TooltipProvider key={`${label}-${idx}-${block.filename}`} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-shrink-0 border-r border-border dark:border-gray-700 last:border-r-0">
                    <button
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`code-tab-panel-${idx}`}
                      id={`code-tab-${idx}`}
                      onClick={() => onTabChange(idx)}
                      className={`relative px-3 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-colors duration-150 flex items-center gap-1.5 ${
                        isActive
                          ? "bg-background dark:bg-slate-900 text-primary dark:text-slate-100 border-b-2 border-primary -mb-px"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50 dark:hover:bg-gray-700/50 hover:text-foreground dark:hover:text-slate-200"
                      }`}
                    >
                      {showWarningIcon && (
                        severity === 'error' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                        )
                      )}
                      {!showWarningIcon && block.isValid && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[150px]">{label}</span>
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-xs">
                    <p className="font-medium break-all">{block.filename}</p>
                    {warningTooltip && (
                         <p className={`mt-1 ${
                             severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                         }`}>
                             {warningTooltip}
                         </p>
                     )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};

CodeTabs.displayName = "CodeTabs";

export default React.memo(CodeTabs);