import { cn } from "@/lib/utils"

/// Skeleton component
/// This component is used to create a placeholder for loading states.
/// It uses Tailwind CSS for styling and accepts any HTML attributes.
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
