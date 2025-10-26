// app/lib/ui-constants.ts
export const UI_HEIGHTS = {
    controlElement: "h-7",
    controlElementPx: "28px", // For cases where pixel values are needed
    button: {
      sm: "h-6",
      default: "h-7",
      lg: "h-9"
    },
    input: "h-7",
    select: "h-7"
  }

// Tailwind-aligned breakpoints (single source of truth for JS/TS)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536
} as const

// Convenience device groupings built from Tailwind breakpoints
export const DEVICE_BREAKPOINTS = {
  mobile: 0,                  // < md
  tablet: BREAKPOINTS.md,     // >= md
  desktop: BREAKPOINTS.lg     // >= lg
} as const