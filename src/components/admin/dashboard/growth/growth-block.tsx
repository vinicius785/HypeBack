import type { CSSProperties, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminErrorState, AdminInfoPopover, AdminSkeleton } from "@/components/admin/platform";
import { figureTextUnits } from "@/components/admin/platform/admin-figure-card";
import { formatDateTime } from "@/lib/admin/format";
import type { GrowthStamped } from "@/shared/admin-growth.types";

import "@/styles/admin-growth.css";

/**
 * O estado de uma consulta do crescimento: esqueleto enquanto chega (só na primeira vez), erro com "tentar de novo" e,
 * com o dado, o conteúdo. Cada bloco usa o seu: uma consulta que falha não derruba as outras.
 */
export function GrowthBlock<T>({
  query,
  skeletonHeight = 120,
  children,
}: {
  query: UseQueryResult<GrowthStamped<T>, unknown>;
  skeletonHeight?: number;
  children: (data: T, stamp: GrowthStamped<T>) => ReactNode;
}) {
  if (query.isError && !query.data) {
    return <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }
  if (!query.data) {
    return (
      <div aria-busy="true" aria-label="Carregando">
        <AdminSkeleton height={skeletonHeight} radius={16} />
      </div>
    );
  }
  return <>{children(query.data.data, query.data)}</>;
}

/** "Atualizado em 25/11/2026 14:20" (sem `generated_at` não mostra nada). */
export function generatedAtText(stamp: { generated_at: string | null } | undefined): string | null {
  return stamp?.generated_at ? `Atualizado em ${formatDateTime(stamp.generated_at)}` : null;
}

/**
 * Um número com casa decimal ("2,4"), no mesmo visual do `AdminFigureCard` (que só formata inteiros, % e dinheiro).
 * Guarda o texto pronto; o "i" diz a regra.
 */
export function DecimalFigure({ label, value, definition }: { label: string; value: string; definition: string }) {
  return (
    <div className="adm-fig" data-variant="plain">
      <div className="adm-fig-top">
        <span className="adm-fig-label">{label}</span>
        <AdminInfoPopover label={label}>
          <AdminInfoPopover.Paragraph>{definition}</AdminInfoPopover.Paragraph>
        </AdminInfoPopover>
      </div>
      <div className="adm-fig-value" style={{ "--adm-fig-units": figureTextUnits(value) } as CSSProperties}>
        {value}
      </div>
    </div>
  );
}
