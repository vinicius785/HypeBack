import { useState } from "react";

import { AdminSegmentedControl, type AdminFilterOption } from "@/components/admin/platform";
import { formatDateRange } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { adjustCustomRange, PERIOD_MAX_DAYS, PERIOD_PRESETS, periodDays, type PeriodPresetId } from "./financial-period";

import "@/styles/admin-financial.css";

const CUSTOM = "custom";

const OPTIONS: readonly AdminFilterOption[] = [
  ...PERIOD_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
  { value: CUSTOM, label: "Personalizado" },
];

interface FinancialPeriodSelectProps {
  /** Período efetivo (já validado: `useAdminFinancialPeriod().period`). */
  period: AdminDateRange;
  /** Hoje em São Paulo: limite das datas e base dos atalhos. */
  today: string;
  /** Atalho que descreve o período; `null` = intervalo personalizado. */
  preset: PeriodPresetId | null;
  onChange: (period: AdminDateRange) => void;
}

/**
 * Seletor de período: atalhos em dias de São Paulo (7, 30 e 90 dias, este mês, mês passado, este ano) e um
 * intervalo personalizado (de/até, no máximo 366 dias, nunca depois de hoje). Mostra sempre as datas que
 * valem, por extenso, para ninguém ter de adivinhar o que "30 dias" quer dizer.
 *
 * Quem decide o período é a URL (`useAdminFinancialPeriod`): este componente só pede a troca.
 */
export function FinancialPeriodSelect({ period, today, preset, onChange }: FinancialPeriodSelectProps) {
  // "Personalizado" fica aberto enquanto a pessoa mexe nas datas, mesmo que elas coincidam com um atalho.
  const [customOpen, setCustomOpen] = useState(preset === null);
  const custom = customOpen || preset === null;
  const days = periodDays(period);

  const pick = (value: string) => {
    if (value === CUSTOM) {
      setCustomOpen(true);
      return;
    }
    const target = PERIOD_PRESETS.find((p) => p.id === value);
    if (!target) return;
    setCustomOpen(false);
    onChange(target.range(today));
  };

  return (
    <div className="adm-fin-period">
      <div className="adm-fin-period-row">
        <AdminSegmentedControl options={OPTIONS} value={custom ? CUSTOM : (preset as string)} onChange={pick} ariaLabel="Período" />
        {custom ? (
          <div className="adm-daterange" role="group" aria-label="Período personalizado">
            <input
              type="date"
              value={period.from}
              max={today}
              aria-label="Período: a partir de"
              onChange={(event) => {
                // Campo apagado à mão: o período anterior continua valendo.
                if (event.target.value) onChange(adjustCustomRange({ from: event.target.value }, period, today));
              }}
            />
            <span className="adm-daterange-sep" aria-hidden="true">
              –
            </span>
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={today}
              aria-label="Período: até"
              onChange={(event) => {
                if (event.target.value) onChange(adjustCustomRange({ to: event.target.value }, period, today));
              }}
            />
          </div>
        ) : null}
      </div>
      <p className="adm-fin-period-range">
        <b>{formatDateRange(period)}</b>
        <span>
          {days} {days === 1 ? "dia" : "dias"} · horário de São Paulo
          {custom ? ` · no máximo ${PERIOD_MAX_DAYS} dias` : ""}
        </span>
      </p>
    </div>
  );
}
