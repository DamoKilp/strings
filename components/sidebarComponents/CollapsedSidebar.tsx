// /components/sidebarComponents/CollapsedSidebar.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PlusIcon, SearchIcon, SettingsIcon } from './SidebarIcons';

interface CollapsedSidebarProps {
  onCreateChat: () => void;
  onExpand: () => void;
  onSettings?: () => void;
}

export function CollapsedSidebar({ onCreateChat, onExpand, onSettings }: CollapsedSidebarProps) {
  return (
    <div className="flex flex-col items-center pt-10 space-y-4 overflow-hidden w-full">
      {/* New Chat Button - Now this is the first button AFTER the toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="default" 
            size="icon" 
            className="h-7 w-7 rounded-full"
            onClick={onCreateChat}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">New Chat</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7 rounded-full"
            onClick={onExpand}
          >
            <SearchIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Search Conversations</TooltipContent>
      </Tooltip>
      
      {onSettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-7 w-7 rounded-full"
              onClick={onSettings}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}