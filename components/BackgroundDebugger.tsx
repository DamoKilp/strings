"use client";

import { useEffect, useState } from "react";
import { useBackgroundMode } from "./contexts/BackgroundModeContext";
import { useTheme } from "next-themes";

export function BackgroundDebugger() {
  const [mounted, setMounted] = useState(false);
  const { backgroundMode, facadePreset } = useBackgroundMode();
  const { theme, resolvedTheme } = useTheme();
  const [bodyStyles, setBodyStyles] = useState<any>({});

  useEffect(() => {
    setMounted(true);
    
    // Check body styles
    const body = document.body;
    setBodyStyles({
      background: body.style.background,
      backgroundColor: body.style.backgroundColor,
      className: body.className,
    });
  }, []);

  if (!mounted) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px'
      }}
    >
      <div><strong>Background Debug:</strong></div>
      <div>Mode: {backgroundMode}</div>
      <div>Preset: {facadePreset}</div>
      <div>Theme: {theme}</div>
      <div>Resolved: {resolvedTheme}</div>
      <div>Body bg: {bodyStyles.background || 'none'}</div>
      <div>Body bgColor: {bodyStyles.backgroundColor || 'none'}</div>
      <div>Body class: {bodyStyles.className}</div>
    </div>
  );
}
