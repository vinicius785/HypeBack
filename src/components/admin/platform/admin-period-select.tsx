import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useSlidingIndicator } from "@/hooks/admin/use-sliding-indicator";
import { formatCivilDate } from "@/lib/admin/format";

import "@/styles/admin-kit-period-select.css";

/** Id reservado do "Personalizado": `value.preset` e `onChange` usam este texto para o intervalo livre. */
export const ADMIN_PERIOD_CUSTOM = "custom";

/** Um atalho do seletor ("7 dias", "Este mês"). O cálculo das datas fica com quem usa (os hooks de período). */
export interface AdminPeriodPresetOption {
  id: string;
  label: string;
}

/** O que está valendo. `preset` é o id de um atalho, `ADMIN_PERIOD_CUSTOM` ou `null` (= intervalo livre). */
export interface AdminPeriodValue {
  preset: string | null;
  /** Datas civis `YYYY-MM-DD` (o formato do contrato). Só o "Personalizado" as usa. */
  from?: string;
  to?: string;
}

/**
 * O que a pessoa pediu. Atalho: só `preset`. "Personalizado": `preset: 'custom'` com as datas
 * (ao abrir o "Personalizado" vão as do período atual, se houver; depois só vão intervalos VÁLIDOS).
 */
export interface AdminPeriodChange {
  preset: string;
  from?: string;
  to?: string;
}

/** Limites do intervalo livre. Datas no formato `YYYY-MM-DD`. Passe `{}` para aceitar qualquer intervalo ordenado. */
export interface AdminPeriodCustomConfig {
  /** Texto do botão (padrão "Personalizado"). */
  label?: string;
  /** Primeira data aceita. */
  min?: string;
  /** Última data aceita (normalmente "hoje" em São Paulo). */
  max?: string;
  /** Máximo de dias contando as duas pontas (o contrato do Admin usa 366). */
  maxDays?: number;
}

export interface AdminPeriodSelectProps {
  presets: readonly AdminPeriodPresetOption[];
  value: AdminPeriodValue;
  onChange: (next: AdminPeriodChange) => void;
  /** Aceita intervalo livre (campos De/Até). Sem isto só existem os atalhos. */
  custom?: AdminPeriodCustomConfig;
  /** Linha de apoio sob o seletor (o intervalo por extenso, o fuso, o limite de dias). Anunciada quando muda: fica numa região viva (`<div aria-live>`, sempre renderizada, vazia sem texto), então aceita blocos e um `AdminInfoPopover`. */
  summary?: ReactNode;
  /** Mais enxuto, para caber ao lado de outras ações no cabeçalho. */
  compact?: boolean;
  /** Nome do grupo para leitor de tela (padrão "Período"). */
  ariaLabel?: string;
  disabled?: boolean;
}

const DAY_MS = 86_400_000;

