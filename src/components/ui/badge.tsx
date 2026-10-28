import type { ComponentProps } from "react";

import { clsx } from "clsx";

interface BadgeProps extends ComponentProps<"div"> {
  text: string;
  backgroundColor: string;
  textColor: string;
}

export function Badge({
  text,
  backgroundColor,
  textColor,
  ...props
}: BadgeProps) {
  // Garantir que text seja sempre uma string
  const displayText = typeof text === 'string' ? text : String(text || '');
  
  return (
    <div
      className={clsx("w-fit px-2.5 py-1 rounded-full text-xs font-medium", backgroundColor, textColor)}
      {...props}
    >
      {displayText}
    </div>
  );
}
