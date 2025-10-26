// /components/sidebarComponents/SidebarFooter.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  UserIcon, 
  SettingsIcon, 
  LogOutIcon,
  ArchiveIcon,
  TrashIcon,
  CloudIcon,
  SmartphoneIcon,
  MoreIcon,
  ChevronRightIcon,
  ChevronLeftIcon
} from './SidebarIcons';

interface SidebarFooterProps {
  user: { email?: string; id?: string } | null;
  onClearLocal: () => void;
  onClearCloud: () => void;
  onClearAll: () => void;
  onLogout?: () => void;
  onSettings?: () => void;
}

export function SidebarFooter({
  user,
  onClearLocal,
  onClearCloud,
  onClearAll,
  onLogout,
  onSettings
}: SidebarFooterProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Get first part of email for shorter display
  const displayName = user?.email ? user.email.split('@')[0] : 'Guest User';
  
  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className="border-t border-border/50 bg-secondary/10 dark:bg-neutral-900/30"
    >
      {/* User info section (always visible) */}
      <div className="p-1.5 flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mr-1.5">
            <UserIcon />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate max-w-[170px]">
              {displayName}
            </span>
            {user?.email && (
              <span className="text-3xs text-muted-foreground truncate max-w-[170px]">
                {user.email}
              </span>
            )}
          </div>
        </div>
        
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 flex-shrink-0">
            {isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </Button>
        </CollapsibleTrigger>
      </div>
      
      {/* Expandable options section */}
      <CollapsibleContent>
        <div className="px-1.5 pb-1.5 space-y-1.5 text-xs">
          <div className="grid grid-cols-2 gap-1">
            {onSettings && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 justify-start text-xs font-normal px-1.5 py-0" 
                onClick={onSettings}
              >
                <SettingsIcon />
                <span className="ml-1">Settings</span>
              </Button>
            )}
            
            {onLogout && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 justify-start text-xs font-normal px-1.5 py-0" 
                onClick={onLogout}
              >
                <LogOutIcon />
                <span className="ml-1">Sign Out</span>
              </Button>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-6 justify-between text-xs font-normal px-1.5 py-0"
              >
                <span className="flex items-center">
                  <TrashIcon />
                  <span className="ml-1">Clear History</span>
                </span>
                <MoreIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44" align="center">
              <DropdownMenuLabel className="text-xs">Clear Conversations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={onClearLocal}
                className="text-xs cursor-pointer"
              >
                <SmartphoneIcon />
                <span className="ml-1">Clear Local Chats</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={onClearCloud}
                className="text-xs cursor-pointer"
              >
                <CloudIcon />
                <span className="ml-1">Clear Cloud Chats</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={onClearAll}
                className="text-xs text-destructive cursor-pointer"
              >
                <TrashIcon />
                <span className="ml-1">Clear All Chats</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}