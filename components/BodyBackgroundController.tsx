"use client";

import { useEffect } from "react";
import { useBackgroundMode } from "./contexts/BackgroundModeContext";

/**
 * Ensures the global body background is transparent when themed backgrounds are active
 * so ThemedBackground imagery/facade shows through.
 */
export function BodyBackgroundController() {
  const { backgroundMode } = useBackgroundMode();
  
  useEffect(() => {
    const body = document.body;
    
    // Only override background when using image or facade modes
    if (backgroundMode === 'image' || backgroundMode === 'facade') {
      body.classList.add("use-themed-bg");
      // Force transparency to let ThemedBackground show through
      body.style.background = "transparent";
      body.style.backgroundColor = "transparent";
      
      return () => {
        body.classList.remove("use-themed-bg");
        body.style.background = "";
        body.style.backgroundColor = "";
      };
    }
  }, [backgroundMode]);
  
  return null;
}
