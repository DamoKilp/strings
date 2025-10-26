// /components/ui/doc-tooltip.tsx
import React from "react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface DocTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export function DocTooltip({ content, children, placement = "top" }: DocTooltipProps) {
  const side = placement as "top" | "right" | "bottom" | "left";
  
  // Ensure that TooltipTrigger (with asChild) receives a single valid DOM element.
  // If children is a single valid element that is not a React.Fragment, use it directly.
  // Otherwise, wrap children in a <span> to avoid passing invalid props to a React.Fragment.
  let triggerChild;
  if (React.Children.count(children) === 1 && React.isValidElement(children) && children.type !== React.Fragment) {
    triggerChild = children;
  } else {
    triggerChild = <span>{children}</span>;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {triggerChild}
        </TooltipTrigger>
        <TooltipContent side={side}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}