function civilMs(civil: string): number {
  const [year, month, day] = civil.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isCompleteCivil(civil: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(civil) && Number(civil.slice(0, 4)) >= 1000;
}

/**
 * Valida um intervalo livre e devolve a mensagem para a pessoa (ou `null` quando vale).
 * A ordem das mensagens é a do que ela precisa corrigir primeiro: faltou data, ordem, limites, tamanho.
 */
export function adminPeriodRangeError(
  range: { from: string; to: string },
  config: Pick<AdminPeriodCustomConfig, "min" | "max" | "maxDays"> = {},
): string | null {
  // O campo de data emite valores parciais enquanto se digita o ano (0002, 0020, 0202): só vale ano completo.
  if (!isCompleteCivil(range.from) || !isCompleteCivil(range.to)) return "Informe as duas datas.";
  if (range.from > range.to) return "A data inicial não pode ser depois da data final.";
  if (config.max && range.to > config.max) return `As datas não podem passar de ${formatCivilDate(config.max)}.`;
  if (config.min && range.from < config.min) return `As datas não podem ser antes de ${formatCivilDate(config.min)}.`;
  if (config.maxDays) {
    const days = Math.round((civilMs(range.to) - civilMs(range.from)) / DAY_MS) + 1;
    if (days > config.maxDays) return `O período pode ter no máximo ${config.maxDays} dias.`;
  }
  return null;
}

type FadeEdge = "none" | "start" | "end" | "both";

/**
 * Seletor de período do Admin: atalhos em controle segmentado e, no "Personalizado", dois campos de data.
 * Cabe no cabeçalho da página (alinhado à direita); no celular os atalhos rolam na horizontal, com um
 * esmaecido na borda que avisa que há mais.
 *
 * Só apresenta e pede a troca (`value`/`onChange`): quem calcula as datas dos atalhos, valida o fuso e
 * guarda o período (URL, hook) continua sendo o hook de cada tela. O intervalo digitado só sobe por
 * `onChange` quando é válido; enquanto não é, a mensagem aparece junto dos campos e o período anterior
 * continua valendo.
 */
export function AdminPeriodSelect({
  presets,
  value,
  onChange,
  custom,
  summary,
  compact = false,
  ariaLabel = "Período",
  disabled = false,
}: AdminPeriodSelectProps) {
  const baseId = useId();
  const fromId = `${baseId}-from`;
  const toId = `${baseId}-to`;
  const errorId = `${baseId}-error`;
  const customLabel = custom?.label ?? "Personalizado";

  // "Personalizado" fica aberto enquanto a pessoa mexe nas datas, mesmo que elas passem a coincidir com um atalho.
  const [customOpen, setCustomOpen] = useState(false);
  const isCustom = !!custom && (customOpen || value.preset === null || value.preset === ADMIN_PERIOD_CUSTOM);
  const selected = isCustom ? ADMIN_PERIOD_CUSTOM : value.preset;

  // Rascunho dos campos: o que está digitado, válido ou não. Reinicia quando o período de fora muda.
  const [draft, setDraft] = useState({ from: value.from ?? "", to: value.to ?? "" });
  const [seen, setSeen] = useState({ from: value.from, to: value.to });
  const [touched, setTouched] = useState(false);
  if (seen.from !== value.from || seen.to !== value.to) {
    setSeen({ from: value.from, to: value.to });
    // Mudança de fora (reset de filtros, URL, outro controle) para um atalho: o "Personalizado" deixa de parecer escolhido.
    // Se as datas novas são as que a pessoa acabou de digitar, é o eco dela: o "Personalizado" continua aberto.
    const echo = (value.from ?? "") === draft.from && (value.to ?? "") === draft.to;
    if (!echo && customOpen && value.preset !== null && value.preset !== ADMIN_PERIOD_CUSTOM) setCustomOpen(false);
    setDraft({ from: value.from ?? "", to: value.to ?? "" });
    setTouched(false);
  }
  const error = isCustom && touched ? adminPeriodRangeError(draft, custom) : null;

  const options = [...presets, ...(custom ? [{ id: ADMIN_PERIOD_CUSTOM, label: customLabel }] : [])];

  const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>(
    selected ?? "",
    options.map((o) => `${o.id}:${o.label}`).join("|"),
  );

  // Rolagem dos atalhos (celular): esmaecido nas bordas com mais conteúdo e o atalho ativo sempre à vista.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<FadeEdge>("none");
  const measureFade = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(start && end ? "both" : start ? "start" : end ? "end" : "none");
  }, []);
  useLayoutEffect(() => {
    measureFade();
  });
  useEffect(() => {
    window.addEventListener("resize", measureFade);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureFade);
    if (scrollerRef.current) observer?.observe(scrollerRef.current);
    return () => {
      window.removeEventListener("resize", measureFade);
      observer?.disconnect();
    };
  }, [measureFade]);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>("button.on");
    if (!el || !active) return;
    const hidden = active.offsetLeft < el.scrollLeft || active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth;
    if (hidden) el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
  }, [selected, options.length]);

  const pick = (id: string) => {
    if (id === selected) return;
    if (id === ADMIN_PERIOD_CUSTOM) {
      setCustomOpen(true);
      onChange({ preset: ADMIN_PERIOD_CUSTOM, ...(value.from ? { from: value.from } : {}), ...(value.to ? { to: value.to } : {}) });
      return;
    }
    setCustomOpen(false);
    onChange({ preset: id });
  };

  const edit = (patch: Partial<{ from: string; to: string }>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setTouched(true);
    if (adminPeriodRangeError(next, custom) === null) onChange({ preset: ADMIN_PERIOD_CUSTOM, from: next.from, to: next.to });
  };

  return (
    <div className="adm-period" data-compact={compact ? "true" : undefined}>
      <div className="adm-period-row">
        <div className="adm-period-scroll" ref={scrollerRef} data-fade={fade} onScroll={measureFade}>
          <div className="seg adm-period-seg" role="group" aria-label={ariaLabel} ref={containerRef}>
            <i className="ind" ref={indicatorRef} aria-hidden="true" />
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === selected ? "adm-period-btn on" : "adm-period-btn"}
                aria-pressed={option.id === selected}
                disabled={disabled}
                onClick={() => pick(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isCustom ? (
          <div className="adm-period-range" role="group" aria-label={`${ariaLabel} personalizado`}>
            <div className="adm-period-field" data-invalid={error ? "true" : undefined}>
              <label htmlFor={fromId}>De</label>
              <input
                id={fromId}
                type="date"
                value={draft.from}
                min={custom?.min}
                max={custom?.max}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => edit({ from: event.target.value })}
              />
            </div>
            <span className="adm-period-sep" aria-hidden="true">
              –
            </span>
            <div className="adm-period-field" data-invalid={error ? "true" : undefined}>
              <label htmlFor={toId}>Até</label>
              <input
                id={toId}
                type="date"
                value={draft.to}
                min={custom?.min}
                max={custom?.max}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => edit({ to: event.target.value })}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="adm-period-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {/* sempre no DOM (vazia sem `summary`): uma região viva só anuncia o que muda DEPOIS de existir.
          `<div>`, não `<p>`: o apoio pode ter blocos (um AdminInfoPopover, vários parágrafos). */}
      <div className="adm-period-summary" aria-live="polite">
        {summary}
      </div>
    </div>
  );
}
