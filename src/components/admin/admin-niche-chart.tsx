import { I } from "@/components/prototype/ui";
import type { AdminNicheDistributionItem } from "@/shared/types";

interface AdminNicheChartProps {
  data: AdminNicheDistributionItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
}

const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function AdminNicheChart({
  data,
  isLoading,
  isError,
}: AdminNicheChartProps) {
  if (isLoading) {
    return <div className="adx-nl" style={{ opacity: 0.4 }}>Carregando…</div>;
  }
  if (isError || !data || data.length === 0) {
    return (
      <div className="empty">
        <span className="ei">
          <I n="chart" />
        </span>
        <b>{isError ? "Não foi possível carregar" : "Sem dados ainda"}</b>
        <p>
          {isError
            ? "Tente novamente em instantes."
            : "Nenhum nicho cadastrado pelos criadores no período."}
        </p>
      </div>
    );
  }
  const mx = Math.max(...data.map((d) => d.percentage), 0.0001);
  return (
    <div className="adx-nl">
      {data.map((d, i) => (
        <div
          className="adx-nr"
          key={d.niche_id}
          style={{ "--k": i } as React.CSSProperties}
        >
          <span>{d.niche_name}</span>
          <div>
            <i style={{ width: `${(d.percentage / mx) * 100}%` }} />
          </div>
          <b>{PCT.format(d.percentage)}%</b>
        </div>
      ))}
    </div>
  );
}
