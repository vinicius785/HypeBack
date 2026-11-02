import { AdminSegmentedControl } from "@/components/admin/platform";
import {
  describePeriod,
  formatPeriodRange,
  MAX_PERIOD_DAYS,
  PERIOD_OPTIONS,
  type AdminPeriod,
  type AdminPeriodChoice,
} from "@/lib/admin/period";

import "@/styles/admin-dashboard.css";

interface DashboardPeriodSelectorProps {
  period: AdminPeriod;
  /** Hoje em São Paulo: as datas do personalizado não passam dele. */
  today: string;
  onSelectPreset: (choice: AdminPeriodChoice) => void;
  /** Mexeu numa ponta do personalizado (`from` ou `to`). */
  onChangeRange: (patch: { from?: string; to?: string }) => void;
}

/**
 * Período do Dashboard: predefinidos em controle segmentado e, no "Personalizado", as duas datas. Embaixo, uma linha
 * discreta diz os dias que valem e que são dias de São Paulo.
 */
export function DashboardPeriodSelector({ period, today, onSelectPreset, onChangeRange }: DashboardPeriodSelectorProps) {
  const custom = period.preset === "custom";
  return (
    <div className="adm-dash-period">
      <AdminSegmentedControl
        ariaLabel="Período"
        options={PERIOD_OPTIONS}
        value={period.preset}
        onChange={(value) => onSelectPreset(value as AdminPeriodChoice)}
      />

      {custom ? (
        <div className="adm-dash-range" role="group" aria-label="Período personalizado">
          <span className="adm-dash-range-k">De</span>
          <input
            type="date"
            value={period.from}
            max={today}
            aria-label="Início do período"
            onChange={(event) => onChangeRange({ from: event.target.value })}
          />
          <span className="adm-dash-range-sep" aria-hidden="true">
            –
          </span>
          <span className="adm-dash-range-k">até</span>
          <input
            type="date"
            value={period.to}
            max={today}
            aria-label="Fim do período"
            onChange={(event) => onChangeRange({ to: event.target.value })}
          />
        </div>
      ) : null}

      <p className="adm-dash-period-note" title={describePeriod(period)} aria-live="polite">
        {custom ? `Dias de São Paulo · até ${MAX_PERIOD_DAYS} dias` : `${formatPeriodRange(period)} · Dias de São Paulo`}
      </p>
    </div>
  );
}
