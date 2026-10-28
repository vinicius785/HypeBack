import { Badge } from "@/components/ui/badge";
import type { LiveStatus } from "@/shared/types";

/** Metadados visuais por status — tokens do tema, sem hex literais. */
export const LIVE_STATUS_META: Record<
  LiveStatus,
  { label: string; bg: string; text: string }
> = {
  live: { label: "Ao vivo", bg: "bg-red-100", text: "text-red-700" },
  upcoming: { label: "Agendada", bg: "bg-primary-100", text: "text-primary-700" },
  ended: { label: "Encerrada", bg: "bg-neutral-200", text: "text-neutral-700" },
  cancelled: { label: "Cancelada", bg: "bg-neutral-100", text: "text-neutral-500" },
};

interface LiveStatusBadgeProps {
  status: LiveStatus;
}

export function LiveStatusBadge({ status }: LiveStatusBadgeProps) {
  const meta = LIVE_STATUS_META[status];
  return (
    <div className="flex items-center gap-1.5">
      {status === "live" && (
        <span
          className="size-2 animate-pulse rounded-full bg-red-600"
          aria-hidden
        />
      )}
      <Badge text={meta.label} backgroundColor={meta.bg} textColor={meta.text} />
    </div>
  );
}
