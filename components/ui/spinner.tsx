// /components/ui/spinner.tsx

import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "lg";
}

export function Spinner({ className, size = "sm", ...props }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent",
        size === "sm" ? "h-4 w-4" : "h-8 w-8",
        className
      )}
      {...props}
    />
  );
}