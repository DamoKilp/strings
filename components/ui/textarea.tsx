// /components/ui/textarea.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

// Use a type alias instead of an empty interface extension to satisfy eslint
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

  // This is a Textarea component that can be used in forms or other UI elements.
// It accepts all the standard textarea attributes and applies some default styles.
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background/60 dark:bg-background/40 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };