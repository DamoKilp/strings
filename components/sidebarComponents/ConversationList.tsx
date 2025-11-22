// /components/sidebarComponents/ConversationList.tsx
'use client';

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/lib/types';
import { ModelIcon } from '@/components/ai/ModelIcon';
import { Loader2, HardDrive, Cloud, MoreHorizontal } from 'lucide-react';
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  SearchIcon,
  RefreshCwIcon,
  MessageSquareIcon,
  AlertCircleIcon,
  LoaderIcon,
} from './SidebarIcons';

// --- Model Map Definition ---
const modelMap = new Map<string, { providerId: string; name: string }>([
  ["gpt-5.1", { providerId: "openai", name: "GPT-5.1" }],
  ["gpt-5", { providerId: "openai", name: "GPT-5" }],
  ["gpt-4.1", { providerId: "openai", name: "GPT-4.1" }],
  ["gpt-4o", { providerId: "openai", name: "GPT-4o" }],
  ["gpt-4o-mini", { providerId: "openai", name: "GPT-4o mini" }],
  ["gpt-4.1-mini", { providerId: "openai", name: "GPT-4.1 mini" }],
  ["gpt-4.1-nano", { providerId: "openai", name: "GPT-4.1 nano" }],
  ["o3", { providerId: "openai", name: "o3" }],
  ["o3-mini", { providerId: "openai", name: "o3-mini" }],
  ["o4-mini", { providerId: "openai", name: "o4-mini" }],
  ["o1", { providerId: "openai", name: "o1" }],
  ["o1-mini", { providerId: "openai", name: "o1-mini" }],
  ["claude-3-7-sonnet-latest", { providerId: "anthropic", name: "Claude 3.7 Sonnet" }],
  ["claude-3-5-sonnet-latest", { providerId: "anthropic", name: "Claude 3.5 Sonnet" }],
  ["claude-3-5-haiku-latest", { providerId: "anthropic", name: "Claude 3.5 Haiku" }],
  ["gemini-2.5-pro-exp-03-25", { providerId: "google", name: "Gemini 2.5 Pro Experimental 03-25" }],
  ["gemini-2.5-pro-preview-05-06", { providerId: "google", name: "Gemini 2.5 Pro Preview 05-06" }],
  ["gemini-2.5-flash-preview-04-17", { providerId: "google", name: "Gemini 2.5 Flash Preview 04-17" }],
  ["models/gemini-2.0-flash", { providerId: "google", name: "Gemini 2.0 Flash" }],
  ["models/gemini-2.0-flash-lite", { providerId: "google", name: "Gemini 2.0 Flash Lite" }],
  ["models/gemini-2.0-flash-thinking-exp-01-21", { providerId: "google", name: "Gemini 2.0 Flash Thinking Experimental 01-21" }],
  ["models/gemini-1.5-pro-002", { providerId: "google", name: "Gemini 1.5 Pro" }],
  ["models/gemini-1.5-flash-002", { providerId: "google", name: "Gemini 1.5 Flash" }],
  ["codestral-2501", { providerId: "mistral", name: "Codestral 25.01" }],
  ["mistral-large-latest", { providerId: "mistral", name: "Mistral Large" }],
  ["pixtral-large-latest", { providerId: "mistral", name: "Pixtral Large" }],
  ["mistral-small-latest", { providerId: "mistral", name: "Mistral Small" }],
  ["open-mistral-nemo", { providerId: "mistral", name: "Mistral Nemo" }],
  ["llama-3.3-70b-versatile", { providerId: "groq", name: "Llama 3.3 70B (Preview)" }],
  ["accounts/fireworks/models/llama4-maverick-instruct-basic", { providerId: "fireworks", name: "Llama 4 Maverick Instruct" }],
  ["accounts/fireworks/models/llama4-scout-instruct-basic", { providerId: "fireworks", name: "Llama 4 Scout Instruct" }],
  ["accounts/fireworks/models/llama-v3p1-405b-instruct", { providerId: "fireworks", name: "Llama 3.1 405B" }],
  ["accounts/fireworks/models/llama-v3p1-70b-instruct", { providerId: "fireworks", name: "Llama 3.1 70B" }],
  ["accounts/fireworks/models/qwen2p5-coder-32b-instruct", { providerId: "fireworks", name: "Qwen2.5-Coder-32B-Instruct" }],
  ["accounts/fireworks/models/qwen-qwq-32b-preview", { providerId: "fireworks", name: "Qwen-QWQ-32B-Preview" }],
  ["accounts/fireworks/models/deepseek-r1", { providerId: "fireworks", name: "DeepSeek R1" }],
  ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", { providerId: "togetherai", name: "Llama 3.1 70B" }],
  ["grok-beta", { providerId: "xai", name: "Grok (Beta)" }],
  ["deepseek-chat", { providerId: "deepseek", name: "DeepSeek V3" }],
  ["llama3.1", { providerId: "ollama", name: "Llama 3.1" }],
  ["mistral-nemo", { providerId: "ollama", name: "Mistral Nemo" }],
  ["mistral-large", { providerId: "ollama", name: "Mistral Large" }],
  // Add more as needed, and ensure these match the exact values stored in modelUsed
]);
// --- End Model Map ---

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  loadingTimeout: boolean;
  renamingId: string | null;
  newTitle: string;
  setNewTitle: (title: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  handleSelect: (id: string, isLocal: boolean) => void;
  startRename: (conversation: ConversationSummary) => void;
  cancelRename: () => void;
  submitRename: () => Promise<void>;
  handleRenameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleRenameBlur: () => void;
  openDeleteDialog: (conversation: ConversationSummary) => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;  selectedIds: string[];
  onSelectConversation: (id: string, checked: boolean) => void;
  onSelectRange: (fromIndex: number, toIndex: number, visibleIds: string[]) => void;
  onSelectAll: (checked: boolean, visibleIds: string[]) => void;
  allVisibleSelected: boolean;
  multiselectEnabled: boolean;
}

