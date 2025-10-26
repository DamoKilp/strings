'use client';

import React, { useEffect } from 'react';

type SidebarStateEvent = CustomEvent<{ collapsed: boolean; width: number }>;

export function ChatLayoutOffsets() {
  useEffect(() => {
    const setOffsets = (widthPx: number) => {
      try {
        document.documentElement.style.setProperty('--chat-left-offset', `${widthPx}px`);
        document.documentElement.style.setProperty('--chat-right-offset', '0px');
      } catch {}
    };

    const handler = (e: Event) => {
      const detail = (e as SidebarStateEvent).detail;
      if (!detail) return;
      setOffsets(detail.width || 0);
    };

    window.addEventListener('sidebarStateChange', handler as EventListener);
    // Initialize with a sensible default (expanded width used in Sidebar.tsx)
    setOffsets(252);
    return () => {
      window.removeEventListener('sidebarStateChange', handler as EventListener);
    };
  }, []);

  return null;
}


