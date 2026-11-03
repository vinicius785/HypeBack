import { ADMIN_PERIOD_CUSTOM, AdminPeriodSelect, type AdminPeriodChange } from "@/components/admin/platform";
import { formatDateRange } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { PERIOD_MAX_DAYS, PERIOD_PRESETS, periodDays, type PeriodPresetId } from "./financial-period";

const PRESET_OPTIONS = PERIOD_PRESETS.map(({ id, label }) => ({ id, label }));

interface FinancialPeriodControlProps {
  /** Período efetivo (já validado: `useAdminFinancialPeriod().period`). */
  period: AdminDateRange;
  /** Hoje em São Paulo: limite das datas e base dos atalhos. */
  today: string;
  /** Atalho que descreve o período; `null` = intervalo personalizado. */
  preset: PeriodPresetId | null;
  onChange: (period: AdminDateRange) => void;
}

/**
 * Seletor de período do Financeiro e das Atividades: adaptador fino do `AdminPeriodSelect` sobre as regras de
 * `financial-period.ts` (atalhos em dias de São Paulo, intervalo livre de no máximo 366 dias e nunca depois de
 * hoje). O kit só apresenta e valida o intervalo digitado; quem decide o período é a URL (`useAdminFinancialPeriod`)
 * e este componente só pede a troca. Sob o seletor, as datas que valem, por extenso.
 */
export function FinancialPeriodControl({ period, today, preset, onChange }: FinancialPeriodControlProps) {
  const days = periodDays(period);

  const pick = (next: AdminPeriodChange) => {
    if (next.preset === ADMIN_PERIOD_CUSTOM) {
      // Abrir o "Personalizado" manda o período de agora (nada muda); depois só chegam intervalos válidos.
      if (next.from && next.to && (next.from !== period.from || next.to !== period.to)) onChange({ from: next.from, to: next.to });
      return;
    }
    const target = PERIOD_PRESETS.find((p) => p.id === next.preset);
    if (target) onChange(target.range(today));
  };

  return (
    <AdminPeriodSelect
      compact
      presets={PRESET_OPTIONS}
      value={{ preset, from: period.from, to: period.to }}
      onChange={pick}
      custom={{ max: today, maxDays: PERIOD_MAX_DAYS }}
      summary={
        <>
          <b>{formatDateRange(period)}</b>{" "}
          <span>
            {days} {days === 1 ? "dia" : "dias"} · horário de São Paulo
            {preset === null ? ` · no máximo ${PERIOD_MAX_DAYS} dias` : ""}
          </span>
        </>
      }
    />
  );
}
