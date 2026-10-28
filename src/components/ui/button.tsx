import type { ComponentProps } from "react";

import { clsx } from "clsx";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: "default" | "outline" | "ghost";
}

const variantStyles = {
  default: "bg-neutral-950 hover:bg-primary-600 text-white",
  outline:
    "bg-white hover:bg-neutral-50 text-neutral-950",
  ghost: "bg-transparent hover:bg-neutral-100 text-neutral-700",
};

export function Button({
  children,
  variant = "default",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "h-[46px] rounded-full flex items-center justify-center gap-2 px-6 font-bold text-sm transition-all duration-150 active:scale-[0.97] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
