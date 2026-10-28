import { icons } from "lucide-react";

export type IconName = keyof typeof icons;

export function Icon({
  name,
  color,
  size,
  onClick,
  className,
}: {
  name: IconName;
  color: string;
  size: number;
  onClick?: () => void;
  className?: string;
}) {
  const LucideIcon = icons[name];

  return (
    <LucideIcon
      color={color}
      size={size}
      onClick={onClick}
      className={className}
    />
  );
}
