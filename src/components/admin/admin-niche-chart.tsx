import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from "@/components/admin/platform";
import type { AdminNicheDistributionItem } from "@/shared/types";

interface AdminNicheChartProps {
  data: AdminNicheDistributionItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  /** Com ele o estado de erro oferece "Tentar de novo". */
  onRetry?: () => void;
  retrying?: boolean;
}

const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function AdminNicheChart({
  data,
  isLoading,
  isError,
  onRetry,
  retrying,
}: AdminNicheChartProps) {
  if (isLoading) {
    return <AdminListSkeleton rows={4} ariaLabel="Carregando nichos…" />;
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
  if (!data || data.length === 0) {
    return (
      <AdminEmptyState
        compact
        icon="chart"
        title="Sem dados ainda"
        description="Nenhum nicho cadastrado pelos criadores no período."
      />
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
