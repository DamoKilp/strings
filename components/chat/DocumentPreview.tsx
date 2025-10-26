"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { katexOptions } from "@/lib/katexOptions";
import { Card } from "@/components/ui/card";
import { useMarkdownComponents } from "./CodeBlockRenderer";
import InlineChart, { ChartSpec } from "./InlineChart";
import { useChatContext } from "@/components/contexts/ChatProvider";
interface DocumentPreviewProps {
  /** Raw markdown string to render. Tables supported via GFM. */
  markdown: string;
  /** Optional JSON string or object describing a simple chart to render inline above the markdown. */
  chartSpec?: ChartSpec | string | null;
  /** When provided, code fences will render inline (not full code window). */
  messageId: string;
  /** Visual container class. */
  className?: string;
}

/**
 * DocumentPreview renders a document-style view:
 * - Optional lightweight chart (SVG) using a small spec
 * - Markdown with tables (remark-gfm)
 * - Uses existing markdown components for consistent inline code styling
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  markdown,
  chartSpec,
  messageId,
  className,
}) => {
  const { chatFontSize } = useChatContext();
  const baseTextClass = useMemo(() => {
    switch (chatFontSize) {
      case 'xs': return 'text-[11px]';
      case 's': return 'text-xs';
      case 'sm': return 'text-sm';
      case 'md': return 'text-base';
      case 'lg': return 'text-lg';
      case 'xl': return 'text-xl';
      case 'xxl': return 'text-2xl';
      default: return 'text-base';
    }
  }, [chatFontSize]);
  const parsedChartSpec = useMemo<ChartSpec | null>(() => {
    if (!chartSpec) return null;
    if (typeof chartSpec === "string") {
      try {
        return JSON.parse(chartSpec) as ChartSpec;
      } catch {
        return null;
      }
    }
    return chartSpec;
  }, [chartSpec]);

  // Reuse markdown renderer but disable "show code in preview" hooks here
  const markdownComponents = useMarkdownComponents({
    messageId,
    isLoadingMessages: false,
    expandedCodeBlocks: {},
    setExpandedCodeBlocks: ((() => {}) as unknown as React.Dispatch<React.SetStateAction<Record<string, boolean>>>),
    copiedCodeBlockId: null,
    onCopyToClipboard: (_text: string, _id: string) => {},
    onShowCodeInPreview: (_code: string, _lang: string) => {},
  });

  return (
    <div className={className}>
      <Card className="p-4 md:p-6 space-y-4 overflow-auto max-h-full">
        {parsedChartSpec && (
          <InlineChart
            spec={{
              width: 720,
              height: 320,
              color: "#7c3aed",
              ...parsedChartSpec,
            }}
            className="overflow-x-auto"
          />
        )}
        <div className={`prose prose-slate dark:prose-invert max-w-none prose-pre:bg-transparent ${baseTextClass}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, katexOptions]]}
            components={markdownComponents}
          >
            {markdown || ""}
          </ReactMarkdown>
        </div>
      </Card>
    </div>
  );
};

export default DocumentPreview;


