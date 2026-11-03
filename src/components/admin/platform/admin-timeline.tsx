import { Children, useId, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { ADMIN_TIME_ZONE, parseInstant } from "@/lib/admin/format";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-timeline.css";

export type AdminTimelineTone = "neutral" | "brand" | "ok" | "warn" | "bad";

export interface AdminTimelineGroup {
  /** Chave estável do grupo (o dia em ISO). Sem ela usa o rótulo. */
  key?: string;
  /** Cabeçalho do grupo, em frase normal ("Hoje", "Ontem", "12 de outubro"). Sem rótulo, o grupo não tem cabeçalho. */
  label?: string;
  /** Os `AdminTimelineItem` do grupo. */
  items: ReactNode;
}

interface AdminTimelineProps {
  groups: readonly AdminTimelineGroup[];
  /** Nome da lista para leitor de tela ("Atividade da plataforma"). */
  ariaLabel?: string;
  /** Nível do cabeçalho de dia (padrão 3: logo abaixo do título da seção). */
  headingLevel?: 2 | 3 | 4;
  /** Recarregando por cima do que já está na tela: esmaece a lista e marca `aria-busy`. */
  busy?: boolean;
}

/**
 * Linha do tempo agrupada por dia: `<ol>` de grupos, cada grupo com um cabeçalho (`<h3>`) e um `<ol>` de eventos.
 * Um único grupo sem rótulo vira só a lista de eventos (sem lista dentro de lista para o leitor de tela).
 * Use `AdminTimelineItem` para cada evento.
 */
export function AdminTimeline({ groups, ariaLabel, headingLevel = 3, busy }: AdminTimelineProps) {
  const Heading = `h${headingLevel}` as const;
  const flat = groups.length === 1 && !groups[0].label;
  if (flat) {
    return (
      <ol className="adm-tl-list" aria-label={ariaLabel} aria-busy={busy ? true : undefined} data-busy={busy ? "true" : undefined}>
        {groups[0].items}
      </ol>
    );
  }
  return (
    <ol className="adm-tl" aria-label={ariaLabel} aria-busy={busy ? true : undefined} data-busy={busy ? "true" : undefined}>
      {groups.map((group, index) => (
        <li className="adm-tl-day" key={group.key ?? group.label ?? index}>
          {group.label ? <Heading className="adm-tl-day-h">{group.label}</Heading> : null}
          <ol className="adm-tl-list">{group.items}</ol>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── agrupar por dia ───────────────────────── */

export interface GroupTimelineByDayOptions {
  /** Fuso que define "o dia" de cada evento (padrão `America/Sao_Paulo`, o do negócio). Fuso inválido volta ao padrão. */
  timeZone?: string;
  /** "Agora" para decidir Hoje/Ontem (padrão: o relógio). Existe para teste e para telas com relógio próprio. */
  now?: Date | number;
}

export interface AdminTimelineDayGroup<T> {
  /** `YYYY-MM-DD` no fuso escolhido; `""` para evento sem data válida. */
  key: string;
  /** "Hoje", "Ontem" ou "Quinta-feira, 30 de outubro" (com o ano quando não é o atual); "Sem data" quando inválida. */
  label: string;
  items: T[];
}

const civilFormatters = new Map<string, Intl.DateTimeFormat>();

function civilFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = civilFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    civilFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function safeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return ADMIN_TIME_ZONE;
  try {
    civilFormatter(timeZone);
    return timeZone;
  } catch {
    return ADMIN_TIME_ZONE;
  }
}

/** Dia civil (`YYYY-MM-DD`) de um instante num fuso. */
function civilDayIn(date: Date, timeZone: string): string {
  const parts: Record<string, string> = {};
  for (const part of civilFormatter(timeZone).formatToParts(date)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftCivilDay(civil: string, days: number): string {
  const [year, month, day] = civil.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const WEEKDAY_LONG = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });

function dayLabel(civil: string, today: string): string {
  if (civil === today) return "Hoje";
  if (civil === shiftCivilDay(today, -1)) return "Ontem";
  const [year, month, day] = civil.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = WEEKDAY_LONG.format(noon);
  const head = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${DAY_MONTH.format(noon)}`;
  return year === Number(today.slice(0, 4)) ? head : `${head} de ${year}`;
}

/**
 * Agrupa eventos por dia do fuso escolhido, na ordem em que chegam (o feed já vem do mais recente para o mais
 * antigo; eventos de um mesmo dia que não são vizinhos formam grupos separados em vez de reordenar a lista).
 * Cada grupo traz `{ key, label, items }`: a tela troca `items` pelos `AdminTimelineItem` e entrega a `AdminTimeline`.
 *
 * ```tsx
 * const groups = groupTimelineByDay(events, (e) => e.occurred_at).map((g) => ({
 *   key: g.key, label: g.label, items: g.items.map((e) => <AdminTimelineItem key={e.id} ... />),
 * }));
 * ```
 */
export function groupTimelineByDay<T>(
  items: readonly T[],
  getDate: (item: T) => string | number | Date | null | undefined,
  options: GroupTimelineByDayOptions = {},
): AdminTimelineDayGroup<T>[] {
  const timeZone = safeTimeZone(options.timeZone);
  const today = civilDayIn(parseInstant(options.now ?? Date.now()) ?? new Date(), timeZone);
  const groups: AdminTimelineDayGroup<T>[] = [];
  for (const item of items) {
    const date = parseInstant(getDate(item));
    const key = date ? civilDayIn(date, timeZone) : "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: key ? dayLabel(key, today) : "Sem data", items: [item] });
  }
  return groups;
}

type DataAttributes = { [name: `data-${string}`]: string | number | boolean | undefined };

interface AdminTimelineItemProps extends DataAttributes {
  /** Classe extra no `<li>` (some à do kit, não a substitui). */
  className?: string;
  /** Nome de ícone do mapa `I`. Sem ícone, o marcador é um ponto. */
  icon?: string;
  /** Cor do marcador (decorativa: o que o evento é vem do título). Padrão neutro. */
  tone?: AdminTimelineTone;
  /** A frase do evento (pode ter um link). */
  title: ReactNode;
  /** Linha de apoio: quem fez, onde, o tipo. Aceita lista; vazios saem e o resto é separado por "·". */
  meta?: ReactNode;
  /** A hora (ou há quanto tempo), à direita. */
  time: ReactNode;
  /** ISO do instante: com ele a hora vira `<time datetime>`. */
  dateTime?: string;
  /** Instante completo para quem passa o mouse (`title`). */
  timeTitle?: string;
  /** Conteúdo recolhido (motivo, antes/depois). Com ele aparece o botão "Ver detalhes" (`aria-expanded`). */
  detail?: ReactNode;
  /** Abre já expandido. */
  defaultOpen?: boolean;
  /** Avisa quando o detalhe abre ou fecha (para métricas, ou para carregar o detalhe sob demanda). */
  onToggle?: (open: boolean) => void;
}

/** Só os `data-*` (o resto do que sobrar não vai ao DOM: o item não é um `<li>` aberto). */
function dataAttributes(rest: DataAttributes): DataAttributes {
  const out: DataAttributes = {};
  for (const [name, value] of Object.entries(rest)) if (name.startsWith("data-")) out[name as `data-${string}`] = value;
  return out;
}

/** Um evento da linha do tempo: marcador, frase, apoio, hora e, se houver, um detalhe que abre e fecha. */
export function AdminTimelineItem({
  icon,
  tone = "neutral",
  title,
  meta,
  time,
  dateTime,
  timeTitle,
  detail,
  defaultOpen = false,
  onToggle,
  className,
  ...rest
}: AdminTimelineItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const titleId = useId();
  const detailId = useId();
  // `toArray` já tira null/undefined/boolean; texto vazio ("" de um nome ausente) também não vira parte.
  const metaParts = Children.toArray(meta).filter((part) => !(typeof part === "string" && part.trim() === ""));
  const expandable = detail !== undefined && detail !== null && detail !== false;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <li {...dataAttributes(rest)} className={className ? `adm-tl-item ${className}` : "adm-tl-item"} data-tone={tone}>
      <span className="adm-tl-mark" data-icon={icon ? "true" : undefined} aria-hidden="true">
        {icon ? <I n={icon} /> : null}
      </span>
      <div className="adm-tl-body">
        <p className="adm-tl-title" id={titleId}>
          {title}
        </p>
        {metaParts.length > 0 ? (
          <p className="adm-tl-meta">
            {metaParts.map((part, index) => (
              <span key={index}>{part}</span>
            ))}
          </p>
        ) : null}
        {expandable ? (
          <>
            <button
              type="button"
              className="adm-tl-toggle"
              aria-expanded={open}
              aria-controls={detailId}
              aria-describedby={titleId}
              onClick={toggle}
            >
              {open ? "Ocultar detalhes" : "Ver detalhes"}
              <I n="chev" cls="sm" />
            </button>
            <div className="adm-tl-detail" id={detailId} hidden={!open}>
              {detail}
            </div>
          </>
        ) : null}
      </div>
      {dateTime ? (
        <time className="adm-tl-time" dateTime={dateTime} title={timeTitle}>
          {time}
        </time>
      ) : (
        <span className="adm-tl-time" title={timeTitle}>
          {time}
        </span>
      )}
    </li>
  );
}
