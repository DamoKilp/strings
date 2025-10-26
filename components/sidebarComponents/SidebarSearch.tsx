// /components/sidebarComponents/SidebarSearch.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SidebarSearchProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export function SidebarSearch({ onSearch, initialQuery = '' }: SidebarSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onSearch(newQuery);
  }, [onSearch]);
  
  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape to clear search when focused
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) {
          e.preventDefault();
          handleClear();
        } else {
          inputRef.current?.blur();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, handleClear]);

  return (
    <div className={`relative transition-all duration-200 p-2 ${isFocused ? 'bg-background/80 dark:bg-neutral-800/50' : ''}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search conversations..."
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="pl-8 pr-8 py-1.5 h-8 text-xs bg-muted/70 dark:bg-neutral-800/70 focus-visible:bg-background dark:focus-visible:bg-neutral-800 placeholder:text-muted-foreground/70"
        />
        
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}