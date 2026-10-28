import { useEffect, useState, type ComponentProps } from "react";

import { clsx } from "clsx";
import { getUploadUrl } from "@/lib/utils/api";

interface AvatarProps extends Omit<ComponentProps<"img">, "src"> {
  src?: string;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}

const sizeStyles = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-14 h-14",
  "2xl": "w-16 h-16",
  "3xl": "w-18 h-18",
  "4xl": "w-20 h-20",
};

export function Avatar({ src, alt, size = "md", ...props }: AvatarProps) {
  // Normalizar a URL da imagem usando getUploadUrl
  const normalizedSrc = src ? getUploadUrl(src) : undefined;
  const [broken, setBroken] = useState(false);

  // Nova URL → tenta carregar de novo (limpa erro anterior).
  useEffect(() => {
    setBroken(false);
  }, [normalizedSrc]);

  return (
    <div
      className={clsx(
        "rounded-full bg-neutral-200 overflow-hidden border-2 border-neutral-200",
        sizeStyles[size]
      )}
    >
      {normalizedSrc && !broken ? (
        <img
          src={normalizedSrc}
          alt={alt}
          {...props}
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-200">
          <span className="text-neutral-950 text-xs font-medium">
            {alt.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
