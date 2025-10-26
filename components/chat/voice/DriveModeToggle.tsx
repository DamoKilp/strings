"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

export interface DriveModeToggleProps {
  isActive: boolean;
  onToggle: () => void;
  iconOnly?: boolean;
}

export function DriveModeToggle({ isActive, onToggle, iconOnly = false }: DriveModeToggleProps) {
  const baseClass = iconOnly
    ? `chat-control-btn drive-mode-btn-enhanced h-7 w-7 p-0 rounded-lg transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg hover:shadow-xl hover:scale-105 hover:from-emerald-600 hover:to-green-700 drive-mode-active' 
          : 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300 hover:scale-105'
      }`
    : `chat-control-btn drive-mode-btn-enhanced h-7 text-[10px] px-3 transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg hover:shadow-xl hover:scale-105 hover:from-emerald-600 hover:to-green-700 drive-mode-active' 
          : 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
      }`;
      
  return (
    <Button
      type="button"
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      className={baseClass}
      title={isActive ? 'End Drive Mode' : 'Start Drive Mode'}
      aria-label={isActive ? 'End Drive Mode' : 'Start Drive Mode'}
      aria-pressed={isActive}
    >
      {isActive ? (
        <MicOff className={`h-3 w-3 ${iconOnly ? '' : 'mr-1'} animate-pulse`} />
      ) : (
        <Mic className={`h-3 w-3 ${iconOnly ? '' : 'mr-1'}`} />
      )}
      {!iconOnly && <span>{isActive ? 'End Drive' : 'Drive Mode'}</span>}
    </Button>
  );
}


