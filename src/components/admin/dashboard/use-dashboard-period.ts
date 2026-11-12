import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  normalizeCustomRange,
  periodToSearch,
  readPeriodSearch,
  resolvePeriodForDay,
  todayInSaoPaulo,
  type AdminPeriod,
  type AdminPeriodChoice,
  type AdminPeriodSearch,
} from "@/lib/admin/period";

type RawSearch = Record<string, unknown>;

export interface DashboardPeriodState {
  /** O período escolhido já em dias de São Paulo (o que vai para `from`/`to` da API). */
  period: AdminPeriod;
  /** Hoje em São Paulo: as datas do personalizado não passam dele. */
  today: string;
  selectPreset: (choice: AdminPeriodChoice) => void;
  /**
   * Mexe numa ponta do personalizado; a outra acompanha se o intervalo inverter ou passar de 366 dias.
   * A UI (`AdminPeriodSelect`) não emite intervalo inválido, mas o hook segue defendendo: este método normaliza antes
   * de gravar e o que vem da URL (link colado ou editado à mão) é sempre revalidado ao resolver o período.
   */
  setCustomRange: (patch: { from?: string; to?: string }) => void;
}

/** Chaves da URL que este hook gerencia; as demais ficam como estão. */
const PERIOD_KEYS = ["period", "from", "to"] as const;

/**
 * O período do Dashboard **na URL** (`?period=90d`, `?period=custom&from=2026-10-01&to=2026-10-15`): voltar de uma
 * lista para o Dashboard, recarregar e compartilhar o link preservam o período. O padrão (este mês) não aparece na URL.
 * Trocar de período substitui a entrada do histórico (`replace`): cada clique no seletor não vira um "voltar".
 *
 * A rota declara `validateSearch: readPeriodSearch` (de `@/lib/admin/period`); o que vem da URL é sempre revalidado.
 */
export function useDashboardPeriod(): DashboardPeriodState {
  const raw = useSearch({ strict: false }) as RawSearch;
  const navigate = useNavigate();

  const selection = useMemo(() => readPeriodSearch(raw), [raw]);
  // O dia vira à meia-noite de São Paulo: o período acompanha sem a tela precisar recarregar.
  const today = todayInSaoPaulo();
  const period = useMemo(
    () => resolvePeriodForDay({ preset: selection.period, from: selection.from, to: selection.to }, today),
    [selection, today],
  );

  const write = useCallback(
    (next: AdminPeriodSearch) => {
      navigate({
        to: ".",
        // Funcional: parte do que a URL tem *agora* e troca só as chaves do período.
        search: ((prev: RawSearch) => {
          const rest: RawSearch = { ...prev };
          for (const key of PERIOD_KEYS) delete rest[key];
          return { ...rest, ...next };
        }) as never,
        replace: true,
        resetScroll: false,
      } as never);
    },
    [navigate],
  );

  const selectPreset = useCallback(
    (choice: AdminPeriodChoice) => {
      // O personalizado começa pelos dias que a pessoa já está vendo: ela ajusta a partir deles.
      write(periodToSearch({ preset: choice, from: period.from, to: period.to }));
    },
    [write, period.from, period.to],
  );

  const setCustomRange = useCallback(
    (patch: { from?: string; to?: string }) => {
      const next = normalizeCustomRange(
        { from: patch.from ?? period.from, to: patch.to ?? period.to },
        today,
        patch.from !== undefined ? "from" : "to",
      );
      // Datas que não são datas civis (campo apagado ou incompleto): nada é gravado e o período anterior vale.
      if (next) write(periodToSearch({ preset: "custom", ...next }));
    },
    [write, period.from, period.to, today],
  );

  return { period, today, selectPreset, setCustomRange };
}
