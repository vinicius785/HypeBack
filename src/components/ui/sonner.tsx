"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  CircleAlert,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-600" />,
        info: <InfoIcon className="size-4 text-neutral-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <CircleAlert className="size-4 text-neutral-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-neutral-500" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-neutral-50)",
          "--normal-text": "var(--color-neutral-700)",
          "--normal-border": "var(--color-neutral-200)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
