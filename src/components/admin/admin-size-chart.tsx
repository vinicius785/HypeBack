import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from "@/components/admin/platform";
import type {
  AdminCreatorSizeBucket,
  AdminSizeDistributionItem,
} from "@/shared/types";

const SIZE_META: Record<
  AdminCreatorSizeBucket,
  { name: string; range: string; color: string }
> = {
  ugc: { name: "UGC", range: "menos de 1 mil", color: "#ececec" },
  nano: { name: "Nano", range: "1 a 10 mil", color: "#d9d9d9" },
  micro: { name: "Micro", range: "10 a 100 mil", color: "#9e2cfa" },
  mid: { name: "Médio", range: "100 a 500 mil", color: "#050505" },
  macro: { name: "Macro", range: "500 mil a 1 mi", color: "#7e7e7e" },
  mega: { name: "Mega", range: "mais de 1 mi", color: "#c58bf7" },
};

const SIZE_ORDER: AdminCreatorSizeBucket[] = [
  "ugc",
  "nano",
  "micro",
  "mid",
  "macro",
  "mega",
];

const NUM = new Intl.NumberFormat("pt-BR");
const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

interface AdminSizeChartProps {
  data: AdminSizeDistributionItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  /** Com ele o estado de erro oferece "Tentar de novo". */
  onRetry?: () => void;
  retrying?: boolean;
}

export function AdminSizeChart({
  data,
  isLoading,
  isError,
  onRetry,
  retrying,
}: AdminSizeChartProps) {
  const rows = SIZE_ORDER.map((bucket) => {
    const item = data?.find((d) => d.bucket === bucket);
    return {
      bucket,
      count: item?.count ?? 0,
      pct: item?.percentage ?? 0,
      ...SIZE_META[bucket],
    };
  });
  const total = rows.reduce((a, r) => a + r.count, 0);

  if (isLoading) {
    return <AdminListSkeleton rows={4} ariaLabel="Carregando tamanhos…" />;
  }
  if (isError) {
    return (
      <AdminErrorState
        compact
        title="Não foi possível carregar"
        message="Tente novamente em instantes."
        onRetry={onRetry}
        retrying={retrying}
      />
    );
  }
  if (!data || total === 0) {
    return (
      <AdminEmptyState
        compact
        icon="chart"
        title="Sem dados ainda"
        description="Nenhum criador classificado por tamanho no período."
      />
    );
  }

  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = rows.map((r) => {
    const len = (r.pct / 100) * C;
    const el = (
      <circle
        key={r.bucket}
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke={r.color}
        strokeWidth="26"
        strokeDasharray={`${Math.max(0, len - 4)} ${C}`}
        strokeDashoffset={(-acc * C) / 100}
        transform="rotate(-90 100 100)"
      />
    );
    acc += r.pct;
    return el;
  });

  return (
    <div className="adx-dn">
      <div className="adx-dc">
        {/* decorativo: os mesmos números estão na lista ao lado */}
        <svg viewBox="0 0 200 200" aria-hidden="true">
          {arcs}
        </svg>
        <div>
          <b>{NUM.format(total)}</b>
          <small>criadores</small>
        </div>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.bucket}>
            <i style={{ background: r.color }} />
            <div>
              <b>{r.name}</b>
              <small>{r.range}</small>
            </div>
            <em>{PCT.format(r.pct)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
