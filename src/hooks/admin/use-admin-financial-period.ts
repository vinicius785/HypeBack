import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  detectPreset,
  isDefaultPeriod,
  resolvePeriod,
  type PeriodPresetId,
} from "@/components/admin/financial/financial-period";
import { civilDateInSaoPaulo } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

export interface AdminFinancialPeriodState {
  /** Período efetivo (sempre válido: `from <= to <= hoje`, no máximo 366 dias). É o que vai para a API. */
  period: AdminDateRange;
  /** Hoje em São Paulo (`YYYY-MM-DD`). */
  today: string;
  /** Qual atalho descreve o período; `null` quando é um intervalo personalizado. */
  preset: PeriodPresetId | null;
  /** Grava o período na URL (descarta a página; o padrão sai da URL). */
  setPeriod: (period: AdminDateRange) => void;
}

/**
 * Período do Financeiro (as Atividades usam o mesmo): dias civis de São Paulo, na URL
 * (`?from=2026-10-01&to=2026-10-31`). Recarregar, voltar e compartilhar o link preservam o período; sem
 * parâmetros vale o padrão (30 dias contando hoje). Trocar o período substitui a entrada do histórico e
 * descarta a página (a lista passa a ser outra).
 */
export function useAdminFinancialPeriod(): AdminFinancialPeriodState {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const today = civilDateInSaoPaulo();

  const period = useMemo(() => resolvePeriod({ from: raw.from, to: raw.to }, today), [raw.from, raw.to, today]);
  const preset = useMemo(() => detectPreset(period, today), [period, today]);

  const setPeriod = useCallback(
    (next: AdminDateRange) => {
      navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => {
          const out = { ...prev };
          delete out.page;
          if (isDefaultPeriod(next, civilDateInSaoPaulo())) {
            delete out.from;
            delete out.to;
          } else {
            out.from = next.from;
            out.to = next.to;
          }
          return out;
        }) as never,
        replace: true,
        resetScroll: false,
      } as never);
    },
    [navigate],
  );

  return { period, today, preset, setPeriod };
}
