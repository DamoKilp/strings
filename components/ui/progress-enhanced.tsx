// /components/ui/progress-enhanced.tsx
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const ProgressEnhanced = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorColor?: string;
    showValue?: boolean;
    animate?: boolean;
  }
>(({ className, value = 0, indicatorColor, showValue = false, animate = true, ...props }, ref) => (
  <div className="relative w-full">
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          animate ? "animate-pulse-subtle" : "",
          indicatorColor || "bg-primary"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
    {showValue && (
      <span className="absolute right-2 top-0 text-xs font-medium text-primary-foreground">
        {Math.round(value || 0)}%
      </span>
    )}
  </div>
));
ProgressEnhanced.displayName = "ProgressEnhanced";

export { ProgressEnhanced };