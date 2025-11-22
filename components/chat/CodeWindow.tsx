// /components/chat/CodeWindow.tsx
"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";
import { FaCheck } from "react-icons/fa";
import { Copy } from "lucide-react";

/**
 * Returns a short label to display in the editor UI.
 */
function getLanguageLabel(lang: string): string {
  // Simplified mapping for brevity
  const labelMap: Record<string, string> = {
    typescriptreact: "TSX",
    javascriptreact: "JSX",
    typescript: "TS",
    javascript: "JS",
    python: "PY",
    cpp: "C++",
    csharp: "C#",
    java: "JAVA",
    shell: "SH",
    bash: "SH",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    markdown: "MD",
    sql: "SQL",
    xml: "XML",
    yaml: "YAML",
    ruby: "RB",
    php: "PHP",
    c: "C",
    go: "GO",
    swift: "SWIFT",
    kotlin: "KT",
    rust: "RS",
    scala: "SCALA",
    plaintext: "TXT",
  };
  // Ensure lang is lowercase before lookup and provide fallback
  const lowerLang = lang?.toLowerCase() || 'plaintext';
  return labelMap[lowerLang] || lang?.toUpperCase().substring(0, 3) || "TXT";
}

/**
 * Converts a user-supplied language string into something valid for Monaco.
 */
function fallbackLanguage(lang?: string): string {
  if (!lang || typeof lang !== 'string') return "plaintext";
  const normalized = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    tsx: 'typescript',
    jsx: 'javascript',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    rb: 'ruby',
    md: 'markdown',
    "c#": 'csharp',
    "c++": 'cpp',
  };
  const mappedLang = map[normalized] || normalized;

  const supported = [
    "typescript",
    "javascript",
    "python",
    "java",
    "csharp",
    "cpp",
    "c",
    "html",
    "css",
    "json",
    "markdown",
    "sql",
    "shell",
    "yaml",
    "xml",
    "php",
    "ruby",
    "go",
    "swift",
    "kotlin",
    "rust",
    "scala",
    "plaintext",
  ];
  return supported.includes(mappedLang) ? mappedLang : "plaintext";
}

interface CodeWindowProps {
  code: string;
  language: string;
  containerClass?: string;
  contentType?: string;
}

/**
 * CodeWindow presents a read-only Monaco editor with theme & copy functionality.
 */
