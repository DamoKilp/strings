// /src/components/ui/control-button.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PauseIcon, StopIcon, PlayIcon } from "@radix-ui/react-icons";

type ControlButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "pause" | "stop" | "play";
  size?: "sm" | "md" | "lg";
  isActive?: boolean;
};

const ControlButton = React.forwardRef<HTMLButtonElement, ControlButtonProps>(
  ({ className, variant, size = "md", isActive = false, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };

    const getIcon = () => {
      switch (variant) {
        case "pause":
          return <PauseIcon className="h-4 w-4" />;
        case "stop":
          return <StopIcon className="h-4 w-4" />;
        case "play":
          return <PlayIcon className="h-4 w-4" />;
        default:
          return null;
      }
    };

    const getVariantClasses = () => {
      switch (variant) {
        case "pause":
          return isActive
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-amber-100 hover:bg-amber-200 text-amber-700";
        case "stop":
          return isActive
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-red-100 hover:bg-red-200 text-red-700";
        case "play":
          return isActive
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-green-100 hover:bg-green-200 text-green-700";
        default:
          return "";
      }
    };

    return (
      <Button
        ref={ref}
        type="button"
        className={cn(
          "rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center",
          sizeClasses[size],
          getVariantClasses(),
          className
        )}
        {...props}
      >
        {getIcon()}
      </Button>
    );
  }
);
ControlButton.displayName = "ControlButton";

export { ControlButton };