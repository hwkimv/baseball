import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "outline";
};

const base =
    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium";
const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-slate-700/90 text-white",
    secondary: "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30",
    outline: "bg-transparent text-slate-200 border border-slate-600",
};

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
    return <div className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
