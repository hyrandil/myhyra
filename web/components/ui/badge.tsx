import * as React from "react";
import { cn } from "../../lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger";
};

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => (
  <span
    ref={ref}
    className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", variantStyles[variant], className)}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
