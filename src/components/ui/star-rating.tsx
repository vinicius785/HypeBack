import { useState } from "react";

import { Icon } from "@/components/ui/icon";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
}

/**
 * Rating de 1–5 estrelas. Em modo `readonly`, desliga hover e clique.
 * Cor amarela (#eab308) para estrelas preenchidas, cinza neutro para vazias.
 */
export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 24,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hovered || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={readonly ? "cursor-default" : "cursor-pointer"}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          >
            <Icon
              name="Star"
              size={size}
              color={filled ? "#eab308" : "#d4d4d4"}
              className={filled ? "fill-[#eab308]" : "fill-[#d4d4d4]"}
            />
          </button>
        );
      })}
    </div>
  );
}
