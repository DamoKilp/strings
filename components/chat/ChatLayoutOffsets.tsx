'use client';

import React, { useEffect } from 'react';

type SidebarStateEvent = CustomEvent<{ collapsed: boolean; width: number }>;

export function ChatLayoutOffsets() {
  useEffect(() => {
    const getBaseOuterWidth = () => {
      try {
        if (typeof window === 'undefined') return 64;
        // Treat widths below 768px as mobile where the outer sidebar is a sheet
        return window.innerWidth < 768 ? 0 : 64; // w-16 outer rail
      } catch {
        return 64;
      }
    };

    const setOffsets = (internalSidebarWidthPx: number) => {
      try {
        const baseOuter = getBaseOuterWidth();
        const totalLeft = Math.max(0, baseOuter + (internalSidebarWidthPx || 0));
        document.documentElement.style.setProperty('--outer-rail-width', `${baseOuter}px`);
        document.documentElement.style.setProperty('--chat-left-offset', `${totalLeft}px`);
        document.documentElement.style.setProperty('--chat-right-offset', '0px');
      } catch {}
    };

    const handler = (e: Event) => {
      const detail = (e as SidebarStateEvent).detail;
      if (!detail) return;
      setOffsets(detail.width || 0);
    };

    window.addEventListener('sidebarStateChange', handler as EventListener);
    // Initialize with defaults: collapsed internal width ~48px or expanded ~252px; pick expanded for safety
    setOffsets(252);

    // Recompute on resize to adapt outer rail visibility on mobile
    const onResize = () => setOffsets(0); // internal width unchanged; base outer updates inside setOffsets
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('sidebarStateChange', handler as EventListener);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return null;
}


