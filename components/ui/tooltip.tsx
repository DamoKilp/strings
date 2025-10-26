// /components/ui/tooltip.tsx
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// Optional provider—wrap your app (or subtree) so all tooltips share the same context.
export const TooltipProvider = TooltipPrimitive.Provider;

// The root component: wrap Trigger + Content in this.
export const Tooltip = TooltipPrimitive.Root;

// The trigger element: usually asChild around an icon or text.
export const TooltipTrigger = TooltipPrimitive.Trigger;

// The actual content popup, with arrow and animations.
export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"];
    sideOffset?: number;
  }
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[12000] max-w-xs overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2",
        "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
        className
      )}
      style={{
        // Force the highest z-index to ensure tooltip is always visible
        zIndex: 12000,
        position: 'fixed',
        // Ensure the tooltip escapes any overflow constraints
        isolation: 'isolate'
      }}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-popover" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
