"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { calculateLuminance, extractDominantColor, getAdaptiveTextColors, getSafeBackgroundRGB } from '@/utils/adaptiveTextColor';

type BackgroundMode = 'image' | 'facade';

type FacadePreset =
  | 'intense'
  | 'purple-dream' // Similar to attached image
  | 'midnight'
  | 'ocean'
  | 'lavender'
  | 'boring-white'
  | 'boring-black'
  | 'sunset-triad'
  | 'aurora-triad'
  | 'tropical-triad'
  | 'cosmic-triad';

interface BackgroundModeContextType {
  backgroundMode: BackgroundMode;
  facadePreset: FacadePreset;
  setBackgroundMode: (mode: BackgroundMode) => void;
  setFacadePreset: (preset: FacadePreset) => void;
  toggleBackgroundMode: () => void;
}

const BackgroundModeContext = createContext<BackgroundModeContextType | undefined>(undefined);

export function useBackgroundMode() {
  const context = useContext(BackgroundModeContext);
  if (context === undefined) {
    throw new Error('useBackgroundMode must be used within a BackgroundModeProvider');
  }
  return context;
}

interface BackgroundModeProviderProps {
  children: React.ReactNode;
}

export function BackgroundModeProvider({ children }: BackgroundModeProviderProps) {
  // ✨ NEW USER DEFAULTS: Aurora background with dark mode
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('facade');
  const [facadePreset, setFacadePreset] = useState<FacadePreset>('aurora-triad');
  const { resolvedTheme, theme } = useTheme();

  // Load saved preferences from localStorage and migrate invalid presets
  useEffect(() => {
    const savedMode = localStorage.getItem('background-mode') as BackgroundMode;
    const savedPresetRaw = localStorage.getItem('facade-preset');
    
    if (savedMode && (savedMode === 'image' || savedMode === 'facade')) {
      setBackgroundMode(savedMode);
    }
    
    if (savedPresetRaw) {
      const allowed: ReadonlyArray<FacadePreset> = [
        'intense', 'purple-dream', 'midnight', 'ocean', 'lavender',
        'boring-white', 'boring-black', 'sunset-triad', 'aurora-triad', 'tropical-triad', 'cosmic-triad'
      ];
      const normalized = savedPresetRaw as FacadePreset;
      if (allowed.includes(normalized)) {
        setFacadePreset(normalized);
      } else {
        // migrate to a safe default (aurora-triad for new users)
        setFacadePreset('aurora-triad');
        localStorage.setItem('facade-preset', 'aurora-triad');
      }
    }
  }, []);

  // Save preferences to localStorage when changed
  useEffect(() => {
    localStorage.setItem('background-mode', backgroundMode);
  }, [backgroundMode]);

  useEffect(() => {
    localStorage.setItem('facade-preset', facadePreset);
  }, [facadePreset]);

  // ✅ ENHANCED: Update CSS variables and adaptive text colors when preferences change
  useEffect(() => {
    const updateColorsAsync = async () => {
      const root = typeof document !== 'undefined' ? document.documentElement : null;
      if (!root) return;

      const activeTheme = (resolvedTheme || theme || 'light') as 'light' | 'dark';

      const gradients: Record<FacadePreset, { light: string; dark: string }> = {
        intense: {
          light: `linear-gradient(135deg, rgba(180, 166, 252, 0.98) 0%, rgba(165, 153, 251, 0.98) 20%, rgba(147, 139, 249, 0.98) 50%, rgba(129, 125, 247, 0.98) 100%)`,
          dark: `linear-gradient(135deg, rgba(75, 63, 120, 0.95) 0%, rgba(90, 75, 135, 0.95) 20%, rgba(105, 87, 150, 0.95) 50%, rgba(120, 99, 165, 0.95) 100%)`,
        },
        'purple-dream': {
          light: `linear-gradient(135deg, rgba(196, 181, 253, 0.98) 0%, rgba(180, 166, 252, 0.98) 30%, rgba(165, 153, 251, 0.98) 60%, rgba(147, 139, 249, 0.98) 100%)`,
          dark: `linear-gradient(135deg, rgba(90, 75, 135, 0.95) 0%, rgba(105, 87, 150, 0.95) 30%, rgba(120, 99, 165, 0.95) 60%, rgba(135, 111, 180, 0.95) 100%)`,
        },
        midnight: {
        light: `linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 40%, rgba(71, 85, 105, 0.95) 100%)`,
        dark: `linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 30%, rgba(45, 55, 72, 0.98) 70%, rgba(60, 69, 87, 0.98) 100%)`,
        },
        ocean: {
        light: `linear-gradient(135deg, rgba(219, 234, 254, 0.98) 0%, rgba(191, 219, 254, 0.98) 35%, rgba(147, 197, 253, 0.98) 70%, rgba(129, 140, 248, 0.98) 100%)`,
        dark: `linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(45, 73, 153, 0.95) 35%, rgba(60, 88, 168, 0.95) 70%, rgba(75, 103, 183, 0.95) 100%)`,
        },
        lavender: {
        light: `linear-gradient(135deg, rgba(243, 232, 255, 0.98) 0%, rgba(233, 213, 255, 0.98) 30%, rgba(221, 189, 255, 0.98) 65%, rgba(209, 165, 255, 0.98) 100%)`,
        dark: `linear-gradient(135deg, rgba(75, 63, 120, 0.95) 0%, rgba(90, 75, 135, 0.95) 30%, rgba(105, 87, 150, 0.95) 65%, rgba(120, 99, 165, 0.95) 100%)`,
        },
      'boring-white': {
        light: `linear-gradient(135deg, rgba(255,255,255,0.99) 0%, rgba(250,252,255,0.99) 50%, rgba(244,247,255,0.99) 100%)`,
        dark: `linear-gradient(135deg, rgba(246,246,246,0.98) 0%, rgba(250,252,255,0.98) 50%, rgba(244,247,255,0.98) 100%)`,
      },
      'boring-black': {
        light: `linear-gradient(135deg, rgba(9, 9, 11, 0.98) 0%, rgba(17, 24, 39, 0.98) 45%, rgba(2, 6, 23, 0.98) 100%)`,
        dark: `linear-gradient(135deg, rgba(5, 6, 13, 0.98) 0%, rgba(12, 18, 32, 0.98) 38%, rgba(2, 6, 23, 0.98) 100%)`,
      },
      'sunset-triad': {
        light: `linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(168, 85, 247, 0.90) 50%, rgba(59, 130, 246, 0.90) 100%)`,
        dark: `linear-gradient(135deg, rgba(180, 83, 9, 0.95) 0%, rgba(126, 34, 206, 0.92) 50%, rgba(29, 78, 216, 0.92) 100%)`,
      },
      'aurora-triad': {
        light: `linear-gradient(135deg, rgba(16, 185, 129, 0.90) 0%, rgba(167, 139, 250, 0.90) 50%, rgba(244, 114, 182, 0.90) 100%)`,
        dark: `linear-gradient(135deg, rgba(13, 148, 136, 0.92) 0%, rgba(124, 58, 237, 0.92) 50%, rgba(219, 39, 119, 0.92) 100%)`,
      },
      'tropical-triad': {
        light: `linear-gradient(135deg, rgba(34, 197, 94, 0.92) 0%, rgba(20, 184, 166, 0.90) 50%, rgba(245, 158, 11, 0.90) 100%)`,
        dark: `linear-gradient(135deg, rgba(22, 163, 74, 0.94) 0%, rgba(15, 118, 110, 0.92) 50%, rgba(180, 83, 9, 0.92) 100%)`,
      },
      'cosmic-triad': {
        light: `linear-gradient(135deg, rgba(99, 102, 241, 0.92) 0%, rgba(147, 51, 234, 0.90) 50%, rgba(59, 130, 246, 0.90) 100%)`,
        dark: `linear-gradient(135deg, rgba(79, 70, 229, 0.94) 0%, rgba(109, 40, 217, 0.92) 50%, rgba(37, 99, 235, 0.92) 100%)`,
      },
      };

      if (backgroundMode === 'facade') {
        const gradient = gradients[facadePreset][activeTheme];
        root.style.setProperty('--background-gradient', gradient);
        
        // ✅ ENHANCED: Calculate adaptive text colors with better luminance detection
        const dominantColor = extractDominantColor(gradient);
        const luminance = calculateLuminance(dominantColor.r, dominantColor.g, dominantColor.b);
        const textColors = getAdaptiveTextColors(luminance, activeTheme === 'dark');
        
        // Set adaptive text color variables
        root.style.setProperty('--text-primary-adaptive', textColors.primary);
        root.style.setProperty('--text-secondary-adaptive', textColors.secondary);
        root.style.setProperty('--text-tertiary-adaptive', textColors.tertiary);
        root.style.setProperty('--text-interactive-adaptive', textColors.interactive);
        root.style.setProperty('--text-high-contrast-adaptive', textColors.highContrast);
        
        // Set safe background color with enhanced alpha
        const safeBgRgb = getSafeBackgroundRGB(luminance, activeTheme === 'dark');
        root.style.setProperty('--safe-bg-rgb', safeBgRgb);
        
        // Enhanced luminance detection for better contrast
        let luminanceCategory = 'medium';
        if (luminance > 0.7) {
          luminanceCategory = 'light';
          root.style.setProperty('--safe-bg-alpha', '0.98');
        } else if (luminance < 0.3) {
          luminanceCategory = 'dark';
          root.style.setProperty('--safe-bg-alpha', '0.95');
        } else {
          luminanceCategory = 'medium';
          root.style.setProperty('--safe-bg-alpha', '0.96');
        }
        
        // Set luminance attribute for CSS targeting
        root.setAttribute('data-background-luminance', luminanceCategory);
        root.setAttribute('data-facade-preset', facadePreset);
        
        // Image path not used here; ensure variable is unset
        root.style.removeProperty('--background-image');
      } else {
        // Image background mode - enhanced detection for user-uploaded images
        root.style.removeProperty('--background-gradient');
        
        // Try to detect the actual background image luminance
        const body = document.body;
        const computedStyle = getComputedStyle(body);
        const backgroundImage = computedStyle.backgroundImage;
        
        let detectedLuminance = 0.5;
        let luminanceCategory = 'medium';
        
        if (backgroundImage && backgroundImage !== 'none') {
          try {
            // Extract background image URL for analysis
            const urlMatch = backgroundImage.match(/url\(["']?(.+?)["']?\)/);
            if (urlMatch && urlMatch[1]) {
              // For now, use a simpler approach - check if it's a light or dark theme default
              // TODO: Implement actual image analysis when needed
              const imagePath = urlMatch[1];
              if (imagePath.includes('light') || imagePath.includes('white')) {
                detectedLuminance = 0.8;
              } else if (imagePath.includes('dark') || imagePath.includes('black')) {
                detectedLuminance = 0.2;
              } else {
                detectedLuminance = activeTheme === 'light' ? 0.8 : 0.2;
              }
            }
          } catch (error) {
            console.warn('Failed to analyze background image:', error);
            // Fallback to theme-based detection
            detectedLuminance = activeTheme === 'light' ? 0.8 : 0.2;
          }
        } else {
          // No image detected, use theme default
          detectedLuminance = activeTheme === 'light' ? 0.8 : 0.2;
        }
        
        // Categorize luminance for CSS targeting
        if (detectedLuminance > 0.7) {
          luminanceCategory = 'light';
        } else if (detectedLuminance < 0.3) {
          luminanceCategory = 'dark';
        } else {
          luminanceCategory = 'medium';
        }
        
        // Set adaptive colors based on detected luminance
        const textColors = getAdaptiveTextColors(detectedLuminance, activeTheme === 'dark');
        const safeBgRgb = getSafeBackgroundRGB(detectedLuminance, activeTheme === 'dark');
        
        root.style.setProperty('--text-primary-adaptive', textColors.primary);
        root.style.setProperty('--text-secondary-adaptive', textColors.secondary);
        root.style.setProperty('--text-tertiary-adaptive', textColors.tertiary);
        root.style.setProperty('--text-interactive-adaptive', textColors.interactive);
        root.style.setProperty('--text-high-contrast-adaptive', textColors.highContrast);
        root.style.setProperty('--safe-bg-rgb', safeBgRgb);
        
        // Enhanced safe background alpha based on luminance
        const safeAlpha = detectedLuminance > 0.7 ? '0.98' : detectedLuminance < 0.3 ? '0.95' : '0.96';
        root.style.setProperty('--safe-bg-alpha', safeAlpha);
        
        root.setAttribute('data-background-luminance', luminanceCategory);
        root.removeAttribute('data-facade-preset');
      }
    };

    updateColorsAsync();
  }, [backgroundMode, facadePreset, resolvedTheme, theme]);

  const toggleBackgroundMode = () => {
    setBackgroundMode(prev => prev === 'image' ? 'facade' : 'image');
  };

  const value: BackgroundModeContextType = {
    backgroundMode,
    facadePreset,
    setBackgroundMode,
    setFacadePreset,
    toggleBackgroundMode,
  };

  return (
    <BackgroundModeContext.Provider value={value}>
      {children}
    </BackgroundModeContext.Provider>
  );
}

