// /app/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { UI_HEIGHTS } from "@/lib/ui-constants"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        glass: "bg-transparent border border-white/20 text-foreground hover:bg-white/10 hover:border-white/30",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        select: "bg-background border border-input hover:bg-accent hover:text-accent-foreground px-3 py-1.5 text-sm rounded-md",
        icon: "h-7 w-7 rounded-full p-0 flex items-center justify-center",
        model: "flex items-center gap-1.5 text-xs font-medium py-1 px-2 rounded-md"
      },
      size: {
        default: "h-7 px-3 py-1", // Further reduced from h-8
        xs: "h-7 rounded-md text-xs px-2.5", // Add this line
        sm: `${UI_HEIGHTS.button.sm} rounded-md px-2 py-0.5`,
        lg: `${UI_HEIGHTS.button.lg} rounded-md px-6`,
        icon: "h-7 w-7", // Reduced from h-8 w-8
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Ensure buttons inside forms do not submit by default.
    // Only apply default type when rendering a native <button>.
    const { type, ...restProps } = props as React.ButtonHTMLAttributes<HTMLButtonElement>
    const resolvedType = asChild ? undefined : (type ?? 'button')

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? restProps : { type: resolvedType as any, ...restProps })}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }