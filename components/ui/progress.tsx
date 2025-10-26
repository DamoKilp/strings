import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    variant?: "default" | "success" | "destructive"
    indicatorClassName?: string
  }
>(({ className, value, variant = "default", indicatorClassName, ...props }, ref) => {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const variants = {
    default: "bg-primary",
    success: "bg-green-500",
    destructive: "bg-destructive",
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-transform duration-300 ease-in-out",
          variants[variant],
          isVisible ? "opacity-100" : "opacity-0",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {/* Animated gradient overlay */}
        <div 
          className={cn(
            "absolute inset-0 opacity-50",
            "bg-gradient-to-r from-transparent via-white to-transparent",
            "animate-shimmer"
          )} 
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }