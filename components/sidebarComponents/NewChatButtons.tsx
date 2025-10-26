// /components/sidebarComponents/NewChatButtons.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  PlusIcon, 
  CloudIcon, 
  SmartphoneIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from './SidebarIcons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NewChatButtonsProps {
  onCreateCloudChat: () => void;
  onCreateLocalChat: () => void;
  defaultMode?: 'cloud' | 'local';
}

export function NewChatButtons({ 
  onCreateCloudChat, 
  onCreateLocalChat,
  defaultMode = 'cloud'
}: NewChatButtonsProps) {
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local'>(defaultMode);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleCreateChat = () => {
    if (selectedMode === 'cloud') {
      onCreateCloudChat();
    } else {
      onCreateLocalChat();
    }
  };

  return (
    <div className="px-2 pt-2 pb-1 flex items-center gap-1">
      <Button
        variant="default"
        className="flex-1 justify-start gap-1.5 h-8 text-xs"
        onClick={handleCreateChat}
        aria-label="Start a new chat"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        <span>New Chat ({selectedMode === 'cloud' ? 'Cloud' : 'Local'})</span>
      </Button>
      
      <DropdownMenu onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0"
            aria-label="Select chat storage type"
          >
            {isDropdownOpen ? 
              <ChevronUpIcon className="h-3.5 w-3.5" /> : 
              <ChevronDownIcon className="h-3.5 w-3.5" />
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem 
            className={`flex items-center gap-2 ${selectedMode === 'cloud' ? 'bg-primary/10' : ''}`}
            onClick={() => setSelectedMode('cloud')}
          >
            <CloudIcon className="w-3.5 h-3.5 text-green-700 dark:text-green-500" />
            <span className="text-xs">Cloud Storage</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            className={`flex items-center gap-2 ${selectedMode === 'local' ? 'bg-primary/10' : ''}`}
            onClick={() => setSelectedMode('local')}
          >
            <SmartphoneIcon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-500" />
            <span className="text-xs">Local Storage</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}