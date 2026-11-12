import type { ReactNode } from "react";

import type { AdminFilterDef } from "@/components/admin/platform";
import { formatDateRange } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { FinancialPeriodControl } from "./financial-period-control";
import { PERIOD_PRESETS, periodDays, type PeriodPresetId } from "./financial-period";

/** O que cada visão do Financeiro precisa para pôr o período no seu ícone de filtro, dentro da ilha. */
export interface FinancialPeriodBar {
  /** O filtro "Período" (custom): o seletor com atalhos e datas, que só vira chip fora dos 30 dias padrão. */
  filter: AdminFilterDef;
  /** O período em vigor em texto, na barra (antes do ícone de filtro). */
  now: ReactNode;
}

/** Monta o filtro e o texto do período a partir do estado da URL (`useAdminFinancialPeriod`). */
export function buildPeriodBar(period: AdminDateRange, today: string, preset: PeriodPresetId | null, onPeriod: (period: AdminDateRange) => void): FinancialPeriodBar {
  const days = periodDays(period);
  const text = `${formatDateRange(period)} · ${days} ${days === 1 ? "dia" : "dias"}`;
  const defaultRange = PERIOD_PRESETS.find((p) => p.id === "30d")!.range(today);
  return {
    filter: {
      kind: "custom",
      id: "period",
      label: "Período",
      summary: preset === "30d" ? null : `Período: ${text}`,
      onClear: () => onPeriod(defaultRange),
      render: () => <FinancialPeriodControl period={period} today={today} preset={preset} onChange={onPeriod} />,
    },
    now: (
      <span className="isl-period-now" title="Horário de São Paulo">
        <b>Período</b>
        {text}
      </span>
    ),
  };
}
