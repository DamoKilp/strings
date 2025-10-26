// /components/sidebarComponents/ToggleCollapseButton.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ToggleCollapseButtonProps {
  isCollapsed: boolean;
  onClick: () => void;
}

export function ToggleCollapseButton({ isCollapsed, onClick }: ToggleCollapseButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-6 border border-border bg-background/80 backdrop-blur-sm hover:bg-muted p-0 flex items-center justify-center"
          onClick={onClick}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {/* Show the appropriate icon based on collapsed state and hover */}
          <div className="group relative w-full h-full flex items-center justify-center">
            {/* Default state icon */}
            <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity">
              <div className="w-3 h-3 border border-foreground/70">
                <div className={`h-full ${isCollapsed ? 'w-3/4' : 'w-1/2'} bg-foreground/20`}></div>
              </div>
            </div>
            
            {/* Hover state icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </div>
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}