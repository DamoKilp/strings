// /components/chat/CodeSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import CodeWindow from "./CodeWindow"; 
import CodeTabs from "./CodeTabs";
import { CodeBlock } from "@/lib/codeUtils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CodeSectionProps {
  codeBlocks: CodeBlock[];
  onClose: () => void;
}

const FALLBACK_CODE_BLOCK: CodeBlock = {
  filename: "/welcome.txt",
  language: "plaintext",
  code: "// Welcome to the Code Panel\n\n// This panel will show code from assistant messages.\n\n// When the assistant provides code, it will appear here.\n\n// You can also click the 'Show Code' button to see example code.",
  isValid: true,
  contentType: "text/plain"
};

/**
 * CodeSection displays code blocks using tabs and a code editor.
 */
const CodeSection: React.FC<CodeSectionProps> = ({ codeBlocks, onClose }) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  // Validate and correct activeTab index when codeBlocks change
  // This ensures UI consistency when code blocks are added/removed
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (codeBlocks.length > 0) {
      const isValidIndex = activeTab >= 0 && activeTab < codeBlocks.length;
      if (!isValidIndex) {
        setActiveTab(0);
      }
    }
  }, [codeBlocks, activeTab]);

  const hasValidCodeBlocks = Array.isArray(codeBlocks) && codeBlocks.length > 0;
  const currentCodeBlock = hasValidCodeBlocks && activeTab >= 0 && activeTab < codeBlocks.length
    ? codeBlocks[activeTab]
    : FALLBACK_CODE_BLOCK;

  return (
    <div className="w-full h-full flex flex-col bg-muted/30 dark:bg-gray-900/40 border-l border-border">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/50 dark:bg-gray-800/60 flex-shrink-0">
        <h3 className="text-sm font-semibold px-2">
          Code Preview
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          title="Close code panel"
          aria-label="Close code panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {hasValidCodeBlocks && (
        <div className="flex-shrink-0">
          <CodeTabs
            codeBlocks={codeBlocks}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}

      <div className="flex-grow min-h-[400px] bg-background dark:bg-slate-900 relative overflow-hidden">
        <CodeWindow
          key={`editor-${currentCodeBlock.filename}-${activeTab}`}
          code={currentCodeBlock.code}
          language={currentCodeBlock.language}
          contentType={currentCodeBlock.contentType}
          containerClass="h-full w-full"
        />
      </div>
    </div>
  );
};

export default React.memo(CodeSection);