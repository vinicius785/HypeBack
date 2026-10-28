import { clsx } from "clsx";

interface ProgressBarProps {
  progressPercentage: number;
  color: string;
}

export function ProgressBar({ progressPercentage, color }: ProgressBarProps) {
  return (
    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
      <div
        className={clsx(
          "h-full rounded-full transition-all duration-300",
          color
        )}
        style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
      />
    </div>
  );
}
