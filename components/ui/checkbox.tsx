"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => {
  const base = "peer relative h-4 w-4 shrink-0 rounded-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  // Important variants override glass classes with !important
  const importantState = "group !bg-transparent !border-red-500 !text-red-400 data-[state=checked]:!bg-emerald-600 data-[state=checked]:!border-emerald-500 data-[state=checked]:!text-white data-[state=unchecked]:!bg-transparent data-[state=unchecked]:!border-red-500 data-[state=unchecked]:!text-red-400";

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(base, importantState, className)}
      {...props}
    >
      {/* Checked indicator: green tick */}
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}> 
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
      {/* Unchecked indicator: red cross (hidden when checked via data-state) */}
  <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-red-400 group-data-[state=checked]:hidden">
        <X className="h-3.5 w-3.5" />
      </span>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
