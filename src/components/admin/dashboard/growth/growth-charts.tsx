/**
 * Gráficos do dashboard de crescimento: SVG e HTML escritos à mão (o painel não tem biblioteca de gráficos), sem
 * dependência nova e só com os tokens do kit. Cada gráfico traz o mesmo dado como tabela para leitor de tela
 * (`.adm-sr`) e nunca depende só da cor: a série "em andamento" é tracejada e as linhas diferem no traço.
 */
import { useId, type ReactNode } from "react";

import { formatInt, formatPercent } from "@/lib/admin/format";

import "@/styles/admin-growth.css";

const defaultFormat = (value: number) => formatInt(value);

// ───────────────────────── barras horizontais ─────────────────────────

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Texto de apoio depois do valor (ex.: "62,5%"). */
  note?: string;
}

/**
 * Lista de barras horizontais, na ordem recebida. A barra é proporcional ao maior valor; com `total` o apoio mostra a
 * fatia sobre ele. É uma lista (`<ul>`): já se lê como "rótulo, valor" sem tabela extra.
 */
export function BarList({
  rows,
  total,
  format = defaultFormat,
  label,
}: {
  rows: readonly BarRow[];
  total?: number;
  format?: (value: number) => string;
  /** Nome da lista para leitor de tela. */
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="adm-gr-bars" aria-label={label}>
      {rows.map((row) => {
        const share = total && total > 0 ? Math.round((row.value / total) * 1000) / 10 : null;
        return (
          <li key={row.key}>
            <span className="adm-gr-bars-label">{row.label}</span>
            <span className="adm-gr-bars-track" aria-hidden="true">
              <i style={{ width: `${(row.value / max) * 100}%` }} />
            </span>
            <b>
              {format(row.value)}
              {row.note ? <small>{row.note}</small> : share !== null ? <small>{formatPercent(share)}</small> : null}
            </b>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────── barra empilhada ─────────────────────────

export interface Segment {
  key: string;
  label: string;
  value: number;
}

/** Uma barra dividida em partes, com a legenda (cor + nome + valor + %) embaixo. As partes diferem também no tom (3 níveis). */
export function StackedBar({ segments, label }: { segments: readonly Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="adm-gr-stack">
      <div className="adm-gr-stack-bar" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${formatInt(s.value)}`).join(", ")}`}>
        {segments.map((s, index) =>
          s.value > 0 ? <i key={s.key} data-tone={index} style={{ flexGrow: s.value }} /> : null,
        )}
      </div>
      <ul className="adm-gr-legend">
        {segments.map((s, index) => (
          <li key={s.key}>
            <i data-tone={index} aria-hidden="true" />
            {s.label}: <b>{formatInt(s.value)}</b>
            {total > 0 ? <small> · {formatPercent(Math.round((s.value / total) * 1000) / 10)}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── funil ─────────────────────────

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

/** Funil horizontal: cada etapa é uma barra (proporcional à maior) com o valor e o % sobre a etapa anterior. */
export function FunnelBars({ steps, label }: { steps: readonly FunnelStep[]; label: string }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="adm-gr-funnel" aria-label={label}>
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].value : null;
        const ofPrevious = previous && previous > 0 ? Math.round((step.value / previous) * 1000) / 10 : null;
        return (
          <li key={step.key}>
            <span className="adm-gr-funnel-label">{step.label}</span>
            <span className="adm-gr-funnel-track" aria-hidden="true">
              <i style={{ width: `${Math.max(2, (step.value / max) * 100)}%` }} />
            </span>
            <b>
              {formatInt(step.value)}
              {ofPrevious !== null ? <small>{formatPercent(ofPrevious)} da etapa anterior</small> : null}
            </b>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────── colunas ─────────────────────────

export interface ColumnPoint {
  key: string;
  /** Rótulo curto do eixo ("17/11"). */
  label: string;
  /** Nome completo (tooltip e tabela). */
  title: string;
  value: number;
  /** Período em andamento: barra tracejada. */
  partial?: boolean;
}

const COL_W = 640;
const COL_H = 190;
const PAD = { top: 22, right: 8, bottom: 26, left: 8 };

/**
 * Barras verticais por período. O período em andamento sai tracejado e sem preenchimento (e a legenda diz isso), para
 * não parecer uma queda. Passa de 12 barras: o valor sobre a barra some e o eixo mostra um rótulo sim, um não.
 */
export function ColumnChart({
  points,
  format = defaultFormat,
  label,
  valueHeader = "Valor",
}: {
  points: readonly ColumnPoint[];
  format?: (value: number) => string;
  label: string;
  valueHeader?: string;
}) {
  const id = useId();
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = COL_W - PAD.left - PAD.right;
  const innerH = COL_H - PAD.top - PAD.bottom;
  const slot = n > 0 ? innerW / n : innerW;
  const barW = Math.max(4, slot * 0.62);
  const showValues = n <= 12;
  const step = n > 12 ? Math.ceil(n / 12) : 1;
  const hasPartial = points.some((p) => p.partial);

  return (
    <figure className="adm-gr-chart">
      <svg viewBox={`0 0 ${COL_W} ${COL_H}`} role="img" aria-labelledby={id} focusable="false">
        <title id={id}>{label}</title>
        <line x1={PAD.left} x2={COL_W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="adm-gr-axis" />
        {points.map((p, i) => {
          const h = (p.value / max) * innerH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = PAD.top + innerH - h;
          return (
            <g key={p.key}>
              <rect
                x={x}
                y={p.value > 0 ? y : PAD.top + innerH - 1}
                width={barW}
                height={Math.max(p.value > 0 ? h : 1, 1)}
                rx={3}
                className={p.partial ? "adm-gr-col adm-gr-col-partial" : "adm-gr-col"}
              >
                <title>{`${p.title}${p.partial ? " (em andamento)" : ""}: ${format(p.value)}`}</title>
              </rect>
              {showValues ? (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="adm-gr-val">
                  {format(p.value)}
                </text>
              ) : null}
              {i % step === 0 ? (
                <text x={x + barW / 2} y={COL_H - 8} textAnchor="middle" className="adm-gr-tick">
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hasPartial ? (
        <figcaption className="adm-gr-note">
          <i className="adm-gr-swatch adm-gr-swatch-partial" aria-hidden="true" /> Tracejado: período em andamento.
        </figcaption>
      ) : null}
      <table className="adm-sr">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">
                {p.title}
                {p.partial ? " (em andamento)" : ""}
              </th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ───────────────────────── linhas ─────────────────────────

export interface LineSeries {
  key: string;
  label: string;
  values: readonly number[];
}

/**
 * Linhas no tempo (uma ou mais séries sobre o mesmo eixo). As séries diferem no traço (cheio, tracejado, pontilhado) e
 * a legenda mostra o mesmo traço, então a leitura não depende da cor. `xTitles` são os nomes completos da tabela.
 */
export function LineChart({
  xLabels,
  xTitles,
  series,
  format = defaultFormat,
  label,
}: {
  xLabels: readonly string[];
  xTitles?: readonly string[];
  series: readonly LineSeries[];
  format?: (value: number) => string;
  label: string;
}) {
  const id = useId();
  const n = xLabels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const innerW = COL_W - PAD.left - PAD.right;
  const innerH = COL_H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const step = n > 8 ? Math.ceil(n / 8) : 1;

  return (
    <figure className="adm-gr-chart">
      <svg viewBox={`0 0 ${COL_W} ${COL_H}`} role="img" aria-labelledby={id} focusable="false">
        <title id={id}>{label}</title>
        <line x1={PAD.left} x2={COL_W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="adm-gr-axis" />
        <text x={PAD.left} y={PAD.top - 8} className="adm-gr-val">
          {format(max)}
        </text>
        {series.map((s, si) => (
          <g key={s.key} className="adm-gr-line" data-series={si}>
            <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3}>
                <title>{`${s.label}, ${xTitles?.[i] ?? xLabels[i]}: ${format(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {xLabels.map((text, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={COL_H - 8} textAnchor="middle" className="adm-gr-tick">
              {text}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 || series[0] ? (
        <ul className="adm-gr-legend">
          {series.map((s, si) => (
            <li key={s.key}>
              <svg width="26" height="10" aria-hidden="true" className="adm-gr-line" data-series={si}>
                <line x1="1" y1="5" x2="25" y2="5" />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <table className="adm-sr">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xLabels.map((text, i) => (
            <tr key={i}>
              <th scope="row">{xTitles?.[i] ?? text}</th>
              {series.map((s) => (
                <td key={s.key}>{format(s.values[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Pequeno bloco de apoio sob um gráfico ou lista (avisos de "histórico começa hoje", notas de leitura). */
export function ChartNote({ children }: { children: ReactNode }) {
  return <p className="adm-gr-note">{children}</p>;
}
