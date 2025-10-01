import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "secondary" | "outline";
};

const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition border";
const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default: "bg-emerald-600 text-white border-emerald-600 hover:opacity-90",
    secondary: "bg-slate-700 text-white border-slate-700 hover:bg-slate-600",
    outline: "bg-transparent text-slate-100 border-slate-600 hover:bg-slate-800/50",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`${base} ${variants[variant]} ${className}`}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export default Button;
