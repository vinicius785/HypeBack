import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { EMPTY_TEXT, figureText, isFigureAvailable } from "@/lib/admin/format";
import { FIGURE_KIND_HELP, FIGURE_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminFigure } from "@/shared/admin-platform.types";

import { AdminInfoPopover } from "./admin-info-popover";
import { AdminLink, type AdminLinkTarget } from "./admin-link";
import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-ext.css";

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
  /**
   * Mostra o selo de tipo (Realizado, Posição atual…) no rodapé do cartão. Padrão: sim (ou o da grade: veja
   * `AdminFigureGrid quiet`). Com `false` o selo some do cartão e vira uma linha "Tipo: Realizado" dentro do
   * popover do "i" do rótulo, que continua dizendo a regra e o significado do tipo.
   */
  showKind?: boolean;
  /**
   * Definição do `hint` ("no período = últimos 30 dias"). Entra no popover do "i" do rótulo, como mais um
   * parágrafo, em vez de o texto de apoio ganhar um segundo "i". Só quando o cartão não tem "i" do rótulo
   * (sem número ainda) o `hint` ganha o seu próprio.
   */
  hintInfo?: ReactNode;
}

/** `AdminFigureGrid quiet`: os cartões filhos assumem `showKind={false}` sem repetir a prop em cada um. */
const QuietFiguresContext = createContext(false);

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
export function AdminFigureCard({
  label,
  figure,
  loading,
  to,
  hint,
  size = "md",
  variant = "card",
  showKind,
  hintInfo,
}: AdminFigureCardProps) {
  const quiet = useContext(QuietFiguresContext);
  const kindVisible = showKind ?? !quiet;
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
            <AdminInfoPopover.Paragraph>{figure.definition}</AdminInfoPopover.Paragraph>
            {hintInfo ? <AdminInfoPopover.Paragraph>{hintInfo}</AdminInfoPopover.Paragraph> : null}
            {kindVisible ? null : (
              <AdminInfoPopover.Paragraph className="adm-fig-kindline">Tipo: {FIGURE_KIND_LABEL[figure.kind]}</AdminInfoPopover.Paragraph>
            )}
            <AdminInfoPopover.Paragraph>{FIGURE_KIND_HELP[figure.kind]}</AdminInfoPopover.Paragraph>
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
          {(figure && (kindVisible || to)) || hint ? (
            <div className="adm-fig-foot">
              {kind && kindVisible ? (
                <span className="adm-kind" data-kind={kind}>
                  {FIGURE_KIND_LABEL[kind]}
                </span>
              ) : null}
              {hint ? (
                <span className="adm-fig-hint">
                  {hint}
                  {/* o "i" do rótulo já leva a definição do hint; sem ele (número ainda não chegou) o hint ganha o seu */}
                  {hintInfo && !figure ? <AdminInfoPopover label={label}>{hintInfo}</AdminInfoPopover> : null}
                </span>
              ) : null}
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

/**
 * Grade responsiva de `AdminFigureCard` (4 colunas no desktop, 2 no celular).
 * `quiet` tira o selo de tipo de todos os cartões (cada um pode voltar com `showKind`): o tipo passa a viver só no popover do "i".
 */
export function AdminFigureGrid({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return (
    <QuietFiguresContext.Provider value={quiet}>
      <div className="adm-figs" data-quiet={quiet ? "true" : undefined}>
        {children}
      </div>
    </QuietFiguresContext.Provider>
  );
}
