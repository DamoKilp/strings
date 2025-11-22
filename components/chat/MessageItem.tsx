"use client";

// Import glass design system
import '@/app/Projects/formBuilder/styles/glass-system.css';
import './chat-effects.css';

import React, { useState } from 'react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { Copy, Check, Trash2 } from 'lucide-react';
import { ChatMessage } from '@/lib/types';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { katexOptions } from '@/lib/katexOptions';
import { useMarkdownComponents } from './CodeBlockRenderer'; // Keep using this for code blocks
import type { ChartSpec } from './InlineChart';
import { ModelIcon } from '@/components/icons/ModelIcon';

interface MessageItemProps {
  message: ChatMessage;
  selectedModelName?: string;
  selectedModelProviderId?: string;
  // State needed by CodeBlockRenderer
  isLoadingMessages: boolean;
  expandedCodeBlocks: Record<string, boolean>;
  setExpandedCodeBlocks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  copiedCodeBlockId: string | null;
  // Callbacks needed by CodeBlockRenderer or MessageItem itself
  onCopyToClipboard: (text: string, idToMark: string) => void;
  onShowCodeInPreview: (code: string, language: string) => void;
  // New: open whole message in document viewer
  onOpenInDoc?: () => void;
  // Prop for MessageItem's own copy button state
  isCopied: boolean;
  // showAttachments prop is now less relevant if images are inline, but keep if needed for other file types later
  showAttachments?: boolean;
  // Whether this message is currently streaming (enables subtle fade mask/animation)
  isStreaming?: boolean;
  onDelete?: (id: string) => void;
}

