'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Glass-styled Tabs component wrapper for liquid-glass aesthetic
 * Provides minimal-space tabs with glass morphism styling
 * Follows specification: docs/__Specifications/13_TabsDesign_specification.md
 */
export function TabsGlass({ 
  defaultValue, 
  value, 
  onValueChange, 
  className,
  children,
  ...props 
}: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col flex-1 min-h-0 min-w-0', className)}
      {...props}
    >
      {children}
    </Tabs>
  )
}

/**
 * Glass-styled TabsList with minimal vertical space and glass styling
 * Specification: rounded-full, px-1.5 py-1, glass-small glass-legible, border border-white/15, flex-1 max-w-3xl
 */
export const TabsListGlass = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center gap-1 rounded-full',
      'px-1 py-0.5',
      'glass-small glass-legible',
      'border border-white/15 bg-slate-900/40',
      'flex-1 max-w-3xl',
      className
    )}
    {...props}
  />
))
TabsListGlass.displayName = 'TabsListGlass'

/**
 * Glass-styled TabsTrigger with glass morphism and minimal space
 * Specification: rounded-full, py-1.5 sm:py-2, px-4 sm:px-6, text-xs sm:text-sm, flex-1 min-w-[90px]
 * Active: bg-white text-slate-900, Inactive: transparent text-slate-700 dark:text-slate-200/80 hover:bg-white/10
 */
export const TabsTriggerGlass = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn(
      'relative flex-1 min-w-[90px]',
      'px-3 sm:px-4',
      'py-1 sm:py-1.5',
      'text-xs sm:text-sm font-medium',
      'rounded-full',
      'transition-colors',
      // Active state: white background with dark text
      'data-[state=active]:bg-white data-[state=active]:text-slate-900',
      // Inactive state: lighter text in light mode, white text in dark mode
      'data-[state=inactive]:text-slate-700',
      'dark:data-[state=inactive]:text-white',
      // Hover state: subtle background change
      'data-[state=inactive]:hover:bg-white/10',
      'dark:data-[state=inactive]:hover:bg-white/5',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
TabsTriggerGlass.displayName = 'TabsTriggerGlass'

/**
 * Glass-styled TabsContent with proper spacing
 * Specification: h-full, mt-0 (critical for minimal spacing), min-w-0, data-[state=inactive]:hidden
 */
export const TabsContentGlass = React.forwardRef<
  React.ElementRef<typeof TabsContent>,
  React.ComponentPropsWithoutRef<typeof TabsContent>
>(({ className, ...props }, ref) => (
  <TabsContent
    ref={ref}
    className={cn(
      'h-full mt-0 min-w-0',
      'ring-offset-background focus-visible:outline-none',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'data-[state=inactive]:hidden',
      className
    )}
    {...props}
  />
))
TabsContentGlass.displayName = 'TabsContentGlass'

