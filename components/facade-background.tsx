"use client";

import { useTheme } from 'next-themes';
import { useMemo } from 'react';
// framer-motion overlays removed
import { useBackgroundMode } from './contexts/BackgroundModeContext';

interface FacadeBackgroundProps {
  className?: string;
}

export function FacadeBackground({ className: _className = '' }: FacadeBackgroundProps) {
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
            rgba(180, 166, 252, 0.85) 0%, 
            rgba(165, 153, 251, 0.75) 20%,
            rgba(147, 139, 249, 0.65) 50%,
            rgba(129, 125, 247, 0.55) 100%)`,
          secondary: `
            radial-gradient(circle at 40% 60%, rgba(99, 102, 241, 0.45), transparent 55%),
            radial-gradient(circle at 60% 40%, rgba(139, 92, 246, 0.35), transparent 58%)`
        },
        dark: {
          primary: `linear-gradient(135deg, 
            rgba(75, 63, 120, 0.82) 0%, 
            rgba(90, 75, 135, 0.72) 20%,
            rgba(105, 87, 150, 0.62) 50%,
            rgba(120, 99, 165, 0.52) 100%)`,
          secondary: `
            radial-gradient(circle at 25% 75%, rgba(99, 102, 241, 0.50), transparent 55%),
            radial-gradient(circle at 75% 25%, rgba(139, 92, 246, 0.40), transparent 58%)`
        }
      },
      'purple-dream': {
        light: {
          primary: `linear-gradient(135deg, 
            rgba(196, 181, 253, 0.80) 0%, 
            rgba(180, 166, 252, 0.68) 30%,
            rgba(165, 153, 251, 0.56) 60%,
            rgba(147, 139, 249, 0.45) 100%)`,
          secondary: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.28), transparent 72%),
            radial-gradient(circle at 25% 75%, rgba(167, 139, 250, 0.20), transparent 65%)`
        },
        dark: {
          primary: `linear-gradient(135deg, 
            rgba(90, 75, 135, 0.78) 0%, 
            rgba(105, 87, 150, 0.66) 30%,
            rgba(120, 99, 165, 0.54) 60%,
            rgba(135, 111, 180, 0.42) 100%)`,
          secondary: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.42), transparent 65%),
            radial-gradient(circle at 30% 70%, rgba(167, 139, 250, 0.32), transparent 58%)`
        }
      },
      midnight: {
        light: {
          primary: `
            radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.28), transparent 55%),
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.26), transparent 55%),
            radial-gradient(1200px 600px at 50% -10%, rgba(168, 85, 247, 0.18), transparent 60%),
            linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(51, 65, 85, 0.96) 45%, rgba(71, 85, 105, 0.94) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.35), transparent 68%),
            radial-gradient(circle at 30% 70%, rgba(168, 85, 247, 0.25), transparent 65%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.35), transparent 52%),
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.32), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(168, 85, 247, 0.22), transparent 58%),
            linear-gradient(135deg, rgba(10, 18, 35, 0.98) 0%, rgba(21, 31, 50, 0.98) 35%, rgba(36, 49, 72, 0.98) 70%, rgba(53, 64, 88, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.55), transparent 55%),
            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.45), transparent 55%)`
        }
      },
      ocean: {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.35), transparent 58%),
            radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.35), transparent 58%),
            radial-gradient(1000px 500px at 50% -10%, rgba(16, 185, 129, 0.18), transparent 60%),
            linear-gradient(135deg, rgba(186, 230, 253, 0.98) 0%, rgba(165, 243, 252, 0.96) 50%, rgba(167, 243, 208, 0.94) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.45), transparent 62%),
            radial-gradient(circle at 70% 30%, rgba(20, 184, 166, 0.3), transparent 62%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.35), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.45), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(6, 182, 212, 0.22), transparent 58%),
            linear-gradient(135deg, rgba(23, 49, 120, 0.95) 0%, rgba(34, 74, 146, 0.95) 35%, rgba(41, 102, 149, 0.95) 70%, rgba(36, 99, 177, 0.95) 100%)
          `,
          secondary: `
            radial-gradient(circle at 25% 75%, rgba(59, 130, 246, 0.6), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(16, 185, 129, 0.45), transparent 52%)`
        }
      },
      lavender: {
        light: {
          primary: `
            radial-gradient(circle at 30% 70%, rgba(244, 114, 182, 0.35), transparent 58%),
            radial-gradient(circle at 70% 30%, rgba(167, 139, 250, 0.45), transparent 58%),
            radial-gradient(1000px 500px at 50% -10%, rgba(236, 72, 153, 0.2), transparent 65%),
            linear-gradient(135deg, rgba(243, 232, 255, 0.98) 0%, rgba(233, 213, 255, 0.96) 35%, rgba(221, 189, 255, 0.94) 65%, rgba(209, 165, 255, 0.92) 100%)
          `,
          secondary: `
            radial-gradient(circle at 40% 60%, rgba(167, 139, 250, 0.5), transparent 58%),
            radial-gradient(circle at 60% 40%, rgba(244, 114, 182, 0.25), transparent 58%)`
        },
        dark: {
          primary: `
            radial-gradient(circle at 30% 70%, rgba(244, 114, 182, 0.35), transparent 50%),
            radial-gradient(circle at 75% 25%, rgba(167, 139, 250, 0.6), transparent 50%),
            radial-gradient(1200px 600px at 50% -10%, rgba(236, 72, 153, 0.3), transparent 55%),
            linear-gradient(135deg, rgba(67, 55, 110, 0.96) 0%, rgba(92, 76, 145, 0.96) 35%, rgba(110, 89, 160, 0.96) 65%, rgba(124, 99, 172, 0.96) 100%)
          `,
          secondary: `
            radial-gradient(circle at 35% 65%, rgba(167, 139, 250, 0.6), transparent 48%),
            radial-gradient(circle at 65% 35%, rgba(236, 72, 153, 0.35), transparent 48%)`
        }
      }
      ,
      'boring-white': {
        light: {
          primary: `
            radial-gradient(900px 450px at 50% -10%, rgba(99, 102, 241, 0.10), transparent 60%),
            radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.08), transparent 58%),
            radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.08), transparent 58%),
            radial-gradient(1200px 600px at 50% 110%, rgba(15, 23, 42, 0.06), transparent 68%),
            linear-gradient(135deg, rgba(246, 248, 255, 0.98) 0%, rgba(236, 241, 252, 0.98) 50%, rgba(226, 232, 240, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(59, 130, 246, 0.10), transparent 62%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.08), transparent 62%)
          `
        },
        dark: {
          primary: `
            radial-gradient(900px 450px at 50% -10%, rgba(99, 102, 241, 0.08), transparent 62%),
            radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.06), transparent 58%),
            radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.06), transparent 58%),
            linear-gradient(135deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.98) 50%, rgba(229, 231, 235, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(59, 130, 246, 0.08), transparent 65%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.07), transparent 65%)
          `
        }
      },
      'boring-black': {
        light: {
          primary: `
            radial-gradient(1000px 500px at 50% -10%, rgba(99, 102, 241, 0.12), transparent 58%),
            radial-gradient(circle at 80% 25%, rgba(139, 92, 246, 0.10), transparent 56%),
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.08), transparent 56%),
            linear-gradient(135deg, rgba(9, 9, 11, 0.98) 0%, rgba(17, 24, 39, 0.98) 45%, rgba(2, 6, 23, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.12), transparent 55%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.12), transparent 55%)
          `
        },
        dark: {
          primary: `
            radial-gradient(1200px 600px at 50% -10%, rgba(99, 102, 241, 0.16), transparent 54%),
            radial-gradient(circle at 80% 25%, rgba(139, 92, 246, 0.14), transparent 52%),
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.12), transparent 52%),
            linear-gradient(135deg, rgba(5, 6, 13, 0.98) 0%, rgba(12, 18, 32, 0.98) 38%, rgba(2, 6, 23, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 60% 40%, rgba(99, 102, 241, 0.16), transparent 50%),
            radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.16), transparent 50%)
          `
        }
      },
      'sunset-triad': {
        light: {
          primary: `
            radial-gradient(circle at 15% 85%, rgba(245, 158, 11, 0.42), transparent 56%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.36), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(59, 130, 246, 0.34), transparent 58%),
            linear-gradient(135deg, rgba(255, 237, 213, 0.93) 0%, rgba(221, 214, 254, 0.92) 45%, rgba(191, 219, 254, 0.91) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(245, 158, 11, 0.40), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(168, 85, 247, 0.32), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.30), transparent 60%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 15% 85%, rgba(180, 83, 9, 0.38), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(126, 34, 206, 0.34), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(29, 78, 216, 0.30), transparent 58%),
            linear-gradient(135deg, rgba(20, 24, 45, 0.98) 0%, rgba(28, 22, 45, 0.98) 45%, rgba(14, 23, 52, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(180, 83, 9, 0.44), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.36), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(29, 78, 216, 0.34), transparent 56%)
          `
        }
      },
      'aurora-triad': {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.42), transparent 56%),
            radial-gradient(circle at 75% 25%, rgba(167, 139, 250, 0.40), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(244, 114, 182, 0.34), transparent 60%),
            linear-gradient(135deg, rgba(209, 250, 229, 0.93) 0%, rgba(237, 233, 254, 0.92) 45%, rgba(252, 231, 243, 0.91) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.42), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(167, 139, 250, 0.38), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.32), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(13, 148, 136, 0.38), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(124, 58, 237, 0.36), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(219, 39, 119, 0.30), transparent 58%),
            linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 27, 75, 0.98) 45%, rgba(31, 41, 55, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(13, 148, 136, 0.44), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.40), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(219, 39, 119, 0.34), transparent 56%)
          `
        }
      },
      'tropical-triad': {
        light: {
          primary: `
            radial-gradient(circle at 25% 75%, rgba(34, 197, 94, 0.40), transparent 56%),
            radial-gradient(circle at 75% 25%, rgba(20, 184, 166, 0.38), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(245, 158, 11, 0.34), transparent 60%),
            linear-gradient(135deg, rgba(220, 252, 231, 0.93) 0%, rgba(204, 251, 241, 0.92) 45%, rgba(254, 243, 199, 0.91) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(34, 197, 94, 0.40), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(20, 184, 166, 0.36), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.32), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 25% 75%, rgba(22, 163, 74, 0.38), transparent 52%),
            radial-gradient(circle at 75% 25%, rgba(15, 118, 110, 0.36), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(180, 83, 9, 0.30), transparent 58%),
            linear-gradient(135deg, rgba(7, 29, 42, 0.98) 0%, rgba(8, 43, 52, 0.98) 45%, rgba(28, 33, 42, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(22, 163, 74, 0.44), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(15, 118, 110, 0.40), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(180, 83, 9, 0.34), transparent 56%)
          `
        }
      },
      'cosmic-triad': {
        light: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.40), transparent 56%),
            radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.38), transparent 56%),
            radial-gradient(1000px 500px at 50% -10%, rgba(59, 130, 246, 0.34), transparent 60%),
            linear-gradient(135deg, rgba(224, 231, 255, 0.93) 0%, rgba(237, 233, 254, 0.92) 45%, rgba(219, 234, 254, 0.91) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(99, 102, 241, 0.40), transparent 55%),
            radial-gradient(circle at 70% 30%, rgba(147, 51, 234, 0.36), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.32), transparent 58%)
          `
        },
        dark: {
          primary: `
            radial-gradient(circle at 20% 80%, rgba(79, 70, 229, 0.38), transparent 52%),
            radial-gradient(circle at 80% 20%, rgba(109, 40, 217, 0.36), transparent 52%),
            radial-gradient(1200px 600px at 50% -10%, rgba(37, 99, 235, 0.30), transparent 58%),
            linear-gradient(135deg, rgba(12, 17, 45, 0.98) 0%, rgba(20, 19, 54, 0.98) 45%, rgba(13, 23, 62, 0.98) 100%)
          `,
          secondary: `
            radial-gradient(circle at 30% 70%, rgba(79, 70, 229, 0.44), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(109, 40, 217, 0.40), transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.34), transparent 56%)
          `
        }
      }
    };

    const preset = presets[facadePreset as keyof typeof presets] || presets['intense'];
    const themeStyles = (activeTheme === 'dark' ? preset.dark : preset.light);
    
    return themeStyles;
  };

  const facadeStyles = getFacadeStyles();

  return (
    <>
      {/* Primary Facade Layer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -10,
          background: facadeStyles.primary,
          opacity: 1,
          transition: 'all 0.8s ease-in-out',
          pointerEvents: 'none',
        }}
      />

  {/* Secondary overlays and accents removed to ensure only the theme background is visible */}
    </>
  );
}

