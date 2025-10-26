// /components/sidebarComponents/ConversationItem.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider, // Import TooltipProvider
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from '@/components/ui/input';
import {
  CloudIcon,
  SmartphoneIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  XIcon
} from './SidebarIcons'; // Assuming SidebarIcons exports these
import type { ConversationSummary } from '@/lib/types'; // Assuming this type definition exists

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  isRenaming: boolean;
  newTitle: string;
  setNewTitle: (title: string) => void;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  handleRenameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleRenameBlur: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  isRenaming,
  newTitle,
  setNewTitle,
  onSelect,
  onRename,
  onDelete,
  onSubmitRename,
  onCancelRename,
  renameInputRef,
  handleRenameKeyDown,
  handleRenameBlur
}: ConversationItemProps) {

  // Format model name for display
  const formatModelName = (modelId?: string | null): string => {
    if (!modelId) return 'Unknown';

    // Model shortening logic (keep this map comprehensive)
    const modelMap: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4T',
      'gpt-4-vision': 'GPT-4V',
      'gpt-4o': 'GPT-4o', // Updated from 'gpt-4-o'
      'gpt-3.5-turbo': 'GPT-3.5',
      'claude-3-opus': 'Opus', // Shortened
      'claude-3-sonnet': 'Sonnet', // Shortened
      'claude-3-haiku': 'Haiku', // Shortened
      'gemini-pro': 'Gemini-P', // Shortened
      'gemini-1.5-pro': 'Gemini-1.5P', // Shortened
      'gemini-1.5-flash': 'Gemini-F', // Shortened
      'gemini-ultra': 'Gemini-U', // Shortened
      'llama-3': 'Llama 3',
      'anthropic.claude-3-opus-20240229': 'Opus',
      'anthropic.claude-3-sonnet-20240229': 'Sonnet',
      'anthropic.claude-3-haiku-20240307': 'Haiku',
      'openai.gpt-4': 'GPT-4',
      'openai.gpt-4-turbo': 'GPT-4T',
      'openai.gpt-4o': 'GPT-4o',
      'openai.gpt-3.5-turbo': 'GPT-3.5',
      'google.gemini-pro': 'Gemini-P',
      'google.gemini-1.5-pro-latest': 'Gemini-1.5P',
      'google.gemini-1.5-flash-latest': 'Gemini-F',
      'mistralai.mistral-7b': 'Mistral 7B',
      'mistralai.mixtral-8x7b-instruct-v0.1': 'Mixtral', // Example
      'mistralai.mistral-large-latest': 'Mistral L', // Shortened
      'groq.llama3-8b-8192': 'Llama3 (G)', // Shortened + Provider hint
      'groq.mixtral-8x7b-32768': 'Mixtral (G)',
      'o1-mini': 'O1-mini',
      'o1-preview': 'O1',
      // Add more mappings based on actual model IDs used
    };

    // Prioritize exact match
    if (modelMap[modelId]) {
      return modelMap[modelId];
    }

    // Try partial match (e.g., for full IDs like 'anthropic.claude-3...')
    for (const [key, value] of Object.entries(modelMap)) {
      // Ensure the key is significant enough before matching (e.g., avoid matching just 'gpt')
      if (key.length > 4 && modelId.includes(key)) {
        return value;
      }
    }

    // If no mapping, simplify the ID: remove provider prefix, shorten if long
    const parts = modelId.split(/[/.-]/); // Split by common delimiters
    let simpleName = parts[parts.length - 1]; // Get the last part
    simpleName = simpleName?.replace(/^(latest|instruct|v\d+)$/i, ''); // Remove common suffixes

    if (simpleName.length > 10) { // Shorten aggressively if still long
      return simpleName.substring(0, 8) + '..';
    }

    // Return simplified name or fallback to 'Unknown' if simplification fails
    return simpleName || 'Unknown';
  };

  // Use a default title if none exists
  const displayTitle = conversation.title?.trim() || (conversation.isLocal ? 'Untitled Local' : 'Untitled Cloud');
  const modelName = formatModelName(conversation.modelUsed);

  // --- Renaming State ---
  if (isRenaming) {
    return (
      // Wrap Tooltips in provider if not already done higher up the tree
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center space-x-1 p-1 rounded-md bg-muted/80 dark:bg-neutral-800/60 h-10">
          {/* Icon remains visible */}
          <span className="pl-1 flex-shrink-0">
            {conversation.isLocal ?
              <SmartphoneIcon /> :
              <CloudIcon />}
          </span>
          {/* Input takes up available space */}
          <Input
            ref={renameInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            className="h-7 text-xs flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 bg-background dark:bg-neutral-800"
            aria-label="Rename conversation title"
            placeholder="Enter new title..."
          />
          {/* Action buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-green-600 hover:text-green-700"
                onClick={onSubmitRename}
                aria-label="Confirm rename"
              >
                <CheckIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Save</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-red-600 hover:text-red-700"
                onClick={onCancelRename}
                aria-label="Cancel rename"
              >
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Cancel</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // --- Default Display State ---
  return (
    // Wrap Tooltips in provider if not already done higher up the tree
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "group flex flex-col py-1 px-1.5 rounded-md relative", // Added relative for absolute positioning of actions
          "transition-colors duration-100 ease-in-out", // Smooth background transition
          isActive
            ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground"
            : "hover:bg-accent/50 hover:text-accent-foreground dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
        )}
      >
        {/* Main clickable area */}
        <button
          type="button"
          onClick={onSelect}
          className="w-full text-left flex flex-col gap-0.5"
          aria-current={isActive ? "page" : undefined}
        >
          {/* Top row: Icon, Title, Model Badge */}
          <div className="flex items-center w-full overflow-hidden"> {/* Added w-full and overflow-hidden */}
            {/* Icon */}
            <div className="flex-shrink-0 mr-1.5">
              {conversation.isLocal ? (
                 <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "p-0.5 rounded-sm",
                        isActive ? "text-blue-500 dark:text-blue-400" : "text-blue-500/70 dark:text-blue-400/70"
                      )}>
                        <SmartphoneIcon />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}><p>Local Conversation</p></TooltipContent>
                 </Tooltip>
              ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                          "p-0.5 rounded-sm",
                          isActive ? "text-green-500 dark:text-green-400" : "text-green-500/70 dark:text-green-400/70"
                        )}>
                        <CloudIcon />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}><p>Cloud Conversation</p></TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Title (takes remaining space and truncates) */}
            {/* ***** FIX APPLIED HERE ***** */}
            <div className="truncate flex-1 text-xs font-medium min-w-0">
              {displayTitle}
            </div>
            {/* ***** END FIX ***** */}


            {/* Model Name Badge (fixed size) */}
            <div className={cn(
              "ml-1 flex-shrink-0 text-xxs px-1.5 py-0.5 rounded-full whitespace-nowrap",
              isActive
                ? "bg-primary/20 dark:bg-primary/30"
                : "bg-muted dark:bg-muted/50 text-muted-foreground"
            )}>
              {modelName}
            </div>
          </div>

          {/* Optional: Preview text (commented out in your version) */}
          {/*
          <div className="pl-6 text-3xs text-muted-foreground truncate">
            {previewText} // Make sure previewText is defined if uncommented
          </div>
          */}
        </button>

        {/* Action Buttons (Appear on hover/active, absolutely positioned) */}
        <div className={cn(
          "absolute right-0.5 top-1/2 -translate-y-1/2", // Position top-right corner
          "flex items-center space-x-0", // Horizontal layout for buttons
          "opacity-0 transition-opacity duration-150 ease-in-out", // Fade effect
          "group-hover:opacity-100", // Show on group hover
          isActive && "opacity-90" // Slightly visible when active
        )}>
           <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6" // Slightly larger touch target
                  onClick={(e) => { e.stopPropagation(); onRename(); }}
                  aria-label="Rename conversation"
                >
                  <EditIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Rename</p></TooltipContent>
            </Tooltip>

           <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/80 hover:text-destructive" // Consistent red hint
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  aria-label="Delete conversation"
                >
                  <TrashIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Delete</p></TooltipContent>
            </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}