/// MessageItem component
/// This component renders a single message in the chat interface.
export const MessageItem = React.memo(({
  message,
  selectedModelName,
  selectedModelProviderId,
  isLoadingMessages,
  expandedCodeBlocks,
  setExpandedCodeBlocks,
  copiedCodeBlockId,
  onCopyToClipboard,
  onShowCodeInPreview,
  onOpenInDoc,
  isCopied,
  showAttachments: _showAttachments = true, // Keep prop, but unused
  isStreaming,
  onDelete,
}: MessageItemProps) => {
  const { id, role, content, createdAt } = message;
  const { chatFontSize, user } = useChatContext();

  // Local state for message action copying
  const [messageActionsCopied, setMessageActionsCopied] = useState(false);
  const [showRawLatex, setShowRawLatex] = useState(false);

  const isAssistant = role === "assistant";
  const isUser = role === "user";
  const isSystem = role === "system";

  // Call the hook at the top level to get markdown components for code blocks.
  const markdownComponents = useMarkdownComponents({
    messageId: id,
    isLoadingMessages,
    expandedCodeBlocks,
    setExpandedCodeBlocks,
    copiedCodeBlockId,
    onCopyToClipboard,
    onShowCodeInPreview,
  });

  // Note: We rely on per-block "Copy LaTeX" UI to avoid bundling Flow-typed copy-tex plugin.

  // Classes for chat bubble styling based on role.
  const bubbleClasses = isAssistant
    ? "bg-purple-50/60 dark:bg-slate-700/40 text-foreground border border-purple-100 dark:border-slate-600/30 rounded-xl rounded-tl-sm chat-bubble-assistant shadow-lg shadow-purple-100/20 dark:shadow-black/20 backdrop-blur-md"
    : isSystem
    ? "self-center max-w-md bg-slate-100/70 dark:bg-slate-800/70 text-muted-foreground italic glass-text-subhead rounded-lg border border-slate-200/70 dark:border-slate-700/50 backdrop-blur-sm shadow-sm"
    : "self-end bg-blue-50/60 dark:bg-slate-600/40 text-foreground rounded-xl rounded-tr-sm border border-blue-100 dark:border-slate-500/30 chat-bubble-user shadow-lg shadow-blue-100/20 dark:shadow-black/20 backdrop-blur-md";

  const modelNameToDisplay = isAssistant ? selectedModelName : undefined;

  // --- MODIFIED: Format date and time for message timestamp ---
  // This function formats the date to a readable time string.
  const formatDateTime = (date?: Date): string => {
    if (!date) return '';
    try {
      if (!(date instanceof Date) || isNaN(date.getTime())) {

        return '';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {

      return '';
    }
  };

  // --- MODIFIED: Get text content for copying, normalizing artifacts and stripping markdown ---
  function stripMarkdownToText(input: string): string {
    if (!input) return input;
    let out = input;
    // Images ![alt](url) → alt
    out = out.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');
    // Links [text](url) → text
    out = out.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Code fences ```lang\ncode``` → code
    out = out.replace(/```[\w-]*\n([\s\S]*?)```/g, '$1');
    // Inline code `code` → code
    out = out.replace(/`([^`]*)`/g, '$1');
    // Headings ## Title → Title
    out = out.replace(/^#{1,6}\s*/gm, '');
    // Blockquotes > text → text
    out = out.replace(/^>\s?/gm, '');
    // Bold/italics **text** *text* __text__ _text_ → text
    out = out.replace(/\*\*(.*?)\*\*/g, '$1')
             .replace(/__(.*?)__/g, '$1')
             .replace(/\*(.*?)\*/g, '$1')
             .replace(/_(.*?)_/g, '$1');
    // Lists markers normalize
    out = out.replace(/^\s*[-*+]\s+/gm, '- ');
    // Normalize newlines
    out = out.replace(/\r\n/g, '\n');
    // Collapse excessive blank lines
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }

  const getTextContentForCopy = (): string => {
    // If content is a string, it might be JSON-serialized parts or markdown
    if (typeof content === 'string') {
      // Try to parse stringified array of text parts first
      try {
        const parsedUnknown = JSON.parse(content) as unknown;
        type TextPartLike = { type: 'text'; text: string };
        const isTextPartLike = (u: unknown): u is TextPartLike => {
          if (typeof u !== 'object' || u === null) return false;
          const maybe = u as { type?: unknown; text?: unknown };
          return maybe.type === 'text' && typeof maybe.text === 'string';
        };
        if (Array.isArray(parsedUnknown) && parsedUnknown.length > 0 && isTextPartLike(parsedUnknown[0])) {
          const joined = parsedUnknown
            .filter(isTextPartLike)
            .map(p => p.text)
            .join('\n')
            .replace(/\\n/g, '\n');
          return stripMarkdownToText(joined);
        }
      } catch {
        // not JSON, continue
      }
      // Fallback: normalize escaped newlines and strip markdown
      return stripMarkdownToText(content.replace(/\\n/g, '\n'));
    }
    // If it's an array of parts, join text parts
    if (Array.isArray(content)) {
      const joined = content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text)
        .join('\n');
      return stripMarkdownToText(joined);
    }
    return '';
  };
  // --------------------------------------------------------------------------

  // --- NEW: Get text content for display (for Markdown), handling escaped JSON and newline artifacts ---
  /**
   * Handles certain stringified array cases, converting:
   *  - `[{"type":"text","text":"some text\nnext"}]` → 'some text\nnext'
   *  - Handles string "\n" → real newlines
   * Otherwise, falls back to existing logic.
   */
  const getDisplayTextContent = (): string | undefined => {
    if (typeof content === 'string') {
      // Check if it looks like a serialized array of [{type:'text', text:...}]
      try {
        const parsedUnknown = JSON.parse(content) as unknown;
        type TextPartLike = { type: 'text'; text: string };
        const isTextPartLike = (u: unknown): u is TextPartLike => {
          if (typeof u !== 'object' || u === null) return false;
          const maybe = u as { type?: unknown; text?: unknown };
          return maybe.type === 'text' && typeof maybe.text === 'string';
        };
        if (Array.isArray(parsedUnknown) && parsedUnknown.length > 0 && isTextPartLike(parsedUnknown[0])) {
          // Concatenate all text fields with line breaks
          return parsedUnknown
            .filter(isTextPartLike)
            .map((part) => part.text)
            .join('\n')
            .replace(/\\n/g, '\n'); // Replace literal \n with actual newline
        }
      } catch {
        // Not JSON, continue with fallback
      }
      // Not an artifact, return as-is (with literal \n replaced, and normalize math delimiters)
      return normalizeMathDelimiters(content.replace(/\\n/g, '\n'));
    }
    // If it's already array, follow existing logic (handled in renderMessageContent)
    return undefined; // Let renderMessageContent handle non-string
  };
  // --------------------------------------------------------------------------

  // --- NEW: Transform json fences and bare JSON blocks into chart fences for inline rendering ---
  function isChartSpecLike(obj: unknown): obj is ChartSpec {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    const t = o.type;
    const d = o.data;
    const ds = o.datasets as unknown;
    const typeOk = t === 'bar' || t === 'line' || t === 'pie';
    const dataOk = Array.isArray(d);
    const datasetsOk = Array.isArray(ds) && ds.length > 0;
    return Boolean(typeOk && (dataOk || datasetsOk));
  }

  function transformChartsInMarkdown(md: string): string {
    if (!md) return md;

    let out = md;

    // 1) Convert ```json fences that are valid ChartSpec to ```chart
    const jsonFenceRegex = /```json\s+([\s\S]*?)```/gi;
    out = out.replace(jsonFenceRegex, (full, jsonBody: string) => {
      try {
        const parsed = JSON.parse(jsonBody);
        if (isChartSpecLike(parsed)) {
          return '```chart\n' + jsonBody.trim() + '\n```';
        }
        // If it looks like an attempted chart (has keys) but invalid, add a tiny note after
        if (/"type"|"data"/i.test(jsonBody)) {
          return full + '\n\n_(chart parsing failed)_';
        }
        return full;
      } catch {
        // Leave as-is and add minimal note if it resembles chart
        if (/"type"|"data"/i.test(jsonBody)) {
          return full + '\n\n_(chart parsing failed)_';
        }
        return full;
      }
    });

    // 2) Convert bare JSON standalone blocks anywhere to ```chart fences
    // Scan outside code fences for top-level JSON object blocks
    const convertBareJsonBlocks = (s: string): string => {
      let i = 0;
      let inFence = false;
      let result = '';
      while (i < s.length) {
        // detect fence start/end
        if (s.startsWith('```', i)) {
          inFence = !inFence;
          result += '```';
          i += 3;
          continue;
        }
        if (!inFence && s[i] === '{') {
          // Ensure this '{' starts at line boundary or after whitespace
          const prevChar = i === 0 ? '\n' : s[i - 1];
          // Only consider if at start of line or preceded by whitespace/newline
          if (/\s|\n/.test(prevChar)) {
            // Attempt to extract balanced JSON object
            let idx = i;
            let depth = 0;
            let inStr = false;
            let esc = false;
            while (idx < s.length) {
              const ch = s[idx];
              if (inStr) {
                if (esc) { esc = false; }
                else if (ch === '\\') { esc = true; }
                else if (ch === '"') { inStr = false; }
              } else {
                if (ch === '"') inStr = true;
                else if (ch === '{') depth++;
                else if (ch === '}') { depth--; if (depth === 0) { idx++; break; } }
                // Break on code fence start to avoid spanning
                if (!inStr && s.startsWith('```', idx)) break;
              }
              idx++;
            }
            if (depth === 0) {
              const jsonStr = s.slice(i, idx);
              try {
                const parsed = JSON.parse(jsonStr);
                if (isChartSpecLike(parsed)) {
                  result += '```chart\n' + jsonStr.trim() + '\n```';
                  i = idx;
                  continue;
                }
                // If resembles chart but invalid, keep and add a note
                if (/"type"|"data"/i.test(jsonStr)) {
                  result += jsonStr + '\n\n_(chart parsing failed)_';
                  i = idx;
                  continue;
                }
              } catch {
                // Not valid JSON, fall through to append char-by-char
              }
            }
          }
        }
        // Default: append current char
        result += s[i];
        i++;
      }
      return result;
    };

    out = convertBareJsonBlocks(out);
    return out;
  }

  // Normalize common TeX delimiters (\( .. \) and \[ .. \]) into $..$ and $$..$$
  // This allows remark-math to pick them up reliably.
  function normalizeMathDelimiters(input: string): string {
    if (!input) return input;
    // Only convert explicit LaTeX delimiters \( \) and \[ \]
    // Do NOT touch plain parentheses/brackets in normal text
    return input
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$')
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$');
  }

  const copyMessage = () => {
    const textToCopy = getTextContentForCopy();
    if (!textToCopy) return;
    onCopyToClipboard(textToCopy, `msg-${id}`);
    setMessageActionsCopied(true);
    setTimeout(() => setMessageActionsCopied(false), 2000);
  };

  // --- MODIFIED: Render structured content ---
  const renderMessageContent = () => {
    // Handle specific roles like tool/function
    if (role === 'tool' || role === 'function') {
      return (
        <pre className="glass-text-footnote bg-white/30 dark:bg-white/20 p-3 rounded-lg overflow-auto backdrop-blur-sm border border-white/20 dark:border-white/15">
          <code>{getTextContentForCopy() || '(No content)'}</code>
        </pre>
      );
    }

    // If content is a simple string (e.g., assistant response, older messages)
    if (typeof content === 'string') {
      // Use getDisplayTextContent to clean up artifacts for display
      const displayText = getDisplayTextContent();
      const transformed = transformChartsInMarkdown(displayText || "");
      return showRawLatex ? (
        <pre className="glass-text-footnote bg-white/30 dark:bg-white/20 p-3 rounded-lg overflow-auto backdrop-blur-sm border border-white/20 dark:border-white/15">
          <code>{transformed || ""}</code>
        </pre>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, katexOptions]]}
          components={markdownComponents}
        >
          {transformed || ""}
        </ReactMarkdown>
      );
    }

    // If content is an array of parts
    // This is where we handle the structured content with text and images
    // Ensure content is an array and map over it
    if (Array.isArray(content)) {
      return content.map((part, index) => {
        if (part.type === 'text') {
          return showRawLatex ? (
            <pre key={`${id}-part-${index}`} className="glass-text-footnote bg-white/30 dark:bg-white/20 p-3 rounded-lg overflow-auto backdrop-blur-sm border border-white/20 dark:border-white/15">
              <code>{part.text || ""}</code>
            </pre>
          ) : (
            <ReactMarkdown
              key={`${id}-part-${index}`}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, katexOptions]]}
              components={markdownComponents}
            >
              {transformChartsInMarkdown(part.text || "")}
            </ReactMarkdown>
          );
        } else if (part.type === 'image' && typeof part.image === 'string') {
          // Render image using the Base64 data URI
          return (
            <div key={`${id}-part-${index}`} className="my-2 inline-block mr-2">
              <Image
                src={part.image} // Use the Base64 string directly
                alt="User uploaded image"
                width={150} // Adjust size as needed
                height={150}
                className="object-cover rounded-lg border border-white/30 dark:border-white/20 shadow-md hover:shadow-lg transition-shadow duration-200"
                style={{ width: '150px', height: '150px' }} // Ensure consistent size
              />
            </div>
          );
        }
        // Add rendering for other part types if needed later
        return null;
      });
    }

    // Fallback for unexpected content types
    return <span>(Invalid message content)</span>;
  };
  // -----------------------------------------

  // REMOVED: renderAttachments function as images are now inline via renderMessageContent

  return (
    <div className={`flex w-full group relative ${isAssistant ? 'justify-start' : isUser ? 'justify-end' : 'justify-center'}`}>
      {/* Render avatar if not a system message */}
      {!isSystem && (
        <div className={`flex-shrink-0 self-start pt-1 ${isAssistant ? "mr-2 md:mr-3" : "ml-2 md:ml-3 order-last"}`}>
          {isAssistant ? (
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/30 dark:border-white/20 shadow-md hover:shadow-lg transition-shadow duration-200 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-1">
              <ModelIcon 
                providerId={selectedModelProviderId} 
                size={20}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/30 dark:border-white/20 shadow-md hover:shadow-lg transition-shadow duration-200 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-xs md:text-sm">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
      )}
      <div className={`message-bubble ${isAssistant && isStreaming ? 'fade-in-up' : ''} backdrop-blur-sm max-w-[78%] sm:max-w-[85%] md:max-w-[90%] px-3 md:px-4 py-2.5 md:py-3 transition-all duration-200 hover:shadow-xl ${bubbleClasses}`}>
        <div className="flex items-center justify-between glass-text-caption-1 mb-2 gap-2 flex-wrap">
          <span className="glass-text-caption-1 glass-weight-semibold capitalize flex items-center">
            {role === 'assistant' ? 'Assistant' : role === 'user' ? 'You' : role}
            {modelNameToDisplay && (
              <span className="bg-background/30 px-1.5 py-0.5 rounded-full glass-text-caption-2 glass-weight-medium ml-1.5 font-mono whitespace-nowrap">
                {modelNameToDisplay}
              </span>
            )}
          </span>
          <span className="opacity-60 whitespace-nowrap glass-text-caption-2 glass-weight-regular">
            {formatDateTime(createdAt)}
          </span>
        </div>

        {/* --- Use the new rendering function --- */}
        <div className={`message-content ${
          chatFontSize==='xs' ? 'glass-text-caption-2' :
          chatFontSize==='s' ? 'glass-text-caption-1' :
          chatFontSize==='sm' ? 'glass-text-footnote' :
          chatFontSize==='md' ? 'glass-text-subhead' :
          chatFontSize==='lg' ? 'glass-text-body' :
          chatFontSize==='xl' ? 'glass-text-headline' :
          'glass-text-title-3'
        } max-w-none dark:!text-white break-words overflow-wrap-anywhere ${isStreaming ? 'streaming-fade-mask' : ''}`}>
          {renderMessageContent()}
        </div>
        {/* ------------------------------------- */}

        {/* Message Actions - copy button (uses getTextContentForCopy) */}
        {!isSystem && getTextContentForCopy().trim() && (
          <div className="message-actions opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex flex-wrap justify-end gap-1.5 md:gap-2 mt-2 md:mt-3 pt-2 border-t border-white/20 dark:border-white/15">
            {onOpenInDoc && (
              <button
                onClick={onOpenInDoc}
                className="rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:glass-text-caption-1 glass-weight-medium flex items-center gap-1 md:gap-1.5 transition-all duration-200 backdrop-blur-sm bg-white/40 hover:bg-white/60 dark:bg-white/20 dark:hover:bg-white/30 shadow-sm hover:shadow-md touch-manipulation"
                title="Open in document viewer"
              >
                <span className="hidden sm:inline glass-weight-medium">Open in Doc</span>
                <span className="sm:hidden glass-weight-medium">Doc</span>
              </button>
            )}
            <button
              onClick={copyMessage}
              className={`rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:glass-text-caption-1 glass-weight-medium flex items-center gap-1 md:gap-1.5 transition-all duration-200 backdrop-blur-sm touch-manipulation ${
                isCopied || messageActionsCopied
                  ? "bg-green-500/80 text-white shadow-md"
                  : "bg-white/40 hover:bg-white/60 dark:bg-white/20 dark:hover:bg-white/30 shadow-sm hover:shadow-md"
              }`}
              title="Copy message content"
            >
              {isCopied || messageActionsCopied ? (
                <>
                  <Check className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span className="glass-weight-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span className="glass-weight-medium">Copy</span>
                </>
              )}
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(id)}
                className="rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:glass-text-caption-1 glass-weight-medium flex items-center gap-1 md:gap-1.5 transition-all duration-200 backdrop-blur-sm bg-white/40 hover:bg-white/60 dark:bg-white/20 dark:hover:bg-white/30 shadow-sm hover:shadow-md touch-manipulation"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                <span className="hidden sm:inline glass-weight-medium">Delete</span>
              </button>
            )}
            <button
              onClick={() => setShowRawLatex(v => !v)}
              className="rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:glass-text-caption-1 glass-weight-medium flex items-center gap-1 md:gap-1.5 transition-all duration-200 backdrop-blur-sm bg-white/40 hover:bg-white/60 dark:bg-white/20 dark:hover:bg-white/30 shadow-sm hover:shadow-md touch-manipulation"
              title={showRawLatex ? 'Hide raw LaTeX' : 'Show raw LaTeX'}
            >
              <span className="hidden sm:inline glass-weight-medium">{showRawLatex ? 'Hide' : 'Show'} LaTeX</span>
              <span className="sm:hidden glass-weight-medium">LaTeX</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
MessageItem.displayName = 'MessageItem';


