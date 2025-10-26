// /src/contexts/OuterSidebarContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-breakpoint';

interface OuterSidebarContextType {
  outerSidebarWidth: number;
  isOuterSidebarPresent: boolean;
}

const OuterSidebarContext = createContext<OuterSidebarContextType | undefined>(undefined);

// Define the actual width of the OuterSidebar here (desktop/tablet)
const ACTUAL_OUTER_SIDEBAR_WIDTH = 64; // 4rem or w-16

export const OuterSidebarProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isOuterSidebarPresent, setIsOuterSidebarPresent] = useState(false);

  useEffect(() => {
    // Logic to determine if OuterSidebar should be present
    // This mirrors the logic in RenderOuterSidebar.tsx
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up") ||
      pathname.startsWith("/sign-out")
    ) {
      setIsOuterSidebarPresent(false);
    } else {
      setIsOuterSidebarPresent(true);
    }
  }, [pathname]);

  // On mobile, the outer sidebar renders as an overlay sheet and should not push layout
  const providedWidth = isMobile ? 0 : ACTUAL_OUTER_SIDEBAR_WIDTH;

  return (
    <OuterSidebarContext.Provider value={{ outerSidebarWidth: providedWidth, isOuterSidebarPresent }}>
      {children}
    </OuterSidebarContext.Provider>
  );
};

export const useOuterSidebar = (): OuterSidebarContextType => {
  const context = useContext(OuterSidebarContext);
  if (context === undefined) {
    throw new Error('useOuterSidebar must be used within an OuterSidebarProvider');
  }
  return context;
};