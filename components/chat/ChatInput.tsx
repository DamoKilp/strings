// /components/chat/ChatInput.tsx
'use client';

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  ChangeEvent,
  SetStateAction,
  useMemo,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Paperclip,
  Globe,
  Eye,
  ImagePlus,
  Sparkles,
  SlidersVertical,
  Database,
  Table, // NEW: Table icon for table search
  Cog, // NEW: Settings cog for table search settings
  UserCog,
} from 'lucide-react';
import { useInputHeight } from '@/hooks/useInputHeight';
import { DragHandle } from '@/components/chat/DragHandle';
import { LLMModel } from '@/lib/models';
import { SendIcon } from './IconComponents';
import { ModelIcon } from '@/components/icons/ModelIcon';
import useWindowHeight from '@/hooks/useWindowHeight';
import { isFileInArray } from '@/lib/utils';
import { ModelSettingsPopup } from './ModelSettingsPopup';
import { AgentSelector } from './AgentSelector';
import { PrePrompt } from '@/components/data/prePrompts';
import { ImagePreview } from '@/components/chat/ImagePreview';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { IngestionDialog } from '@/components/ingestion/IngestionDialog';
import { BookOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
import { TableSearchSettingsModal } from '@/components/ui/table-search-settings-modal';
// (removed unused SettingsIcon)

const DEFAULT_TEXTAREA_HEIGHT = 60;
const MIN_TEXTAREA_HEIGHT = 60;
const CONTROLS_ROW_HEIGHT_ESTIMATE = 37;
const MAX_HEIGHT_PERCENTAGE = 0.75;
const PROVIDERS_WITH_CAP_ICONS = ['openai', 'anthropic', 'google'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB size cap per image

export interface ChatInputProps {
  onSubmit: (inputText: string, files: File[]) => void;
  isProcessing: boolean;
  error: Error | null;
  selectedModel: LLMModel;
  availableModels: LLMModel[];
  handleModelSelect: (modelId: string) => void;
  handleStopGenerating: () => void;
  selectedPrePromptId?: string;
  handlePrePromptSelect?: (promptId: string) => void;
  prePrompts: PrePrompt[];
  onFilesUpdate?: (files: File[]) => void;
  initialFiles?: File[];
  // Optional Drive Mode controls (shown only if provided)
  driveModeActive?: boolean;
  onDriveModeToggle?: () => void;
}

// Lazy component for Drive Mode settings (toggle UI not used here)
const DriveModeSettingsModal = dynamic(() => import('@/components/chat/voice/DriveModeSettingsModal').then(m => m.DriveModeSettingsModal), { ssr: false });

export function ChatInput({
  onSubmit,
  isProcessing,
  error,
  selectedModel,
  availableModels,
  handleModelSelect,
  handleStopGenerating,
  prePrompts,
  selectedPrePromptId = prePrompts?.[0]?.id,
  handlePrePromptSelect = () => {},
  onFilesUpdate,
  initialFiles = [],
  driveModeActive,
  onDriveModeToggle,
}: ChatInputProps) {
  // --- Get state and actions from context ---
  const { vectorSearchEnabled, tableSearchEnabled, webSearchEnabled, tableSearchSettings, chatFontSize, actions } = useChatContext();
  const { toggleVectorSearch, toggleTableSearch, toggleWebSearch, setTableSearchSettings, setChatFontSize } = actions;
  // -----------------------------------------

  // NEW: IngestionDialog modal state
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  // NEW: track the "minimized" state of the dialog
  const [isIngestionMinimized, setIsIngestionMinimized] = useState(false);
  // Model Settings Dialog state
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);

  // Refs
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // State for drag events
  const [dragActive, setDragActive] = useState(false);
  const dragCounterRef = useRef<number>(0);

  // Internal input & file state
  const [internalInput, setInternalInput] = useState('');
  const [internalFiles, setInternalFiles] = useState<File[]>(initialFiles);

  const pageHeight = useWindowHeight();
  const isMultiModal = useMemo(() => selectedModel?.multiModal ?? false, [selectedModel]);

  const maxContainerHeight = useMemo(() => {
    const availableHeight = pageHeight ?? window.innerHeight;
    const calculatedMax = availableHeight * MAX_HEIGHT_PERCENTAGE - CONTROLS_ROW_HEIGHT_ESTIMATE;
    return Math.max(calculatedMax, MIN_TEXTAREA_HEIGHT + 50);
  }, [pageHeight]);

  const heightManager = useInputHeight({
    defaultHeight: DEFAULT_TEXTAREA_HEIGHT,
    minHeight: MIN_TEXTAREA_HEIGHT,
    maxHeight: maxContainerHeight,
  });
  const {
    containerRef,
    textareaRef,
    currentHeight,
    resetHeight,
    updateHeight: debouncedUpdateHeight,
    initResizable,
    isDragging,
  } = heightManager;

  useEffect(() => {
    if (!dragHandleRef.current) return;
    const cleanup = initResizable(dragHandleRef);
    return cleanup;
  }, [initResizable]);

  const handleLocalInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setInternalInput(e.target.value);
      debouncedUpdateHeight();
    },
    [debouncedUpdateHeight]
  );

  const handleLocalFileChange = useCallback(
    (change: SetStateAction<File[]>) => {
      setInternalFiles(currentFiles => {
        const newFiles = typeof change === 'function' ? change(currentFiles) : change;
        if (onFilesUpdate) {
          onFilesUpdate(newFiles);
        }
        return newFiles;
      });
    },
    [onFilesUpdate]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<Element>) => {
      // Allow default text paste into the textarea; just capture images alongside
      const dt = e.clipboardData;

      // 1) Items API (most browsers when copying screenshots)
      const itemFiles: File[] = [];
      try {
        const items = Array.from(dt?.items || []);
        for (const item of items) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const f = item.getAsFile();
            if (f) itemFiles.push(f);
          }
        }
      } catch {}

      // 2) Files list fallback (Safari and some cases)
      const listFiles: File[] = [];
      try {
        const files = Array.from(dt?.files || []);
        for (const f of files) {
          if (f.type.startsWith('image/')) listFiles.push(f);
        }
      } catch {}

      const immediateFiles = [...itemFiles, ...listFiles].filter(f => f.size <= MAX_IMAGE_BYTES);
      // De-duplicate within this paste batch (items and files can both carry the same image)
      const seen = new Set<string>();
      const uniqueImmediate = immediateFiles.filter(f => {
        const sig = `${f.name}-${f.size}-${f.type}-${f.lastModified}`;
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
      if (uniqueImmediate.length) {
        handleLocalFileChange(prev => {
          const toAdd = uniqueImmediate.filter(f => !isFileInArray(f, prev));
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
      }

      // 3) Parse HTML clipboard for data URI images only if no direct files were detected
      try {
        if (immediateFiles.length === 0) {
          const html = dt?.getData?.('text/html') || '';
          if (html && html.includes('<img')) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const nodes = Array.from(doc.querySelectorAll('img'));
            const dataSrcs = nodes
              .map(n => n.getAttribute('src'))
              .filter((src): src is string => !!src && src.startsWith('data:image/'));

            if (dataSrcs.length) {
              Promise.all(
                dataSrcs.map(async (src, idx) => {
                  try {
                    const res = await fetch(src);
                    const blob = await res.blob();
                    const ext = (blob.type && blob.type.split('/')[1]) || 'png';
                    const name = `pasted-image-${Date.now()}-${idx}.${ext}`;
                    return new File([blob], name, { type: blob.type || 'image/png' });
                  } catch {
                    return null;
                  }
                })
              ).then(newFilesMaybe => {
                const newFiles = (newFilesMaybe.filter(Boolean) as File[]) || [];
                if (newFiles.length) {
                  handleLocalFileChange(prev => {
                    const toAdd = newFiles.filter(f => !isFileInArray(f, prev));
                    return toAdd.length ? [...prev, ...toAdd] : prev;
                  });
                }
                setTimeout(() => { debouncedUpdateHeight(); }, 50);
              });
            }
          }
        }
      } catch {}

      // Let the textarea resize shortly after paste
      setTimeout(() => { debouncedUpdateHeight(); }, 50);
    },
    [handleLocalFileChange, debouncedUpdateHeight]
  );

  const doSubmit = useCallback(() => {
    const trimmedInput = internalInput.trim();
    if (!isProcessing && (trimmedInput.length > 0 || internalFiles.length > 0)) {
      onSubmit(trimmedInput, internalFiles);
      setInternalInput('');
      setInternalFiles([]);
      resetHeight();
    }
  }, [isProcessing, internalInput, internalFiles, onSubmit, resetHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        doSubmit();
      }
    },
    [doSubmit]
  );

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleLocalFileChange(prev => {
        const newFiles = Array.from(e.target.files || []);
        const uniqueFiles = newFiles.filter(f => f.type.startsWith('image/') && f.size <= MAX_IMAGE_BYTES && !isFileInArray(f, prev));
        return [...prev, ...uniqueFiles];
      });
    }
    e.target.value = '';
  }, [handleLocalFileChange]);

  const handleFileRemove = useCallback((fileToRemove: File) => {
    handleLocalFileChange(prev => prev.filter(f => f !== fileToRemove));
  }, [handleLocalFileChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setDragActive(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounterRef.current = 0;
    if (!isMultiModal) return;
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );
    if (droppedFiles.length > 0) {
      handleLocalFileChange(prev => {
        const uniqueFiles = droppedFiles.filter(f => !isFileInArray(f, prev));
        return [...prev, ...uniqueFiles];
      });
    }
  }, [isMultiModal, handleLocalFileChange]);

  // Keep attachments even if model is not multimodal; we'll warn and disable send-only-images
  // (Previously, files were auto-cleared here which confused users.)

  const filePreview = useMemo(() => {
    if (!internalFiles.length) return null;
    return (
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent pr-2">
        {internalFiles.map((file, idx) => (
          <ImagePreview
            key={`${file.name}-${file.size}-${file.lastModified}-${idx}`}
            file={file}
            onRemove={handleFileRemove}
          />
        ))}
      </div>
    );
  }, [internalFiles, handleFileRemove]);

  const hasBlockedAttachments = useMemo(() => !isMultiModal && internalFiles.length > 0, [isMultiModal, internalFiles.length]);

  const modelSelector = useMemo(() => {
    const displayModelName = selectedModel?.name ?? 'Select Model';
    const displayModelValue = selectedModel?.id;
    return (
      <Select value={displayModelValue} onValueChange={handleModelSelect}>
        <SelectTrigger className="chat-control-btn model-selector-enhanced w-[140px] lg:w-[130px] md:w-[110px] sm:w-[100px] h-7 text-[10px] text-slate-200 dark:text-slate-200 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-700 data-[placeholder]:text-slate-400">
          <SelectValue placeholder="Select model...">
            <div className="flex items-center gap-1 overflow-hidden">
              <ModelIcon providerId={selectedModel?.providerId || 'openai'} size={12} />
              <span className="truncate">{displayModelName}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="!bg-slate-900 !text-slate-200 border border-slate-700">
          {availableModels.map(model => {
            const showCapIcons = PROVIDERS_WITH_CAP_ICONS.includes(model.providerId);
            return (
              <SelectItem key={model.id} value={model.id} className="text-slate-200 focus:bg-slate-800 focus:text-slate-100">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 flex-grow min-w-0 mr-2">
                    <ModelIcon providerId={model.providerId} size={16} />
                    <span className="truncate" title={model.name}>{model.name}</span>
                  </div>
                  {showCapIcons && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {model.canSearch && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Globe className="h-3 w-3 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none"><p>Web Search</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {model.multiModal && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Eye className="h-3 w-3 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none"><p>Image Input</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {model.canGenerateImages && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ImagePlus className="h-3 w-3 text-purple-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none"><p>Image Generation</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {model.isAdvancedReasoner && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Sparkles className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none"><p>Advanced Reasoning</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }, [availableModels, selectedModel, handleModelSelect]);

  const vectorSearchToggle = useMemo(() => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={toggleVectorSearch} 
            className={`chat-control-btn vector-btn-enhanced h-7 w-7 p-0 rounded-lg transition-all duration-300 ${
              vectorSearchEnabled 
                ? 'vector-btn-active text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border-green-200 dark:border-green-800/60 bg-green-50/60 hover:bg-green-100/70 dark:bg-green-900/20 dark:hover:bg-green-900/30 shadow-[0_0_15px_rgba(34,197,94,0.25)]' 
                : 'hover:bg-emerald-50/70 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
            }`}
            title="Toggle Vector Search"
          >
            <Database className="h-3 w-3" /> 
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={12}>
          <p>{vectorSearchEnabled ? 'Disable' : 'Enable'} Vector Search</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ), [vectorSearchEnabled, toggleVectorSearch]);

  const tableSearchToggle = useMemo(() => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={() => {
              console.log('[ChatInput-Button] Clicked, current state:', tableSearchEnabled);
              toggleTableSearch();
            }}
            className={`chat-control-btn table-btn-enhanced h-7 w-7 p-0 rounded-lg transition-all duration-300 ${
              tableSearchEnabled 
                ? 'table-btn-active text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border-blue-200 dark:border-blue-800/60 bg-blue-50/60 hover:bg-blue-100/70 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 shadow-[0_0_15px_rgba(59,130,246,0.25)]' 
                : 'hover:bg-blue-50/70 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
            }`}
            title="Toggle Table Search"
          >
            <Table className="h-3 w-3" /> 
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={12}>
          <p>{tableSearchEnabled ? 'Disable' : 'Enable'} Table Search</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ), [tableSearchEnabled, toggleTableSearch]);

  const tableSearchSettingsButton = useMemo(() => (
    <TableSearchSettingsModal
      currentSettings={tableSearchSettings}
      onSettingsChange={setTableSearchSettings}
    >
      <Button 
        type="button"
        variant="outline" 
        size="sm" 
        className={`chat-control-btn table-settings-btn-enhanced h-7 w-7 p-0 transition-all duration-300 ${
          tableSearchEnabled 
            ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border-blue-200 dark:border-blue-800/60 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30' 
            : 'text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300 opacity-50'
        }`}
        disabled={!tableSearchEnabled}
        title="Table Search Settings"
      >
        <Cog className="h-3 w-3" />
      </Button>
    </TableSearchSettingsModal>
  ), [tableSearchEnabled, tableSearchSettings, setTableSearchSettings]);

  // Determine if Drive Mode should be shown
  const showDriveMode = !!onDriveModeToggle;

  const onFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doSubmit();
    },
    [doSubmit]
  );

  const controlsRow = useMemo(
    () => (
      <div className="chat-toolbar-modern">
        <div className="chat-toolbar-container">
          {/* Primary Actions Group */}
          <div className="toolbar-section primary-section items-center">
            {/* Model Selector - Redesigned */}
            <div className="toolbar-item model-selector-item mr-2">
              {modelSelector}
            </div>

            {/* Agent Selector - moved next to Model */}
            <div className="toolbar-item mr-2">
              <AgentSelector
                prePrompts={prePrompts}
                selectedPromptId={selectedPrePromptId}
                onPromptSelect={handlePrePromptSelect}
                onOpenManager={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-agent-manager'));
                  }
                }}
              />
            </div>
            {/* Manage Agents Shortcut */}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="toolbar-btn text-fuchsia-400/80 dark:text-fuchsia-400/80"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('open-agent-manager'));
                      }
                    }}
                    aria-label="Manage agents"
                  >
                    <UserCog className="toolbar-icon" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                  <span>Manage agents…</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Divider */}
            <div className="toolbar-divider" />

            {/* Core Tools */}
            <div className="toolbar-group gap-2 items-center">
              {/* Vector Search */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleVectorSearch}
                      className={`toolbar-btn text-emerald-400/80 dark:text-emerald-400/80 ${
                        vectorSearchEnabled 
                          ? 'toolbar-btn-active toolbar-btn-vector-active text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border border-green-800/60 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.35)] drop-shadow-[0_0_10px_rgba(34,197,94,0.25)]' 
                          : ''
                      }`}
                      aria-label="Toggle Vector Search"
                    >
                      <Database className="toolbar-icon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                    <span>{vectorSearchEnabled ? 'Disable' : 'Enable'} Vector Search</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Table Search with Settings */}
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          console.log('[ChatInput-Toolbar] Clicked, current state:', tableSearchEnabled);
                          toggleTableSearch();
                        }}
                        className={`toolbar-btn text-blue-400/80 dark:text-blue-400/80 ${
                        tableSearchEnabled 
                          ? 'toolbar-btn-active toolbar-btn-table-active text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border border-green-800/60 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.35)] drop-shadow-[0_0_10px_rgba(34,197,94,0.25)]' 
                          : ''
                      }`}
                        aria-label="Toggle Table Search"
                      >
                        <Table className="toolbar-icon" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                      <span>{tableSearchEnabled ? 'Disable' : 'Enable'} Table Search</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Table Search Settings */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableSearchSettingsModal
                        currentSettings={tableSearchSettings}
                        onSettingsChange={setTableSearchSettings}
                      >
                        <button
                          type="button"
                          className={`toolbar-btn toolbar-btn-settings text-blue-300/80 dark:text-blue-300/80 ${
                            tableSearchEnabled 
                              ? '' 
                              : 'opacity-50 pointer-events-none'
                          }`}
                          disabled={!tableSearchEnabled}
                          aria-label="Table Search Settings"
                        >
                          <Cog className="toolbar-icon" />
                        </button>
                      </TableSearchSettingsModal>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                      <span>Table Search Settings</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Web Search Toggle */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleWebSearch}
                      className={`toolbar-btn text-purple-400/80 dark:text-purple-400/80 ${
                        webSearchEnabled 
                          ? 'toolbar-btn-active toolbar-btn-web-active text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border border-green-800/60 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.35)] drop-shadow-[0_0_10px_rgba(34,197,94,0.25)]' 
                          : ''
                      }`}
                      aria-label="Toggle Web Search"
                    >
                      <Globe className="toolbar-icon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                    <span>{webSearchEnabled ? 'Disable' : 'Enable'} Web Search</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Divider */}
            <div className="toolbar-divider" />
            
            {/* Settings Group */}
            <div className="toolbar-group gap-2 items-center">
              {/* Font Size */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-1 py-0.5 rounded-md border border-slate-700/60 text-slate-300">
                      {(() => {
                        const SCALE = ['xs','s','sm','md','lg','xl','xxl'] as const;
                        const idx = SCALE.indexOf(chatFontSize as any);
                        const dec = () => setChatFontSize(SCALE[Math.max(0, idx - 1)] as any);
                        const inc = () => setChatFontSize(SCALE[Math.min(SCALE.length - 1, idx + 1)] as any);
                        return (
                          <>
                            <button
                              type="button"
                              onClick={dec}
                              className="px-1.5 py-0.5 rounded hover:bg-slate-800/60"
                              aria-label="Decrease font size"
                            >
                              <span className="text-[10px] leading-none">−</span>
                            </button>
                            <span className="px-1 text-[10px] select-none">A</span>
                            <button
                              type="button"
                              onClick={inc}
                              className="px-1.5 py-0.5 rounded hover:bg-slate-800/60"
                              aria-label="Increase font size"
                            >
                              <span className="text-[10px] leading-none">+</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                    <span>Chat font size</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* Model Settings */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="toolbar-btn text-purple-400/80 dark:text-purple-400/80"
                      aria-label="Model Settings"
                      onClick={() => setIsModelSettingsOpen(true)}
                    >
                      <SlidersVertical className="toolbar-icon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                    <div className="flex flex-col">
                      <span className="font-semibold">Model Parameters</span>
                      <span className="text-xs opacity-80">Fine-tune generation behavior and creativity</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* File Attachment */}
              {isMultiModal && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="toolbar-btn text-orange-400/80 dark:text-orange-400/80"
                        onClick={e => {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }}
                        disabled={isProcessing}
                        aria-label="Attach Files"
                      >
                        <Paperclip className="toolbar-icon" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                      <span>Attach Images</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* Knowledge Base */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="toolbar-btn text-sky-400/80 dark:text-sky-400/80"
                      onClick={() => {
                        if (isIngestionOpen && isIngestionMinimized) {
                          setIsIngestionMinimized(false);
                        } else {
                          setIsIngestionOpen(true);
                        }
                      }}
                      aria-label="Knowledge Base"
                    >
                      <BookOpen className="toolbar-icon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                    <span>Knowledge Base</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Secondary Actions Group - Right Side */}
          <div className="toolbar-section secondary-section">
              {/* Voice/Drive Mode */}
              {showDriveMode && (
              <div className="toolbar-group flex items-center gap-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onDriveModeToggle}
                        className={`toolbar-btn toolbar-btn-voice text-pink-400/80 dark:text-pink-400/80 ${driveModeActive ? 'toolbar-btn-active' : ''}`}
                        aria-label={driveModeActive ? 'Exit Drive Mode' : 'Enter Drive Mode'}
                      >
                        <svg className="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                      <span>{driveModeActive ? 'Exit Drive Mode' : 'Enter Drive Mode'}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Drive Mode Settings */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DriveModeSettingsModal triggerClassName="" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
                      <span>Drive Mode Settings</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            
            {/* File Preview Area */}
            {filePreview && (
              <div className="toolbar-file-preview">
                {filePreview}
              </div>
            )}
            {hasBlockedAttachments && (
              <div className="ml-2 text-[11px] text-amber-500/90 whitespace-nowrap">
                Switch to an image-capable model to send images.
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    [
      modelSelector,
      vectorSearchEnabled,
      toggleVectorSearch,
      tableSearchEnabled,
      toggleTableSearch,
      webSearchEnabled,
      toggleWebSearch,
      tableSearchSettings,
      setTableSearchSettings,
      tableSearchSettingsButton,
      prePrompts,
      selectedPrePromptId,
      handlePrePromptSelect,
      isProcessing,
      handleStopGenerating,
      isMultiModal,
      filePreview,
      hasBlockedAttachments,
      isIngestionOpen,
      isIngestionMinimized,
      showDriveMode,
      driveModeActive,
      onDriveModeToggle,
      chatFontSize,
      setChatFontSize,
    ]
  );

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        {/* Error Display */}
        {error && (
          <div className="chat-error-display">
            Error: {error.message}
          </div>
        )}

        {/* Model Settings Dialog */}
        <ModelSettingsPopup 
          open={isModelSettingsOpen} 
          onOpenChange={setIsModelSettingsOpen} 
        />

        {/* Ingestion Modal */}
        <IngestionDialog
          open={isIngestionOpen && !isIngestionMinimized}
          onOpenChange={open => {
            setIsIngestionOpen(open);
            // If closing, also clear minimization
            if (!open) setIsIngestionMinimized(false);
          }}
          // @ts-expect-error - pass the setter if supported for minimize button
          onMinimize={() => setIsIngestionMinimized(true)}
        />

        {/* Form Element */}
        <form
          ref={formRef}
          onSubmit={onFormSubmit}
          className="chat-form-enhanced"
          onPaste={handlePaste}
          onDragEnter={isMultiModal ? handleDragEnter : undefined}
          onDragLeave={isMultiModal ? handleDragLeave : undefined}
          onDragOver={isMultiModal ? handleDragOver : undefined}
          onDrop={isMultiModal ? handleDrop : undefined}
        >
          {controlsRow}
          <div
            ref={containerRef}
            className={`chat-textarea-container ${
              dragActive && isMultiModal ? 'chat-drag-active' : ''
            }`}
            style={{
              height: `${currentHeight + 12}px`,
              transition: isDragging.current ? 'none' : 'height 0.1s ease-out',
            }}
          >
            <DragHandle
              dragHandleRef={dragHandleRef}
              isDragging={isDragging.current}
            />
            <Textarea
              ref={textareaRef}
              value={internalInput}
              onChange={handleLocalInputChange}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              placeholder={isMultiModal ? "Type message, paste or drop images..." : "Type your message..."}
              className="chat-textarea-enhanced text-slate-200 dark:text-slate-200 caret-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:placeholder:text-transparent selection:bg-slate-700 selection:text-white"
              style={{
                height: `${currentHeight}px`,
                transition: 'none',
              }}
              rows={1}
              aria-label="Chat input"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
              disabled={!isMultiModal || isProcessing}
            />
            {internalInput.length > 20 && (
              <div className="chat-char-counter">
                {internalInput.length}
              </div>
            )}
            <div className="absolute -top-5 left-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity select-none">
              Tip: Type LaTeX between \\(...\\) or \\[...\\] to render math.
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={
                isProcessing ||
                (!internalInput.trim() && internalFiles.length === 0) ||
                (hasBlockedAttachments && internalInput.trim().length === 0)
              }
              className="chat-send-btn-enhanced"
              title="Send message (Enter)"
            >
              <span className="sr-only">Send message</span>
              <SendIcon />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
