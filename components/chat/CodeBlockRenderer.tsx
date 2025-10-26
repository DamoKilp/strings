// /components/chat/CodeBlockRenderer.tsx
import React from 'react';
import { Components } from 'react-markdown';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';

// Helper function for generating unique IDs for code blocks
const generateCodeBlockId = (code: string, messageId: string): string => {
  // Using messageId and an index relative to the *message* ensures uniqueness within that message
  // Note: This requires passing index from where codeComponent is called if multiple blocks exist per message.
  // If ReactMarkdown doesn't easily provide an index, we might need a simpler approach for now.

  // --- Simpler Stable ID (Less collision-proof but avoids random): ---
  const prefix = code.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '');
  // Use messageId to scope the uniqueness
  return `code-${messageId}-${prefix}-${code.length}`;
};


// Define the props for the code component with correct typing
interface CodeProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: unknown;
}

// This custom hook returns an object for rendering markdown components.
// It maps to our custom codeComponent which handles both block and inline code.
export function useMarkdownComponents({
  messageId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isLoadingMessages,
  expandedCodeBlocks,
  setExpandedCodeBlocks,
  copiedCodeBlockId,
  onCopyToClipboard,
  onShowCodeInPreview,
}: {
  messageId: string;
  isLoadingMessages: boolean;
  expandedCodeBlocks: Record<string, boolean>;
  setExpandedCodeBlocks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  copiedCodeBlockId: string | null;
  onCopyToClipboard: (text: string, idToMark: string) => void;
  onShowCodeInPreview: (code: string, language: string) => void;
}): Components {
  // Function to toggle code block expansion
  const toggleCodeBlock = React.useCallback((codeId: string) => {
    setExpandedCodeBlocks((prev) => ({ ...prev, [codeId]: !prev[codeId] }));
  }, [setExpandedCodeBlocks]);

  // Copy code to clipboard with visual feedback
  const copyCodeToClipboard = React.useCallback((code: string, codeId: string) => {
    onCopyToClipboard(code, codeId);
  }, [onCopyToClipboard]);

  // Code component that handles inline and block code rendering.
  const codeComponent = React.useCallback((props: CodeProps) => {
    const { inline, className, children, ...rest } = props;
    
    //console.log('Rendering code component:', { inline, className, childrenType: typeof children });
    
    // If the markdown parser indicates inline code, render it as an inline <code> element.
    if (inline) {
      return (
        <code 
          className="font-mono glass-text-caption-1 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-sm"
          {...rest}
        >
          {children}
        </code>
      );
    }
    
    // Extract the code string from children and trim any whitespace.
    const rawChildren = Array.isArray(children) ? children.join('') : String(children);
    const trimmedCode = rawChildren.trim();
    
    // Added check: if the code is very short (e.g. single arithmetic operator),
    // we want it to appear inline rather than as a separate block.
    if (!inline && trimmedCode.length <= 400 && !trimmedCode.includes('\n')) {
      return (
        <code 
          className="font-mono glass-text-caption-1 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/30 px-1 select-text"
          {...rest}
        >
          {children}
        </code>
      );
    }
    
    // Determine the language if className matches language-(\w+)
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'plaintext';
    
  // Note: removed short-code debug branch to satisfy lint
    
    const lines = trimmedCode.split('\n');
    const lineCount = lines.length;
    const codeId = generateCodeBlockId(trimmedCode, messageId);
    const isExpanded = expandedCodeBlocks[codeId];
    const isCopied = copiedCodeBlockId === codeId;

    // For short blocks (single-line or very short code content) render a preview block
    if ((lineCount === 1 && trimmedCode.length < 80) || trimmedCode.length < 40) {
      return (
        <div className="my-3 group">
          <pre
            className={`bg-gray-50 dark:bg-gray-800/90 p-4 rounded-md overflow-x-auto border border-gray-200 dark:border-gray-700 shadow-sm ${className || ""}`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="font-mono glass-text-caption-2 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {language !== "plaintext" ? language : "Code"}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onShowCodeInPreview && (
                  <button
                    onClick={() => onShowCodeInPreview(trimmedCode, language)}
                    className="glass-text-caption-2 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 px-2 py-0.5 rounded glass-weight-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                      </svg>
                      Preview
                    </span>
                  </button>
                )}
                <button
                  onClick={() => copyCodeToClipboard(trimmedCode, codeId)}
                  className="glass-text-caption-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition-colors"
                >
                  {isCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <code className="glass-text-caption-1 block pt-3 font-mono">{children}</code>
          </pre>
        </div>
      );
    }
    
    // For multi-line code blocks with collapse/expand functionality, render with additional UI
    return (
      <div className="code-block-container my-3 group">
        {!isExpanded ? (
          <div className="code-preview bg-gray-50 dark:bg-gray-800/90 p-4 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="font-mono glass-text-caption-2 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {language !== "plaintext" ? language : "Code"} ({lineCount} lines)
              </div>
              <div className="flex gap-2">
                {onShowCodeInPreview && (
                  <button
                    onClick={() => onShowCodeInPreview(trimmedCode, language)}
                    className="glass-text-caption-2 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 px-2 py-0.5 rounded glass-weight-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </span>
                  </button>
                )}
                <button
                  onClick={() => copyCodeToClipboard(trimmedCode, codeId)}
                  className="glass-text-caption-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition-colors"
                >
                  {isCopied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => toggleCodeBlock(codeId)}
                  data-codeid={codeId}
                  className="glass-text-caption-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded glass-weight-medium transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Show Code
                  </span>
                </button>
              </div>
            </div>
            <div className="mt-2 font-mono glass-text-caption-1 overflow-hidden max-h-24 bg-gray-100 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700">
              <code className="truncate block">
                {trimmedCode.split("\n").slice(0, 3).join("\n")}
                {lineCount > 3 && <div className="text-gray-500 mt-1">...</div>}
              </code>
            </div>
          </div>
        ) : (
          <motion.div 
            className="expanded-code"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-t-md flex justify-between items-center border-t border-l border-r border-gray-200 dark:border-gray-700">
              <div className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                {language !== "plaintext" ? language : "Code"} ({lineCount} lines)
              </div>
              <div className="flex gap-2">
                {onShowCodeInPreview && (
                  <button
                    onClick={() => onShowCodeInPreview(trimmedCode, language)}
                    className="text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 px-2 py-0.5 rounded font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </span>
                  </button>
                )}
                <button
                  onClick={() => copyCodeToClipboard(trimmedCode, codeId)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition-colors"
                >
                  {isCopied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => toggleCodeBlock(codeId)}
                  data-codeid={codeId}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded font-medium transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Hide Code
                  </span>
                </button>
              </div>
            </div>
            <pre
              className={`bg-gray-50 dark:bg-gray-800/90 p-4 rounded-b-md overflow-x-auto border border-gray-200 dark:border-gray-700 shadow-sm ${className || ""}`}
            >
              <code className="text-sm block font-mono">{children}</code>
            </pre>
          </motion.div>
        )}
      </div>
    );
  }, [expandedCodeBlocks, copiedCodeBlockId, onShowCodeInPreview, messageId, toggleCodeBlock, copyCodeToClipboard]);

  return {
    // KaTeX output uses span.katex, div.katex-display
    // Add a small hover action to copy LaTeX for display math blocks by wrapping the element
    // Note: We rely on remark-math to parse and rehype-katex to render math. Here we only add UI sugar.
    div: ({ children, className, ...props }) => {
      if (typeof className === 'string' && className.includes('katex-display')) {
        // Extract raw TeX from children if available (rehype-katex puts annotation in mathml; safest is to copy surrounding text from preceding source)
        // As a conservative approach without parsing MathML, fall back to copying the textContent of the element which matches visual LaTeX.
        const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
          try {
            const parent = (e.currentTarget.parentElement?.parentElement) as HTMLElement | null;
            if (!parent) return;
            const texSource = parent.getAttribute('data-tex') || parent.textContent || '';
            if (texSource) {
              navigator.clipboard.writeText(texSource).catch(() => {});
            }
          } catch {}
        };
        return (
          <div className={`relative group ${className || ''}`} {...props}>
            <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy LaTeX"
                className="text-xs px-2 py-0.5 rounded bg-white/60 dark:bg-white/20 text-foreground border border-white/30 dark:border-white/10"
              >
                Copy LaTeX
              </button>
            </div>
            {children}
          </div>
        );
      }
      return <div className={className} {...props}>{children}</div>;
    },
    p: ({ children, ...props }) => <div className="my-2 leading-relaxed font-sans" {...props}>{children}</div>,
    ul: ({ children, ...props }) => <ul className="list-disc pl-6 my-3 space-y-1.5 font-sans" {...props}>{children}</ul>,
    ol: ({ children, ...props }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 font-sans" {...props}>{children}</ol>,
    li: ({ children, ...props }) => <li className="mb-1" {...props}>{children}</li>,
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-semibold tracking-tight my-4 pb-1 border-b border-gray-200/70 dark:border-gray-700/70 font-sans" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => <h2 className="text-xl font-semibold tracking-tight my-3.5 font-sans" {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 className="text-lg font-semibold tracking-tight my-3 font-sans" {...props}>{children}</h3>,
    strong: ({ children, ...props }) => <strong className="font-semibold" {...props}>{children}</strong>,
    em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
    hr: (props) => <hr className="my-4 border-gray-200/70 dark:border-gray-700/70" {...props} />,
    a: ({ children, ...props }) => (
      <a
        className="text-purple-600 dark:text-purple-400 hover:underline font-sans"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-4 border-purple-200 dark:border-purple-800 pl-4 py-1 my-4 italic bg-purple-50/30 dark:bg-purple-900/20 pr-4 rounded-sm font-sans" {...props}>
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4 rounded-md border border-gray-200/70 dark:border-gray-700/70 font-sans">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => <thead className="bg-gray-50/70 dark:bg-gray-800/50" {...props}>{children}</thead>,
    tbody: ({ children, ...props }) => (
      <tbody className="bg-white/50 dark:bg-gray-900/30 divide-y divide-gray-200/70 dark:divide-gray-700/70" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
    th: ({ children, ...props }) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => <td className="px-6 py-4 whitespace-nowrap text-sm" {...props}>{children}</td>,
    code: codeComponent as Components['code'],
  };
}