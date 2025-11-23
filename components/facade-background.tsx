"use client";

import { useTheme } from 'next-themes';
import { useMemo } from 'react';
// framer-motion overlays removed
import { useBackgroundMode } from './contexts/BackgroundModeContext';

interface FacadeBackgroundProps {
  className?: string;
}

export function FacadeBackground({ className = '' }: FacadeBackgroundProps) {
  const { theme, resolvedTheme } = useTheme();
  const { facadePreset } = useBackgroundMode();
  // Hydration-safe theme resolution: avoid setState in effects
  const activeTheme = useMemo(() => (resolvedTheme || theme || 'light'), [resolvedTheme, theme]);

  // Facade preset definitions with theme variations
  const getFacadeStyles = () => {
    const presets = {
      
      intense: {
        light: {
          primary: `linear-gradient(135deg, 
            rgba(180, 166, 252, 0.35) 0%, 
            rgba(165, 153, 251, 0.30) 20%,
            rgba(147, 139, 249, 0.25) 50%,
            rgba(129, 125, 247, 0.20) 100%)`,
          secondary: `
            radial-gradient(circle at 40% 60%, rgba(99, 102, 241, 0.20), transparent 55%),
            radial-gradient(circle at 60% 40%, rgba(139, 92, 246, 0.15), transparent 58%)`
        },
        dark: {
          primary: `linear-gradient(135deg, 
            rgba(75, 63, 120, 0.35) 0%, 
            rgba(90, 75, 135, 0.30) 20%,
            rgba(105, 87, 150, 0.25) 50%,
            rgba(120, 99, 165, 0.20) 100%)`,
          secondary: `
            radial-gradient(circle at 25% 75%, rgba(99, 102, 241, 0.25), transparent 55%),
            radial-gradient(circle at 75% 25%, rgba(139, 92, 246, 0.20), transparent 58%)`
        }
      },
      'purple-dream': {
        light: {
          primary: `linear-gradient(135deg, 
            rgba(196, 181, 253, 0.30) 0%, 
            rgba(180, 166, 252, 0.25) 30%,
            rgba(165, 153, 251, 0.20) 60%,
            rgba(147, 139, 249, 0.15) 100%)`,
          secondary: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15), transparent 72%),
            radial-gradient(circle at 25% 75%, rgba(167, 139, 250, 0.10), transparent 65%)`
        },
        dark: {
          primary: `linear-gradient(135deg, 
            rgba(90, 75, 135, 0.30) 0%, 
            rgba(105, 87, 150, 0.25) 30%,
            rgba(120, 99, 165, 0.20) 60%,
            rgba(135, 111, 180, 0.15) 100%)`,
          secondary: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.20), transparent 65%),
            radial-gradient(circle at 30% 70%, rgba(167, 139, 250, 0.15), transparent 58%)`
        }
      },
      midnight: {
        light: {
          primary: `
            radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.15), transparent 55%),
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.13), transparent 55%),
            radial-gradient(1200px 600px at 50% -10%, rgba(168, 85, 247, 0.10), transparent 60%),
            linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(51, 65, 85, 0.80) 45%, rgba(71, 85, 105, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.18), transparent 68%),
            radial-gradient(circle at 30% 70%, rgba(168, 85, 247, 0.12), transparent 65%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.18), transparent 52%),
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.16), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(168, 85, 247, 0.12), transparent 58%),
            linear-gradient(135deg, rgba(10, 18, 35, 0.85) 0%, rgba(21, 31, 50, 0.85) 35%, rgba(36, 49, 72, 0.85) 70%, rgba(53, 64, 88, 0.85) 100%)
          `,
          secondary: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.28), transparent 55%),
            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.22), transparent 55%)`
        }
      },
      ocean: {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.18), transparent 58%),
            radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.18), transparent 58%),
            radial-gradient(1000px 500px at 50% -10%, rgba(16, 185, 129, 0.10), transparent 60%),
            linear-gradient(135deg, rgba(186, 230, 253, 0.75) 0%, rgba(165, 243, 252, 0.70) 50%, rgba(167, 243, 208, 0.65) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.22), transparent 62%),
            radial-gradient(circle at 70% 30%, rgba(20, 184, 166, 0.15), transparent 62%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.18), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.22), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(6, 182, 212, 0.12), transparent 58%),
            linear-gradient(135deg, rgba(23, 49, 120, 0.75) 0%, rgba(34, 74, 146, 0.75) 35%, rgba(41, 102, 149, 0.75) 70%, rgba(36, 99, 177, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.30), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(16, 185, 129, 0.22), transparent 52%)`
        }
      },
      lavender: {
        light: {
          primary: `
            radial-gradient(circle at 30% 70%, rgba(244, 114, 182, 0.18), transparent 58%),
            radial-gradient(circle at 70% 30%, rgba(167, 139, 250, 0.22), transparent 58%),
            radial-gradient(1000px 500px at 50% -10%, rgba(236, 72, 153, 0.10), transparent 65%),
            linear-gradient(135deg, rgba(243, 232, 255, 0.75) 0%, rgba(233, 213, 255, 0.70) 35%, rgba(221, 189, 255, 0.65) 65%, rgba(209, 165, 255, 0.60) 100%)
          `,
          secondary: `
            radial-gradient(circle at 40% 60%, rgba(167, 139, 250, 0.25), transparent 58%),
            radial-gradient(circle at 60% 40%, rgba(244, 114, 182, 0.12), transparent 58%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 30% 70%, rgba(244, 114, 182, 0.18), transparent 50%),
            radial-gradient(circle at 75% 25%, rgba(167, 139, 250, 0.30), transparent 50%),
            radial-gradient(1200px 600px at 50% -10%, rgba(236, 72, 153, 0.15), transparent 55%),
            linear-gradient(135deg, rgba(67, 55, 110, 0.75) 0%, rgba(92, 76, 145, 0.75) 35%, rgba(110, 89, 160, 0.75) 65%, rgba(124, 99, 172, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 35% 65%, rgba(167, 139, 250, 0.30), transparent 48%),
            radial-gradient(circle at 65% 35%, rgba(236, 72, 153, 0.18), transparent 48%)`
        }
      }
      ,
      'boring-white': {
        light: {
          primary: `
            radial-gradient(900px 450px at 50% -10%, rgba(99, 102, 241, 0.05), transparent 60%),
            radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.04), transparent 58%),
            radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.04), transparent 58%),
            radial-gradient(1200px 600px at 50% 110%, rgba(15, 23, 42, 0.03), transparent 68%),
            linear-gradient(135deg, rgba(246, 248, 255, 0.75) 0%, rgba(236, 241, 252, 0.75) 50%, rgba(226, 232, 240, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(59, 130, 246, 0.05), transparent 62%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.04), transparent 62%)
          `
        },
        dark: {
          primary: `
            radial-gradient(900px 450px at 50% -10%, rgba(99, 102, 241, 0.04), transparent 62%),
            radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.03), transparent 58%),
            radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.03), transparent 58%),
            linear-gradient(135deg, rgba(248, 250, 252, 0.75) 0%, rgba(241, 245, 249, 0.75) 50%, rgba(229, 231, 235, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(59, 130, 246, 0.04), transparent 65%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.035), transparent 65%)
          `
        }
      },
      'boring-black': {
        light: {
          primary: `
            radial-gradient(1000px 500px at 50% -10%, rgba(99, 102, 241, 0.06), transparent 58%),
            radial-gradient(circle at 80% 25%, rgba(139, 92, 246, 0.05), transparent 56%),
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.04), transparent 56%),
            linear-gradient(135deg, rgba(9, 9, 11, 0.85) 0%, rgba(17, 24, 39, 0.85) 45%, rgba(2, 6, 23, 0.85) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.06), transparent 55%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.06), transparent 55%)
          `
        },
        dark: {
          primary: `
            radial-gradient(1200px 600px at 50% -10%, rgba(99, 102, 241, 0.08), transparent 54%),
            radial-gradient(circle at 80% 25%, rgba(139, 92, 246, 0.07), transparent 52%),
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.06), transparent 52%),
            linear-gradient(135deg, rgba(5, 6, 13, 0.85) 0%, rgba(12, 18, 32, 0.85) 38%, rgba(2, 6, 23, 0.85) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.08), transparent 50%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.08), transparent 50%)
          `
        }
      },
      'sunset-triad': {
        light: {
          primary: `
            radial-gradient(circle at 15% 85%, rgba(245, 158, 11, 0.21), transparent 56%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.18), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(59, 130, 246, 0.17), transparent 58%),
            linear-gradient(135deg, rgba(255, 237, 213, 0.70) 0%, rgba(221, 214, 254, 0.68) 45%, rgba(191, 219, 254, 0.66) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(245, 158, 11, 0.20), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(168, 85, 247, 0.16), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15), transparent 60%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 15% 85%, rgba(180, 83, 9, 0.19), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(126, 34, 206, 0.17), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(29, 78, 216, 0.15), transparent 58%),
            linear-gradient(135deg, rgba(20, 24, 45, 0.75) 0%, rgba(28, 22, 45, 0.75) 45%, rgba(14, 23, 52, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(180, 83, 9, 0.22), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.18), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(29, 78, 216, 0.17), transparent 56%)
          `
        }
      },
      'aurora-triad': {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.21), transparent 56%),
            radial-gradient(circle at 75% 25%, rgba(167, 139, 250, 0.20), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(244, 114, 182, 0.17), transparent 60%),
            linear-gradient(135deg, rgba(209, 250, 229, 0.70) 0%, rgba(237, 233, 254, 0.68) 45%, rgba(252, 231, 243, 0.66) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.21), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(167, 139, 250, 0.19), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.16), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(13, 148, 136, 0.19), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(124, 58, 237, 0.18), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(219, 39, 119, 0.15), transparent 58%),
            linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 27, 75, 0.75) 45%, rgba(31, 41, 55, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(13, 148, 136, 0.22), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.20), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(219, 39, 119, 0.17), transparent 56%)
          `
        }
      },
      'tropical-triad': {
        light: {
          primary: `
            radial-gradient(circle at 25% 75%, rgba(34, 197, 94, 0.20), transparent 56%),
            radial-gradient(circle at 75% 25%, rgba(20, 184, 166, 0.19), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(245, 158, 11, 0.17), transparent 60%),
            linear-gradient(135deg, rgba(220, 252, 231, 0.70) 0%, rgba(204, 251, 241, 0.68) 45%, rgba(254, 243, 199, 0.66) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(34, 197, 94, 0.20), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(20, 184, 166, 0.18), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.16), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 25% 75%, rgba(22, 163, 74, 0.19), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(15, 118, 110, 0.18), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(180, 83, 9, 0.15), transparent 58%),
            linear-gradient(135deg, rgba(7, 29, 42, 0.75) 0%, rgba(8, 43, 52, 0.75) 45%, rgba(28, 33, 42, 0.75) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(22, 163, 74, 0.22), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(15, 118, 110, 0.20), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(180, 83, 9, 0.17), transparent 56%)
          `
        }
      },
      'cosmic-triad': {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.20), transparent 56%),
            radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.19), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(59, 130, 246, 0.17), transparent 60%),
            linear-gradient(135deg, rgba(224, 231, 255, 0.70) 0%, rgba(237, 233, 254, 0.68) 45%, rgba(219, 234, 254, 0.10) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(99, 102, 241, 0.20), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(147, 51, 234, 0.18), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.16), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(79, 70, 229, 0.19), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(109, 40, 217, 0.18), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(37, 99, 235, 0.15), transparent 58%),
            linear-gradient(135deg, rgba(12, 17, 45, 0.75) 0%, rgba(20, 19, 54, 0.75) 45%, rgba(13, 23, 62, 0.10) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(79, 70, 229, 0.22), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(109, 40, 217, 0.20), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.17), transparent 56%)
          `
        }
      }
    };

    const preset = presets[facadePreset as keyof typeof presets] || presets['intense'];
    const themeStyles = (activeTheme === 'dark' ? preset.dark : preset.light);
    
    return themeStyles;
  };

  const facadeStyles = getFacadeStyles();

  // Dark base layer for dark mode - ensures much darker backdrop
  // Use consistent style object with consistent formatting to prevent hydration mismatches
  const darkBaseStyle = useMemo(() => ({
    position: 'fixed' as const,
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    zIndex: -11, // Behind the gradient layer
    background: 'rgba(5, 5, 10, 1)', // Very dark base color
    pointerEvents: 'none' as const,
  }), []);

  // Use consistent style object with consistent formatting to prevent hydration mismatches
  const style = useMemo(() => ({
    position: 'fixed' as const,
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    zIndex: -10,
    background: facadeStyles.primary,
    opacity: 1,
    transition: 'all 0.8s ease-in-out',
    pointerEvents: 'none' as const,
  }), [facadeStyles.primary]);

  // Always render the same structure on both server and client to prevent hydration mismatches
  // The dark base layer is always rendered but only visible in dark mode
  // Use suppressHydrationWarning for style props that may differ due to theme resolution
  const darkBaseStyleWithVisibility = useMemo(() => ({
    ...darkBaseStyle,
    opacity: activeTheme === 'dark' ? 1 : 0,
  }), [activeTheme, darkBaseStyle]);

  return (
    <>
      {/* Dark base layer - always rendered, visible only in dark mode */}
      <div 
        style={darkBaseStyleWithVisibility}
        suppressHydrationWarning
        aria-hidden="true"
      />
      {/* Primary Facade Layer */}
      <div
        className={className}
        style={style}
        suppressHydrationWarning
        aria-hidden="true"
      />
    </>
  );
}