export function ConversationList({
  conversations,
  activeConversationId,
  isLoading,
  error,
  loadingTimeout,
  renamingId,
  newTitle,
  setNewTitle,
  renameInputRef,
  handleSelect,
  startRename,
  cancelRename,
  submitRename,
  handleRenameKeyDown,
  handleRenameBlur,
  openDeleteDialog,
  onRefresh,
  onSearch,
  searchQuery,
  onLoadMore,
  hasMore,
  isLoadingMore,
  selectedIds,
  onSelectConversation,
  onSelectRange,
  onSelectAll,
  allVisibleSelected,
  multiselectEnabled,
}: ConversationListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const lastClickedIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => 40, []),
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasMore || isLoadingMore || conversations.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.25 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, conversations.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.setAttribute('tabindex', '0');
    }
  }, []);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }
    return conversations.filter(convo =>
      (convo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (convo.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
       (convo.firstMessagePreview || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [conversations, searchQuery]);

  const visibleIds = useMemo(() => conversations.map(c => c.id), [conversations]);  // Handler for checkbox clicks with shift-click support
  const handleCheckboxClick = useCallback((conversationIndex: number, conversationId: string, event: React.MouseEvent) => {



    
    if (event.shiftKey && lastClickedIndexRef.current !== null) {
      // Shift-click: select range (includes both start and end)
      event.preventDefault();

      onSelectRange(lastClickedIndexRef.current, conversationIndex, visibleIds);
    } else {
      // Normal click: toggle single item
      const isChecked = !selectedIds.includes(conversationId);

      onSelectConversation(conversationId, isChecked);
    }
    
    // Update last clicked index
    lastClickedIndexRef.current = conversationIndex;
  }, [selectedIds, onSelectConversation, onSelectRange, visibleIds]);

  const renderContent = () => {
    if (isLoading && conversations.length === 0) {
      return Array.from({ length: 8 }).map((_, i) => (
        <div key={`skel-${i}`} className="flex items-center gap-2 px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ));
    }
    if (error) {
      return (
        <div className="p-4 text-center text-destructive text-xs">
          <AlertCircleIcon className="mx-auto mb-2 h-6 w-6" />
          <p>Error loading conversations:</p>
          <p className="mt-1 font-mono bg-red-100 dark:bg-red-900/50 p-1 rounded text-[10px]">{error}</p>
          {loadingTimeout && <p className="mt-2 text-muted-foreground">Loading timed out.</p>}
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-3">
            <RefreshCwIcon className="mr-1.5 h-3 w-3" /> Try Again
          </Button>
        </div>
      );
    }
    if (loadingTimeout && !error && conversations.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground text-xs">
          <LoaderIcon className="mx-auto mb-2 h-6 w-6 animate-spin" />
          <p>Loading conversations is taking longer than usual...</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
            <RefreshCwIcon className="mr-1.5 h-3 w-3" /> Refresh
          </Button>
        </div>
      );
    }
    if (conversations.length === 0 && !isLoading && !searchQuery) {
      return (
        <div className="p-4 text-center text-muted-foreground text-xs">
          <MessageSquareIcon className="mx-auto mb-2 h-6 w-6" /> No conversations yet.
        </div>
      );
    }
    if (conversations.length === 0 && !isLoading && searchQuery) {
      return (
        <div className="p-4 text-center text-muted-foreground text-xs">
          <SearchIcon className="mx-auto mb-2 h-6 w-6" /> No results for "{searchQuery}".
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const convo = conversations[virtualRow.index];
            if (!convo) return null;
            const isActive = convo.id === activeConversationId;
            const isRenaming = convo.id === renamingId;
            const modelInfo = convo.modelUsed ? modelMap.get(convo.modelUsed) : null;
            const providerId = modelInfo?.providerId || 'default';
            const modelName = modelInfo?.name || convo.modelUsed || 'Unknown Model';

            return (
              <div
                key={convo.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TooltipProvider delayDuration={300}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      "transition-colors duration-150 ease-in-out",
                      isActive && "bg-primary/10 text-primary font-medium",
                      isRenaming && "bg-accent ring-1 ring-inset ring-ring/50"
                    )}
                    onClick={() => !isRenaming && handleSelect(convo.id, convo.isLocal)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >                    {multiselectEnabled && !isRenaming && (
                      <input
                        type="checkbox"
                        className="mr-2 accent-primary h-4 w-4 rounded border-border"
                        checked={selectedIds.includes(convo.id)}
                        onChange={e => {
                          e.stopPropagation();
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          handleCheckboxClick(virtualRow.index, convo.id, e);
                        }}
                        aria-label="Select conversation"
                        tabIndex={0}
                      />
                    )}
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5 flex-1 mr-1 py-0.5">
                        <Input
                          ref={renameInputRef}
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={handleRenameBlur}
                          className="h-7 text-xs flex-1 px-1.5 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring"
                          aria-label="Rename conversation title"
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-green-600 hover:text-green-700"
                              onClick={(e) => { e.stopPropagation(); submitRename(); }}
                            >
                              <CheckIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Save</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); cancelRename(); }}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cancel</TooltipContent>
                        </Tooltip>
                      </div>                    ) : (
                      <div className="flex items-center gap-2 flex-1 overflow-hidden mr-1 min-w-0">
                        {/* Icons section */}
                        <div className="flex items-center gap-1 shrink-0">
                          <ModelIcon providerId={providerId} size={14} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                {convo.isLocal ? (
                                  <HardDrive className="h-2.5 w-2.5 text-blue-500" />
                                ) : (
                                  <Cloud className="h-2.5 w-2.5 text-green-500" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {convo.isLocal ? 'Stored locally on your device' : 'Stored in the cloud'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        
                        {/* Content section */}
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          <p className="text-xs font-medium truncate leading-tight" title={convo.title}>
                            {convo.title?.trim() || (convo.isLocal ? 'Untitled Local' : 'Untitled Cloud')}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight" title={modelName}>
                            {modelName}
                          </p>
                        </div>
                        
                        {/* Actions menu */}
                        <div className={cn("flex items-center opacity-0 group-hover:opacity-100", isActive && "opacity-100")}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  startRename(convo); 
                                }}
                                className="text-xs"
                              >
                                <PencilIcon className="h-3 w-3 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  openDeleteDialog(convo); 
                                }}
                                className="text-xs text-destructive focus:text-destructive"
                              >
                                <TrashIcon className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipProvider>
              </div>
            );
          })}
        </div>
        <div 
          ref={loadMoreRef}
          className="py-2 text-center"
          style={{ height: isLoadingMore ? '40px' : '20px', opacity: hasMore ? 1 : 0 }}
        >
          {isLoadingMore && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden" ref={parentRef}>
      <div className="p-2 border-b border-border/50 flex items-center">        {multiselectEnabled && (
          <input
            type="checkbox"
            className="mr-2 accent-primary h-4 w-4 rounded border-border"
            checked={allVisibleSelected}
            onChange={e => {
              onSelectAll(e.target.checked, visibleIds);
              lastClickedIndexRef.current = null; // Reset for new selection cycle
            }}
            aria-label="Select all conversations"
            tabIndex={0}
          />
        )}
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-8 text-xs focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring"
            aria-label="Search conversations"
          />
          {searchQuery && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => onSearch('')}
                    aria-label="Clear search"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-auto px-1 py-1"
        style={{ height: 'calc(100% - 52px)' }}
      >
        {renderContent()}
      </div>
    </div>
  );
}
