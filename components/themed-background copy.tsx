"use client";

// /components/themed-background.tsx
'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundMode } from './contexts/BackgroundModeContext';
import { FacadeBackground } from './facade-background';

interface ThemedBackgroundProps {
  className?: string;
}

export function ThemedBackground({ className = '' }: ThemedBackgroundProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { backgroundMode } = useBackgroundMode();

  // Set mounted to true only after initial client render
  useEffect(() => {
    setMounted(true);
  }, []);

  // If facade mode is selected, render the facade background
  if (mounted && backgroundMode === 'facade') {
    return <FacadeBackground className={className} />;
  }

  // --- Determine URLs ---
  const lightBgUrl = '/backgrounds/light-bg.png';
  const darkBgUrl = '/backgrounds/dark-bg.png';
  const systemBgUrl = '/backgrounds/system-bg.png';

  // --- Determine Theme & Styles (Only *after* mount) ---
  // Before mount, we won't render the theme-specific parts anyway
  const activeTheme = mounted ? (resolvedTheme || theme || 'light') : null; // Use null before mount
  const activeBgUrl = !mounted
    ? '' // No background image before mount
    : theme === 'system'
      ? systemBgUrl
      : activeTheme === 'dark'
        ? darkBgUrl
        : lightBgUrl;

  const activeGradient = !mounted
    ? 'transparent' // No gradient before mount
    : activeTheme === 'dark' // Use activeTheme here for consistency
      ? 'radial-gradient(circle at top right, rgba(80, 80, 180, 0.15), transparent 70%), radial-gradient(circle at bottom left, rgba(80, 30, 180, 0.1), transparent 70%)'
      : 'radial-gradient(circle at top right, rgba(220, 220, 255, 0.2), transparent 70%), radial-gradient(circle at bottom left, rgba(230, 230, 255, 0.15), transparent 70%)';

  // Server Render / Before Mount: Render minimal structure
  // Return early if not mounted to prevent theme-dependent rendering
  if (!mounted) {
    // Return a consistent placeholder that matches what server would render
    return (
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: -1, 
          pointerEvents: 'none',
          background: 'transparent' // Ensure transparent during SSR
        }} 
      />
    );
  }

  // Client Render After Mount: Render the full themed component
  return (
    <>
      {/* Background Image Div */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          // Negative z-index to ensure it stays behind all content
          zIndex: -1,
          backgroundImage: activeBgUrl ? `url(${activeBgUrl})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          opacity: 0.9, // Opacity can be set directly now
          transition: 'opacity 0.6s ease-in-out', // Keep transition if desired
          pointerEvents: 'none',
        }}
      />

      {/* Fallback Gradient Div */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -1,
          background: activeGradient,
          opacity: 0.8, // Opacity can be set directly now
          transition: 'opacity 0.6s ease-in-out', // Keep transition
          pointerEvents: 'none',
        }}
      />

      {/* Animated Backgrounds Container - Conditionally render content inside */}
      <div className={`bg-pattern-container ${className}`} style={{ display: 'none' }}>
        {/* AnimatePresence content now renders ONLY AFTER mount */}
        <AnimatePresence>
          {/* Light Mode */}
          <motion.div
            key="light-bg"
            className="bg-pattern bg-pattern-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeTheme === 'light' ? 0.15 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />

          {/* Dark Mode */}
          <motion.div
            key="dark-bg"
            className="bg-pattern bg-pattern-dark"
            initial={{ opacity: 0 }}
            animate={{ opacity: activeTheme === 'dark' ? 0.15 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />

          {/* System Mode - uses 'theme', check logic */}
          {/* Render system bg only if theme is system AND matches activeTheme */}
          {theme === 'system' && (
             <motion.div
                key="system-bg"
                className="bg-pattern bg-pattern-system"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.12 }} // Only animate in if theme is system
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
             />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
