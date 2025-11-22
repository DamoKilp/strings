import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBackgroundMode } from '@/components/contexts/BackgroundModeContext';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface GlassStyleOptions {
  intensity?: 'minimal' | 'medium' | 'enhanced';
  context?: 'dialog' | 'sidebar' | 'card' | 'button' | 'input';
  adaptToBackground?: boolean;
  className?: string;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
  };
}

/**
 * Universal Glass Hook for applying liquid glass styles
 * Automatically adapts to user's background choice and theme
 */
export const useGlassStyles = ({
  intensity = 'medium',
  context = 'card',
  adaptToBackground = true,
  className = ''
}: GlassStyleOptions = {}) => {
  // Destructure to subscribe to context changes (needed for reactivity)
  // Values are intentionally unused - we only need the subscription
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { backgroundMode: _backgroundMode, facadePreset: _facadePreset } = useBackgroundMode();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resolvedTheme: _resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration safety pattern: set mounted state after initial render
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return useMemo(() => {
    if (!mounted) return { className: 'glass-loading', style: {} };

    const baseClasses = {
      minimal: 'glass-material-small',
      medium: 'glass-material-medium', 
      enhanced: 'glass-material-large'
    };

    const contextClasses = {
      dialog: 'glass-dialog-large',
      sidebar: 'glass-material-large',
      card: 'glass-card',
      button: 'glass-button',
      input: 'glass-input'
    };

    const glassClass = contextClasses[context] || baseClasses[intensity];
    
    return {
      className: cn(glassClass, className),
      style: adaptToBackground ? {} : { 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(16px) saturate(130%)'
      }
    };
  }, [mounted, intensity, context, adaptToBackground, className]);
};

/**
 * Performance Optimized Glass Effects Hook
 * Detects device capabilities and adjusts glass effects accordingly
 */
export function usePerformanceOptimizedGlass() {
  const [supportsBackdropFilter, setSupportsBackdropFilter] = useState(true);
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);
  const [deviceMemory, setDeviceMemory] = useState<number | undefined>();

  useEffect(() => {
    // Check backdrop-filter support
    // Initialization effect: detect browser capabilities on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const testElement = document.createElement('div');
    testElement.style.backdropFilter = 'blur(1px)';
    setSupportsBackdropFilter(testElement.style.backdropFilter !== '');

    // Check device capabilities
    const nav = navigator as NavigatorWithMemory;
    if (nav.deviceMemory) {
      setDeviceMemory(nav.deviceMemory);
      setIsLowPowerMode(nav.deviceMemory < 4);
    }

    // Check connection type
    if (nav.connection) {
      const connection = nav.connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        setIsLowPowerMode(true);
      }
    }
  }, []);

  const getOptimizedGlassClasses = useCallback((baseClass: string) => {
    if (!supportsBackdropFilter) {
      return `${baseClass}-fallback`;
    }
    
    if (isLowPowerMode) {
      return `${baseClass}-performance`;
    }
    
    return baseClass;
  }, [supportsBackdropFilter, isLowPowerMode]);

  return {
    supportsBackdropFilter,
    isLowPowerMode,
    deviceMemory,
    getOptimizedGlassClasses
  };
}

/**
 * Glass Performance Monitoring Hook
 * Monitors performance of glass effects for optimization
 */
export function useGlassPerformanceMonitoring() {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('glass') && entry.duration > 16) {
          console.warn(`Glass effect performance issue: ${entry.name} took ${entry.duration}ms`);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, []);
}

/**
 * Typography Scale Hook
 * Returns appropriate typography class based on context
 */
export function useGlassTypography(level: 'large-title' | 'title-1' | 'title-2' | 'title-3' | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption-1' | 'caption-2') {
  return `glass-text-${level}`;
}

/**
 * Safe Background Hook
 * Returns styles for text areas that must be readable regardless of background
 */
export function useSafeBackground(variant: 'background' | 'subtle' | 'minimal' = 'background') {
  return `text-safe-${variant}`;
}
