"use client";

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RadixTooltip.Provider delayDuration={250}>{children}</RadixTooltip.Provider>;
}

export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipPortal = RadixTooltip.Portal;
export const TooltipContent = React.forwardRef<HTMLDivElement, RadixTooltip.TooltipContentProps>(
  ({ className, sideOffset = 8, ...props }, ref) => (
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg ${className ?? ""}`}
      {...props}
    />
  ),
);
TooltipContent.displayName = "TooltipContent";
