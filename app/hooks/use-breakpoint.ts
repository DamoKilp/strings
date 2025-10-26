"use client"

import * as React from "react"
import { BREAKPOINTS } from "@/lib/ui-constants"

type BreakpointKey = keyof typeof BREAKPOINTS

export function useBreakpoint() {
  const [width, setWidth] = React.useState<number | undefined>(undefined)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const isAtLeast = React.useCallback((bp: BreakpointKey) => {
    if (!mounted || typeof window === "undefined") return false
    return window.innerWidth >= BREAKPOINTS[bp]
  }, [mounted])

  return {
    width: mounted ? (width ?? 0) : 0,
    isSmUp: mounted ? isAtLeast("sm") : false,
    isMdUp: mounted ? isAtLeast("md") : false,
    isLgUp: mounted ? isAtLeast("lg") : false,
    isXlUp: mounted ? isAtLeast("xl") : false,
    is2xlUp: mounted ? isAtLeast("2xl") : false,
  }
}

export function useIsMobile() {
  const { isMdUp, width } = useBreakpoint()
  // During SSR, assume desktop to match most server rendering
  if (width === 0) return false
  return !isMdUp
}