const CodeWindow: React.FC<CodeWindowProps> = ({
  code,
  language,
  containerClass = "",
  contentType,
}) => {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monacoEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [modelUpdateKey] = useState<number>(0);
  const lastCodeRef = useRef<string>(code);

  // Memoize language processing
  const validLanguage = useMemo(() => fallbackLanguage(language), [language]);
  const langLabel = useMemo(() => getLanguageLabel(validLanguage), [validLanguage]);

  // Define Claude-inspired theme
  const defineClaudeTheme = (monaco: typeof monacoEditor) => {
    monaco.editor.defineTheme("claude-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a9955" },
        { token: "keyword", foreground: "c586c0" },
        { token: "string", foreground: "ce9178" },
        { token: "number", foreground: "b5cea8" },
        { token: "operator", foreground: "d4d4d4" },
        { token: "identifier", foreground: "9cdcfe" },
        { token: "type.identifier", foreground: "4ec9b0" },
        { token: "function", foreground: "dcdcaa" },
        { token: "tag", foreground: "569cd6" },
        { token: "attribute.name", foreground: "9cdcfe" },
        { token: "attribute.value", foreground: "ce9178" },
        { token: "namespace", foreground: "4ec9b0" },
        { token: "regexp", foreground: "d16969" },
        { token: "invalid", foreground: "f44747" },
      ],
      colors: {
        "editor.background": "#1e293b",
        "editor.foreground": "#e2e8f0",
        "editorCursor.foreground": "#a7b2c0",
        "editor.lineHighlightBackground": "#28364a",
        "editorLineNumber.foreground": "#64748b",
        "editor.selectionBackground": "#3b4d66",
        "editor.inactiveSelectionBackground": "#2f3d51",
        "editorIndentGuide.background": "#334155",
        "editorIndentGuide.activeBackground": "#475569",
        "editorWhitespace.foreground": "#334155",
        "editorHoverWidget.background": "#28364a",
        "editorHoverWidget.border": "#475569",
        "editorSuggestWidget.background": "#28364a",
        "editorSuggestWidget.border": "#475569",
        "editorSuggestWidget.selectedBackground": "#3b4d66",
      },
    });
  };

  // JSON Validation - validate JSON syntax and update error state
  // This effect is necessary to provide real-time validation feedback
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (contentType === "application/json" || validLanguage === "json") {
      try {
        JSON.parse(code);
        setJsonError(null);
      } catch (error: unknown) {
        setJsonError(
          `Invalid JSON: ${
            error instanceof Error ? error.message : "Syntax error"
          }`
        );
      }
    } else {
      setJsonError(null);
    }
  }, [code, contentType, validLanguage]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update the editor mount handler with better cleanup logic
  const handleEditorMount: OnMount = (editor, monaco) => {

    editorRef.current = editor;
    monacoRef.current = monaco;

    // Create and apply theme
    defineClaudeTheme(monaco);
    monaco.editor.setTheme("claude-dark");

    // Configure editor options...
    editor.updateOptions({
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: {
        enabled: true,
        scale: 1,
        renderCharacters: false,
        side: "right",
      },
      lineNumbers: "on",
      renderLineHighlight: "all", // Highlight full line
      fontFamily:
        "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      fontWeight: "normal",
      lineHeight: 18,
      letterSpacing: 0.5,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "off",
      readOnly: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        alwaysConsumeMouseWheel: false,
        vertical: "visible",
        horizontal: "visible",
      },
      renderWhitespace: "none",
      colorDecorators: true,
      find: {
        addExtraSpaceOnTop: true,
        autoFindInSelection: "never",
        seedSearchStringFromSelection: "never",
      },
    });

    // Create initial model with a try-catch
    try {
      const model = monaco.editor.createModel(code, validLanguage);
      editor.setModel(model);
      lastCodeRef.current = code;
  } catch {

    }

    // Mark editor as ready
    setEditorReady(true);


    // Force layout after a short delay
    setTimeout(() => {
      if (editorRef.current) editorRef.current.layout();
    }, 100);
  };

  // Add proper cleanup to the component
  useEffect(() => {
    // Component cleanup function
    return () => {
      // Safely dispose the model when component unmounts
      try {
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            // Detach model from editor first
            editorRef.current.setModel(null);
            // Then dispose it
            model.dispose();
          }
          // Don't dispose the editor itself - Monaco-React does this
        }
  } catch {

      }
      setEditorReady(false);
    };
  }, []);

  // Safer model update logic
  useEffect(() => {
    if (!editorRef.current || !editorReady || !monacoRef.current) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    try {
      // Get current model
  const currentModel = editor.getModel();

      // If model is being disposed or editor is unmounting, don't proceed
      {
        const ed = editor as unknown as { getDisposed?: () => boolean };
        const disposed = typeof ed.getDisposed === 'function' ? ed.getDisposed() : false;
        if (!currentModel || disposed) {
          return;
        }
      }

      // If code hasn't changed, don't update
      if (
        lastCodeRef.current === code &&
        currentModel.getLanguageId() === validLanguage
      ) {
        return;
      }

      // Update our reference to latest code
      lastCodeRef.current = code;

      // Use a more robust approach for changing models
      if (currentModel.getLanguageId() !== validLanguage) {
        // Safely dispose the old model
        const oldModel = currentModel;

        // Create the new model first
        const newModel = monaco.editor.createModel(code, validLanguage);

        // Then set it on the editor
        editor.setModel(newModel);

        // And finally dispose the old one
        setTimeout(() => {
          try {
            oldModel.dispose();
          } catch {

          }
        }, 0);


      } else {
        // Update existing model more safely
        editor.executeEdits("content-update", [
          {
            range: currentModel.getFullModelRange(),
            text: code,
            forceMoveMarkers: true,
          },
        ]);

      }

      // Reset scroll position and force layout update
      editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
      editor.layout();
  } catch {

    }
  }, [code, validLanguage, editorReady]);

  // Force layout updates periodically after mount to ensure sizing is correct
  useEffect(() => {
    if (!editorRef.current || !editorReady) return;

    // Schedule multiple layout updates to account for any CSS transitions,
    // display changes, etc.
    const layoutTimers = [
      setTimeout(() => editorRef.current?.layout(), 100),
      setTimeout(() => editorRef.current?.layout(), 300),
      setTimeout(() => editorRef.current?.layout(), 500),
      setTimeout(() => editorRef.current?.layout(), 1000),
    ];

    return () => {
      layoutTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [editorReady, modelUpdateKey]);

  const handleCopy = () => {
    const codeToCopy = editorRef.current?.getValue() || code;
    if (!codeToCopy) return;

    navigator.clipboard
      .writeText(codeToCopy)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
  .catch(() => {

      });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[350px] bg-background text-foreground overflow-hidden ${containerClass}`}
      key={`container-${modelUpdateKey}`}
    >
      {/* Loading indicator that shows until editor is ready */}
      {!editorReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
          <div className="text-muted-foreground text-sm">Loading editor...</div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute top-1 right-1 z-30 flex items-center space-x-1 p-1 bg-background/60 rounded backdrop-blur-sm">
        {/* Language Label */}
        <div className="px-2 py-0.5 bg-background/70 text-muted-foreground rounded text-xs border border-border">
          {langLabel}
        </div>
        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 bg-background/70 rounded text-xs flex items-center gap-1 hover:bg-background/80 text-muted-foreground border border-border transition-colors duration-150"
          aria-label="Copy Code"
        >
          {copySuccess ? (
            <FaCheck className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* JSON Error Indicator */}
      {jsonError && (
        <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-destructive/90 text-primary-foreground text-xs rounded z-30 shadow-md border border-destructive">
          {jsonError}
        </div>
      )}

      {/* Editor Component */}
      <div className="absolute inset-0 w-full h-full min-h-[350px]">
        <Editor
          height="100%"
          width="100%"
          language={validLanguage}
          value={code}
          theme="claude-dark"
          
          options={{
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: true,
              scale: 0.8,
              renderCharacters: false,
              side: "right",
              
             },
             fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, 'Courier New', monospace",
            fontSize: 11,
          }}
          onMount={handleEditorMount}
          loading={null} // We're using our own loading indicator
          className="monaco-editor-container"
        />
      </div>
    </div>
  );
};

export default React.memo(CodeWindow);