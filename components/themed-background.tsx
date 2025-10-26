"use client";

import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { FacadeBackground } from './facade-background';
import { useBackgroundMode } from './contexts/BackgroundModeContext';

interface ThemedBackgroundProps {
  className?: string;
}

export function ThemedBackground({ className = '' }: ThemedBackgroundProps) {
  const { theme, resolvedTheme } = useTheme();
  const { backgroundMode } = useBackgroundMode();
  const activeTheme = useMemo(() => (resolvedTheme || theme || 'light'), [resolvedTheme, theme]);

  if (backgroundMode === 'facade') {
    return <FacadeBackground className={className} />;
  }

  const lightBgUrl = '/backgrounds/light-bg.png';
  const darkBgUrl = '/backgrounds/dark-bg.png';
  const systemBgUrl = '/backgrounds/system-bg.png';
  const activeBgUrl = theme === 'system' ? systemBgUrl : activeTheme === 'dark' ? darkBgUrl : lightBgUrl;
  const activeGradient = activeTheme === 'dark'
    ? 'radial-gradient(circle at top right, rgba(80, 80, 180, 0.15), transparent 70%), radial-gradient(circle at bottom left, rgba(80, 30, 180, 0.1), transparent 70%)'
    : 'radial-gradient(circle at top right, rgba(220, 220, 255, 0.2), transparent 70%), radial-gradient(circle at bottom left, rgba(230, 230, 255, 0.15), transparent 70%)';

  return (
    <>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -1,
          backgroundImage: activeBgUrl ? `url(${activeBgUrl})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          opacity: 0.9,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -1,
          background: activeGradient,
          opacity: 0.8,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}


