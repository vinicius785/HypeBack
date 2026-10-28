function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface LiveMetricsProps {
  views: number;
  likes: number;
  /** Maior nº de espectadores visto nesta sessão (live no ar). */
  peak?: number;
  /** Mostra duração quando a live já encerrou. */
  durationSeconds?: number | null;
  isLive?: boolean;
}

/** Faixa `lvs-m` do protótipo: Assistindo · Curtidas · Pico (ou Duração). */
export function LiveMetrics({
  views,
  likes,
  peak,
  durationSeconds,
  isLive,
}: LiveMetricsProps) {
  return (
    <div className="lvs-m">
      <Metric
        label={isLive ? "Assistindo" : "Espectadores"}
        value={views.toLocaleString("pt-BR")}
      />
      <Metric label="Curtidas" value={likes.toLocaleString("pt-BR")} />
      {durationSeconds != null ? (
        <Metric label="Duração" value={formatDuration(durationSeconds)} />
      ) : (
        isLive && <Metric label="Pico" value={(peak ?? views).toLocaleString("pt-BR")} />
      )}
    </div>
  );
}
