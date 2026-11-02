import { useState } from "react";

import { AdminSegmentedControl } from "@/components/admin/platform";
import { civilDateInSaoPaulo, formatDateRange } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { detectPreset, periodError, presetRange, type PeriodPreset } from "./workspace-format";

import "@/styles/admin-workspaces.css";

const OPTIONS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
] as const;

interface WorkspacePeriodSelectorProps {
  value: AdminDateRange;
  onChange: (range: AdminDateRange) => void;
}

/**
 * Período da aba Financeiro, em dias civis de São Paulo (`to` inclusivo, no máximo 366 dias, nunca depois de
 * hoje). Atalhos de 7, 30 e 90 dias contando hoje ou um intervalo personalizado: o intervalo digitado só vale
 * quando é válido (senão o aviso aparece e o período anterior continua valendo).
 */
export function WorkspacePeriodSelector({ value, onChange }: WorkspacePeriodSelectorProps) {
  const today = civilDateInSaoPaulo();
  const preset = detectPreset(value, today);
  const [custom, setCustom] = useState(preset === null);
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const error = custom ? periodError(draft, today) : null;

  const pick = (next: string) => {
    if (next === "custom") {
      setCustom(true);
      setDraft({ from: value.from, to: value.to });
      return;
    }
    setCustom(false);
    onChange(presetRange(next as PeriodPreset, today));
  };

  const edit = (patch: Partial<{ from: string; to: string }>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (periodError(next, today) === null) onChange(next);
  };

  return (
    <div className="adm-workspaces-period">
      <AdminSegmentedControl
        ariaLabel="Período"
        options={OPTIONS}
        value={custom ? "custom" : (preset ?? "custom")}
        onChange={pick}
      />
      {custom ? (
        <div className="adm-workspaces-dates" role="group" aria-label="Período personalizado">
          <input
            type="date"
            aria-label="Período: a partir de"
            value={draft.from}
            max={draft.to || today}
            onChange={(event) => edit({ from: event.target.value })}
          />
          <span aria-hidden="true">–</span>
          <input
            type="date"
            aria-label="Período: até"
            value={draft.to}
            min={draft.from || undefined}
            max={today}
            onChange={(event) => edit({ to: event.target.value })}
          />
        </div>
      ) : null}
      {error ? (
        <p className="adm-workspaces-quiet" data-error="true" role="alert">
          {error}
        </p>
      ) : (
        <p className="adm-workspaces-quiet">Dias de São Paulo · {formatDateRange(value)}</p>
      )}
    </div>
  );
}
