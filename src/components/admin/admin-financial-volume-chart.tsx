import { I } from "@/components/prototype/ui";
import type { AdminFinancialStats } from "@/shared/types";

const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Moeda compacta do protótipo: "R$ 1,5 mi", "R$ 182 mil", "R$ 950". */
export function formatAdminMoney(v: number): string {
  if (v >= 1e6)
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `R$ ${NUM.format(v / 1e3)} mil`;
  return `R$ ${NUM.format(v)}`;
}

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Rótulo curto do bucket (YYYY-MM → "mar"; YYYY-MM-DD → "05/03"). */
export function formatAdminBucket(bucket: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(bucket);
  if (!m) return bucket;
  if (m[3]) return `${m[3]}/${m[2]}`;
  return MONTHS[Number(m[2]) - 1] ?? bucket;
}

export interface AdminBarPoint {
  label: string;
  value: number;
}

/** Barras SVG do protótipo (`.adx-ch`), alimentadas só por dados reais. */
export function AdminBarChart({
  points,
  money,
  isLoading,
  isError,
}: {
  points: AdminBarPoint[];
  money?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return <div className="adx-ch" style={{ opacity: 0.4 }}>Carregando…</div>;
  }
  if (isError || points.length === 0) {
    return (
      <div className="empty">
        <span className="ei">
          <I n="chart" />
        </span>
        <b>{isError ? "Não foi possível carregar" : "Sem dados ainda"}</b>
        <p>
          {isError
            ? "Tente novamente em instantes."
            : "Nada registrado no período selecionado."}
        </p>
      </div>
    );
  }
  const W = 760;
  const H = 240;
  const pad = 6;
  const step = (W - pad * 2) / points.length;
  const bw = Math.max(6, Math.min(46, step - 14));
  const mx = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="adx-ch">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {points.map((p, i) => {
          const h = Math.max(8, (p.value / mx) * (H - 36));
          const x = pad + step * i + (step - bw) / 2;
          return (
            <g
              key={i}
              className={`adx-b ${i === points.length - 1 ? "on" : ""}`}
              style={{ "--k": i } as React.CSSProperties}
            >
              <rect
                x={x}
                y={H - h}
                width={bw}
                height={h}
                rx={Math.min(14, bw / 2)}
              />
              <text x={x + bw / 2} y={H - h - 10} textAnchor="middle">
                {money ? formatAdminMoney(p.value) : NUM.format(p.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="adx-lb">
        {points.map((p, i) => (
          <span key={i} style={{ left: `${((pad + step * i + step / 2) / W) * 100}%` }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function volumePoints(
  data: AdminFinancialStats["volume_series"] | undefined,
): AdminBarPoint[] {
  return (data ?? []).map((d) => ({
    label: formatAdminBucket(d.bucket),
    value: d.deposits + d.payments,
  }));
}

interface AdminFinancialVolumeChartProps {
  data: AdminFinancialStats["volume_series"] | undefined;
  isLoading?: boolean;
  isError?: boolean;
}

export function AdminFinancialVolumeChart({
  data,
  isLoading,
  isError,
}: AdminFinancialVolumeChartProps) {
  return (
    <AdminBarChart
      points={volumePoints(data)}
      money
      isLoading={isLoading}
      isError={isError}
    />
  );
}
