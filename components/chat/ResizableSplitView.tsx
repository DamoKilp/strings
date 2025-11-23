// /src/components/chat/ResizableSplitView.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/lib/codeUtils"; // Assuming this path is correct
import CodeTabs from "./CodeTabs"; // Assuming this path is correct
import CodeWindow from "./CodeWindow"; // Assuming this path is correct
import DocumentPreview from "./DocumentPreview";
import { cn } from "@/lib/utils"; // Import cn utility for class names

interface ResizableSplitViewProps {
  codeBlocks: CodeBlock[];
  showCodePanel: boolean;
  onCloseCodePanel: () => void;
  children: React.ReactNode; // Chat message bubbles go here
  className?: string; // Allow passing additional classes
  // New: document mode props
  documentMarkdown?: string;
  documentChartSpec?: any;
  documentMessageId?: string;
}

export function ResizableSplitView({
  codeBlocks,
  showCodePanel,
  onCloseCodePanel,
  children,
  className,
  documentMarkdown,
  documentChartSpec,
  documentMessageId,
}: ResizableSplitViewProps) {
  // Default: 50% width for the code panel when shown
  const [panelSize, setPanelSize] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [panelMode, setPanelMode] = useState<"document" | "code">("document");

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null); // Ref for chat panel scrolling
  const startXRef = useRef(0);
  const startPctRef = useRef(0);
  const isMountedRef = useRef(true);

  // Determine if the panel should actually be visible
  const shouldShowPanel = showCodePanel && (panelMode === "code" ? codeBlocks.length > 0 : true);

  // --- Effects ---

  // Track component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep activeTab valid when codeBlocks change
  // Validate and correct activeTab index to ensure UI consistency
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (codeBlocks.length > 0 && (activeTab < 0 || activeTab >= codeBlocks.length)) {
      setActiveTab(0);
    } else if (codeBlocks.length === 0) {
      // Optionally reset if blocks are cleared while panel is technically open
      setActiveTab(0);
    }
  }, [codeBlocks, activeTab]);

  // Auto-adjust panel size on smaller screens if it's too large
  // Note: Consider if 768px is the right breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && panelSize > 60) { // Adjust breakpoint/percentage if needed
        // Only shrink if it's currently wide on a small screen
         if (isMountedRef.current) {
           setPanelSize(60); // Example: set a max % for mobile
         }
      }
    };
    window.addEventListener("resize", handleResize);
    // Initial check
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [panelSize]); // Re-run if panelSize changes

  // Disable text selection globally while resizing
  useEffect(() => {
    document.body.style.userSelect = isResizing ? "none" : "";
    // Add/remove a class for potential global styling during resize
    document.body.classList.toggle('is-resizing-split-view', isResizing);
    return () => {
      document.body.style.userSelect = "";
      document.body.classList.remove('is-resizing-split-view');
    };
  }, [isResizing]);


  // --- Resizing Logic ---

  const startResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Prevent default drag behavior or text selection
      e.preventDefault();
      e.stopPropagation();

      if (!containerRef.current) return;

      // Determine initial clientX from mouse or touch event
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      startXRef.current = clientX;
      startPctRef.current = panelSize; // Store the percentage at resize start
      setIsResizing(true);

      // Get the container width *at the start* of the drag
      const containerWidth = containerRef.current.offsetWidth;
      if (containerWidth === 0) return; // Avoid division by zero

      // Store initial scroll positions
      const initialChatScroll = chatPanelRef.current?.scrollTop ?? 0;
      const initialCodeScroll = codePanelRef.current?.scrollTop ?? 0;


      const handleMouseMove = (event: MouseEvent | TouchEvent) => {
        if (!isMountedRef.current) return;

        // Get current clientX
        const currentClientX = "touches" in event ? event.touches[0].clientX : event.clientX;
        const deltaX = currentClientX - startXRef.current;

        // Calculate the change in percentage based on deltaX and container width
        // Dragging left decreases startXRef -> deltaX is negative -> increases panelSize
        // Dragging right increases startXRef -> deltaX is positive -> decreases panelSize
        const deltaPct = (deltaX / containerWidth) * 100;
        let nextPct = startPctRef.current - deltaPct; // Invert delta because panel is on the right

        // Clamp the percentage between min and max values (e.g., 20% to 80%)
        const minPct = 20;
        const maxPct = 80;
        nextPct = Math.max(minPct, Math.min(maxPct, nextPct));

        setPanelSize(nextPct);

         // Restore scroll positions during drag to prevent jumps
         if (chatPanelRef.current) chatPanelRef.current.scrollTop = initialChatScroll;
         if (codePanelRef.current) codePanelRef.current.scrollTop = initialCodeScroll;
      };

      const handleMouseUp = () => {
        if (!isMountedRef.current) return;
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove as EventListener);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleMouseMove as EventListener);
        document.removeEventListener("touchend", handleMouseUp);
      };

      // Add listeners to the document to capture movement anywhere on the screen
      document.addEventListener("mousemove", handleMouseMove as EventListener);
      document.addEventListener("mouseup", handleMouseUp);
      // Add touch listeners
      document.addEventListener("touchmove", handleMouseMove as EventListener);
      document.addEventListener("touchend", handleMouseUp);
    },
    [panelSize] // Dependency: panelSize is used in startPctRef
  );

  // --- Memoized Values ---

  // Force-remount key for the CodeWindow editor when content/tab changes
  const codeWindowKey = useMemo(() => {
    if (!shouldShowPanel || panelMode !== "code" || !codeBlocks[activeTab]) return "empty";
    const block = codeBlocks[activeTab];
    // Use more stable properties if possible, length can be misleading if only whitespace changes
    return `${block.language}-${block.filename || `file-${activeTab}`}-${activeTab}`;
  }, [shouldShowPanel, panelMode, codeBlocks, activeTab]);

  // Get the current code block safely
  const currentCodeBlock = useMemo(() => {
    return (
      codeBlocks[activeTab] || {
        filename: "/placeholder.txt",
        language: "plaintext",
        code: "// No code selected or available.",
        isValid: false, // Indicate it's placeholder
        contentType: "text/plain",
      }
    );
  }, [codeBlocks, activeTab]);

  // --- Event Handlers ---

  const handleClose = useCallback(() => {
    onCloseCodePanel();
    // Optionally reset panel size when closed, or leave it as is for next open
    // setPanelSize(50);
  }, [onCloseCodePanel]);

  // --- Render ---

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col lg:flex-row h-full w-full overflow-hidden", // Stack vertically on mobile, horizontal on desktop
        isResizing ? "cursor-col-resize" : "", // Optional: change cursor for the whole area during resize
        className // Allow parent to pass additional classes
      )}
    >
      {/* Chat Pane */}
      <div
          className={cn(
              "flex flex-col h-full",
              shouldShowPanel ? "flex-shrink-0" : "flex-1",
              // On mobile, always full width when panel is shown (stacked layout)
              shouldShowPanel ? "w-full lg:w-auto" : "w-full",
              // only animate width when no drag in progress and on desktop
              !isResizing && "transition-[width] duration-300 ease-in-out"
          )}
        style={{
          width: shouldShowPanel 
            ? (typeof window !== 'undefined' && window.innerWidth >= 1024 
                ? `${100 - panelSize}%` 
                : '100%')
            : "100%",
          // Define minWidth to prevent collapsing too much during resize (desktop only)
          minWidth: shouldShowPanel && typeof window !== 'undefined' && window.innerWidth >= 1024 
            ? "200px" 
            : "100%",
        }}
      >
        {/* Message area: let the child own scrolling to avoid nested scroll containers */}
        <div ref={chatPanelRef} className="flex-1 overflow-hidden relative p-0">
          {children}
        </div>
        {/* Input area would typically go below the scrollable container */}
        {/* e.g., <ChatInputComponent /> */}
      </div>

      {/* Resize Handle and Code Panel (Conditional Rendering) */}
      <AnimatePresence>
        {shouldShowPanel && (
          <>
            {/* Resize Handle - Hidden on mobile */}
            <div
              className="hidden lg:block flex-shrink-0 w-1.5 h-full cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors duration-150 z-10"
              onMouseDown={startResize}
              onTouchStart={startResize}
              title="Resize panels" // Accessibility
            />

            {/* Code Panel */}
            {/* Note: Using motion.div from framer-motion could create smoother animations */}
            <div
              ref={codePanelRef}
              className={cn(
                "flex flex-col h-full flex-shrink-0 bg-background dark:bg-neutral-900",
                "border-t lg:border-t-0 lg:border-l border-border dark:border-neutral-800",
                !isResizing && "transition-[width] duration-300 ease-in-out" // Ensure width transition is applied
              )}
              style={{
                width: typeof window !== 'undefined' && window.innerWidth >= 1024 
                  ? `${panelSize}%` 
                  : '100%',
                height: typeof window !== 'undefined' && window.innerWidth < 1024 
                  ? '50%' 
                  : '100%',
                // Define maxWidth to prevent panel taking too much space (desktop only)
                maxWidth: typeof window !== 'undefined' && window.innerWidth >= 1024 
                  ? "80%" 
                  : "100%",
              }}
            >
              {/* Code Panel Header */}
              <div className="sticky top-0 z-20 flex items-center justify-between flex-shrink-0 px-4 py-2 bg-background/80 dark:bg-neutral-900/80 backdrop-blur-sm border-b border-border dark:border-neutral-800">
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {panelMode === "document" ? "Document Preview" : `Code Viewer (${codeBlocks.length} ${codeBlocks.length === 1 ? "file" : "files"})`}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={panelMode === "document" ? "secondary" : "outline"}
                      size="xs"
                      onClick={() => setPanelMode("document")}
                    >
                      Doc
                    </Button>
                    <Button
                      variant={panelMode === "code" ? "secondary" : "outline"}
                      size="xs"
                      onClick={() => setPanelMode("code")}
                    >
                      Code
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7" // Make button slightly smaller
                  aria-label="Close code panel"
                  onClick={handleClose}
                  title="Close Code Panel (Esc)" // Tooltip hint
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Code Tabs (if more than one file) */}
              {panelMode === "code" && codeBlocks.length > 1 && (
                <div className="flex-shrink-0 border-b border-border dark:border-neutral-800">
                   <CodeTabs
                     codeBlocks={codeBlocks}
                     activeTab={activeTab}
                     onTabChange={setActiveTab}
                   />
                </div>
              )}

              {/* Panel Body */}
              <div className="relative flex-1 w-full h-full overflow-hidden">
                {panelMode === "document" ? (
                  <div className="absolute inset-0 p-3 overflow-auto">
                    <DocumentPreview
                      markdown={typeof documentMarkdown === "string" ? documentMarkdown : ""}
                      chartSpec={documentChartSpec}
                      messageId={documentMessageId || "doc"}
                      className="h-full"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    <CodeWindow
                      key={codeWindowKey}
                      code={currentCodeBlock.code}
                      language={currentCodeBlock.language}
                      contentType={currentCodeBlock.contentType}
                      containerClass="absolute inset-0 w-full h-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper (if not already globally available)
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AnimatePresence } from "framer-motion"; // Import AnimatePresence

// Make sure cn utility is available
// export function cn(...inputs: ClassValue[]) {
//   return twMerge(clsx(inputs));
// }