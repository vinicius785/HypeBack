import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { I } from "@/components/prototype/ui";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/shared/services/agency-projects";

import { todayInSaoPaulo } from "../project-base";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, formatDate } from "../project-ui";

// ---------------------------------------------------------------------------
// Base: chip que abre um menu pequeno (fecha ao clicar fora, com Esc ou ao escolher)
// ---------------------------------------------------------------------------

interface ChipPopoverProps {
  /** Nome acessível do botão (o texto visível pode ser curto). */
  label: string;
  className?: string;
  data?: Record<string, string | boolean | undefined>;
  content: ReactNode;
  /** Só leitura: o chip vira texto, sem menu. */
  disabled?: boolean;
  /** Largura do menu: padrão 220px. */
  width?: number;
  role?: "group";
  labelledBy?: string;
  children: (close: () => void) => ReactNode;
}

export function ChipPopover({ label, className = "", data, content, disabled, width = 220, role, labelledBy, children }: ChipPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const dataAttrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v === true ? "" : v === false ? undefined : v]));

  if (disabled) {
    return (
      <div className="apj-prop" role={role} aria-labelledby={labelledBy}>
        <span className={`apj-chip ${className}`} {...dataAttrs}>
          {content}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      className="apj-prop"
      role={role}
      aria-labelledby={labelledBy}
      data-adm-layer={open ? "" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button ref={trigger} type="button" className={`apj-chip ${className}`} {...dataAttrs} aria-label={label} aria-haspopup="true" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((v) => !v)}>
        {content}
      </button>
      {open ? (
        <div id={panelId} className="apj-pop2" style={{ width }}>
          {children(() => {
            setOpen(false);
            trigger.current?.focus();
          })}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ checked, onClick, children }: { checked?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={checked ?? false} className="apj-mi" onClick={onClick}>
      {children}
      {checked ? <Check className="ico sm apj-mi-ok" aria-hidden /> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status e prioridade
// ---------------------------------------------------------------------------

export function StatusMenu({ value, readOnly, onChange }: { value: TaskStatus; readOnly: boolean; onChange: (status: TaskStatus) => void }) {
  return (
    <ChipPopover
      label={`Status: ${TASK_STATUS_LABEL[value]}`}
      className="apj-chip-sel"
      data={{ status: value }}
      disabled={readOnly}
      content={
        <>
          <span className="apj-chip-dot" aria-hidden="true" />
          {TASK_STATUS_LABEL[value]}
        </>
      }
    >
      {(close) => (
        <div role="menu" aria-label="Status" className="apj-menu">
          {TASK_STATUSES.map((s) => (
            <MenuItem
              key={s}
              checked={s === value}
              onClick={() => {
                close();
                if (s !== value) onChange(s);
              }}
            >
              <span className="apj-chip-dot" data-status={s} aria-hidden="true" />
              {TASK_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </div>
      )}
    </ChipPopover>
  );
}

export function PriorityMenu({ value, readOnly, onChange }: { value: TaskPriority; readOnly: boolean; onChange: (priority: TaskPriority) => void }) {
  return (
    <ChipPopover
      label={`Prioridade: ${TASK_PRIORITY_LABEL[value]}`}
      className="apj-chip-sel"
      data={{ priority: value }}
      disabled={readOnly}
      content={
        <>
          <I n="flag" cls="sm" />
          {TASK_PRIORITY_LABEL[value]}
        </>
      }
    >
      {(close) => (
        <div role="menu" aria-label="Prioridade" className="apj-menu">
          {[...TASK_PRIORITIES].reverse().map((p) => (
            <MenuItem
              key={p}
              checked={p === value}
              onClick={() => {
                close();
                if (p !== value) onChange(p);
              }}
            >
              <span className="apj-mi-flag" data-priority={p}>
                <I n="flag" cls="sm" />
              </span>
              {TASK_PRIORITY_LABEL[p]}
            </MenuItem>
          ))}
        </div>
      )}
    </ChipPopover>
  );
}

// ---------------------------------------------------------------------------
// Prazo: atalhos + calendário
// ---------------------------------------------------------------------------

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (value: string, days: number) => {
  const d = utc(value);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const dayShort = (value: string) => `${utc(value).getUTCDate()} ${MONTHS[utc(value).getUTCMonth()].slice(0, 3)}`;

export interface DueShortcut {
  key: string;
  label: string;
  date: string;
  hint: string;
}

export function dueShortcuts(today: string): DueShortcut[] {
  const dow = utc(today).getUTCDay();
  const nextMonday = addDaysIso(today, (8 - dow) % 7 || 7);
  const nextSaturday = addDaysIso(today, (6 - dow + 7) % 7 || 7);
  const tomorrow = addDaysIso(today, 1);
  const name = (d: string) => WEEKDAY_NAMES[utc(d).getUTCDay()];
  return [
    { key: "today", label: "Hoje", date: today, hint: name(today) },
    { key: "tomorrow", label: "Amanhã", date: tomorrow, hint: name(tomorrow) },
    { key: "nextweek", label: "Semana que vem", date: nextMonday, hint: name(nextMonday) },
    { key: "weekend", label: "Próximo fim de semana", date: nextSaturday, hint: name(nextSaturday) },
    ...[2, 4, 8].map((w) => ({ key: `w${w}`, label: `${w} semanas`, date: addDaysIso(today, w * 7), hint: dayShort(addDaysIso(today, w * 7)) })),
  ];
}

function Calendar({ value, today, onPick }: { value: string; today: string; onPick: (date: string) => void }) {
  const base = utc(value || today);
  const [view, setView] = useState({ y: base.getUTCFullYear(), m: base.getUTCMonth() });
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const start = addDaysIso(iso(first), -first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
  const move = (delta: number) => setView((v) => {
    const d = new Date(Date.UTC(v.y, v.m + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  return (
    <div className="apj-cal">
      <div className="apj-cal-h">
        <button type="button" aria-label="Mês anterior" onClick={() => move(-1)}>
          <ChevronLeft className="ico sm" aria-hidden />
        </button>
        <b aria-live="polite">
          {MONTHS[view.m][0].toUpperCase() + MONTHS[view.m].slice(1)} {view.y}
        </b>
        <button type="button" aria-label="Próximo mês" onClick={() => move(1)}>
          <ChevronRight className="ico sm" aria-hidden />
        </button>
      </div>
      <div className="apj-cal-g">
        {WEEKDAYS.map((w) => (
          <span key={w} className="apj-cal-w">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const dt = utc(d);
          return (
            <button
              key={d}
              type="button"
              className="apj-cal-d"
              data-out={dt.getUTCMonth() !== view.m || undefined}
              data-today={d === today || undefined}
              data-on={d === value || undefined}
              aria-pressed={d === value}
              aria-label={`${dt.getUTCDate()} de ${MONTHS[dt.getUTCMonth()]} de ${dt.getUTCFullYear()}`}
              onClick={() => onPick(d)}
            >
              {dt.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DueDateMenu({ value, late, readOnly, onChange }: { value: string; late?: boolean; readOnly: boolean; onChange: (date: string) => void }) {
  const today = todayInSaoPaulo();
  return (
    <ChipPopover
      label={`Prazo: ${value ? formatDate(value) : "sem data"}`}
      className="apj-chip-date"
      data={{ empty: !value, late: !!late }}
      disabled={readOnly}
      width={500}
      content={
        <>
          <I n="clock" cls="sm" />
          {value ? formatDate(value) : "Prazo"}
        </>
      }
    >
      {(close) => (
        <div className="apj-due">
          <div className="apj-menu apj-due-l" role="menu" aria-label="Atalhos de prazo">
            {dueShortcuts(today).map((s) => (
              <button
                key={s.key}
                type="button"
                role="menuitem"
                className="apj-mi"
                onClick={() => {
                  onChange(s.date);
                  close();
                }}
              >
                {s.label}
                <small>{s.hint}</small>
              </button>
            ))}
            {value ? (
              <button
                type="button"
                role="menuitem"
                className="apj-mi apj-mi-clear"
                onClick={() => {
                  onChange("");
                  close();
                }}
              >
                Limpar
              </button>
            ) : null}
          </div>
          <Calendar
            value={value}
            today={today}
            onPick={(d) => {
              onChange(d);
              close();
            }}
          />
        </div>
      )}
    </ChipPopover>
  );
}

// ---------------------------------------------------------------------------
// Etiquetas coloridas
// ---------------------------------------------------------------------------

const TAG_COLORS = [
  ["#e0f2fe", "#075985"],
  ["#fde2e8", "#9f1239"],
  ["#d1fae5", "#065f46"],
  ["#ede9fe", "#5b21b6"],
  ["#fef3c7", "#92400e"],
  ["#ffe4d6", "#9a3412"],
] as const;

export function tagColor(tag: string): { "--tg-bg": string; "--tg-fg": string } {
  let h = 0;
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = TAG_COLORS[h % TAG_COLORS.length];
  return { "--tg-bg": bg, "--tg-fg": fg };
}
