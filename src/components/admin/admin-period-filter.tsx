import { useCallback, useLayoutEffect, useRef } from "react";

import {
  addDays,
  formatDateForInput,
} from "@/shared/utils/date-validations";
import type { AdminPeriod } from "@/shared/types";

export type AdminPeriodPreset =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "custom";

interface PresetDef {
  id: AdminPeriodPreset;
  label: string;
  /** Dias para trás a partir de hoje. `undefined` em "custom". */
  daysBack?: number;
}

const PRESETS: PresetDef[] = [
  { id: "7d", label: "7 dias", daysBack: 7 },
  { id: "30d", label: "30 dias", daysBack: 30 },
  { id: "90d", label: "90 dias", daysBack: 90 },
  { id: "6m", label: "6 meses", daysBack: 180 },
  { id: "1y", label: "Este ano", daysBack: 365 },
  { id: "custom", label: "Personalizado" },
];

export function computePeriodFromPreset(
  preset: AdminPeriodPreset,
): AdminPeriod | null {
  const def = PRESETS.find((p) => p.id === preset);
  if (!def || def.daysBack == null) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    from: formatDateForInput(addDays(today, -def.daysBack)),
    to: formatDateForInput(today),
  };
}

/** Segmentado `.seg` do protótipo com indicador deslizante. */
export function AdminSeg<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const moveInd = useCallback(() => {
    const on = segRef.current?.querySelector<HTMLElement>("button.on");
    const ind = indRef.current;
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }, []);
  useLayoutEffect(() => {
    moveInd();
    window.addEventListener("resize", moveInd);
    return () => window.removeEventListener("resize", moveInd);
  }, [moveInd, value]);

  return (
    <div className={`seg ${className}`.trim()} ref={segRef}>
      <i className="ind" ref={indRef} />
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={value === it.id ? "on" : ""}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

interface AdminPeriodFilterProps {
  period: AdminPeriod;
  preset: AdminPeriodPreset;
  onChange: (period: AdminPeriod, preset: AdminPeriodPreset) => void;
}

const DATE_STYLE: React.CSSProperties = {
  height: 42,
  border: 0,
  borderRadius: 999,
  background: "#fff",
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  color: "var(--ink)",
};

export function AdminPeriodFilter({
  period,
  preset,
  onChange,
}: AdminPeriodFilterProps) {
  const handlePresetChange = (next: AdminPeriodPreset) => {
    if (next === "custom") {
      onChange(period, "custom");
      return;
    }
    const computed = computePeriodFromPreset(next);
    if (computed) onChange(computed, next);
  };

  const handleFromChange = (from: string) => {
    if (!from) return;
    const safeTo = from > period.to ? from : period.to;
    onChange({ from, to: safeTo }, "custom");
  };

  const handleToChange = (to: string) => {
    if (!to) return;
    const safeFrom = to < period.from ? to : period.from;
    onChange({ from: safeFrom, to }, "custom");
  };

  return (
    <div className="btns" style={{ flexWrap: "wrap" }}>
      {preset === "custom" && (
        <>
          <input
            type="date"
            aria-label="De"
            style={DATE_STYLE}
            value={period.from}
            max={period.to}
            onChange={(e) => handleFromChange(e.target.value)}
          />
          <input
            type="date"
            aria-label="Até"
            style={DATE_STYLE}
            value={period.to}
            min={period.from}
            onChange={(e) => handleToChange(e.target.value)}
          />
        </>
      )}
      <AdminSeg
        items={PRESETS}
        value={preset}
        onChange={handlePresetChange}
      />
    </div>
  );
}
