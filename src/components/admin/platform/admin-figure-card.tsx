import type { CSSProperties, ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { EMPTY_TEXT, figureText, isFigureAvailable } from "@/lib/admin/format";
import { FIGURE_KIND_HELP, FIGURE_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminFigure } from "@/shared/admin-platform.types";

import { AdminInfoPopover } from "./admin-info-popover";
import { AdminLink, type AdminLinkTarget } from "./admin-link";
import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";

export interface AdminFigureCardProps {
  label: string;
  /** O número do contrato. `undefined` (ainda não chegou) mostra "—"; `kind: 'unavailable'` mostra "Não apurado". */
  figure?: AdminFigure | null;
  loading?: boolean;
  /** Torna o cartão inteiro um link (ex.: o KPI leva para a lista com o mesmo filtro). */
  to?: AdminLinkTarget;
  /** Texto de apoio ao lado do tipo ("no período"). */
  hint?: ReactNode;
  size?: "md" | "sm";
  /** `plain` tira o cartão (fundo, raio, respiro) para usar dentro de uma seção. */
  variant?: "card" | "plain";
}

/**
 * Largura do texto do valor em "unidades": letra e dígito contam 1; ponto, vírgula, espaço e símbolo, ½.
 * O CSS usa isto (`--adm-fig-units`) para encolher o valor até caber no cartão sem quebrar a linha.
 */
export function figureTextUnits(text: string): number {
  let units = 0;
  for (const char of text) units += /[\p{L}\p{N}]/u.test(char) ? 1 : 0.5;
  return units;
}

/**
 * Um número com definição: rótulo, valor exato (`figureText`), o tipo em texto (Realizado, Comprometido,
 * Posição atual, Calculado, Aproximado, Não apurado) e o "i" com a regra de cálculo. Número que não existe
 * no banco (`unavailable`) nunca vira "0": é "Não apurado", em cinza.
 */
export function AdminFigureCard({ label, figure, loading, to, hint, size = "md", variant = "card" }: AdminFigureCardProps) {
  const available = isFigureAvailable(figure);
  const kind = figure?.kind;
  const valueText = figure ? figureText(figure) : EMPTY_TEXT;

  return (
    <div
      className="adm-fig"
      data-link={to ? "true" : undefined}
      data-size={size === "sm" ? "sm" : undefined}
      data-variant={variant === "plain" ? "plain" : undefined}
      aria-busy={loading ? true : undefined}
    >
      <div className="adm-fig-top">
        <span className="adm-fig-label">{label}</span>
        {!loading && figure ? (
          <AdminInfoPopover label={label}>
            <p>{figure.definition}</p>
            <p>{FIGURE_KIND_HELP[figure.kind]}</p>
          </AdminInfoPopover>
        ) : null}
      </div>

      {loading ? (
        <>
          <AdminSkeleton height={size === "sm" ? 28 : 36} width="62%" radius={10} />
          <div className="adm-fig-foot">
            <AdminSkeleton height={22} width={92} radius={999} />
          </div>
        </>
      ) : (
        <>
          <div
            className="adm-fig-value"
            data-unavailable={figure && !available ? "true" : undefined}
            style={{ "--adm-fig-units": figureTextUnits(valueText) } as CSSProperties}
          >
            {valueText}
          </div>
          {figure || hint ? (
            <div className="adm-fig-foot">
              {kind ? (
                <span className="adm-kind" data-kind={kind}>
                  {FIGURE_KIND_LABEL[kind]}
                </span>
              ) : null}
              {hint ? <span>{hint}</span> : null}
              {to ? (
                <span className="adm-fig-go" aria-hidden="true">
                  <I n="chev" cls="sm" />
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {to ? <AdminLink to={to} className="adm-fig-link" aria-label={`Ver ${label}`} /> : null}
    </div>
  );
}

/** Grade responsiva de `AdminFigureCard` (4 colunas no desktop, 2 no celular). */
export function AdminFigureGrid({ children }: { children: ReactNode }) {
  return <div className="adm-figs">{children}</div>;
}
