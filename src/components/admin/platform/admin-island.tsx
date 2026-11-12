import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";

import "@/styles/management-board.css";
import "@/styles/admin-island.css";
import "@/styles/admin-island-bar.css";

export interface AdminIslandProps {
  /** Nome da região para leitor de tela ("Pessoas", "Filas do atendimento"…). */
  ariaLabel: string;
  /** Classe da variante (a ilha de cada tela usa a sua para os estilos próprios dos filtros). */
  className?: string;
  /** Esquerda do cabeçalho: os filtros ou a navegação da tela (pílulas). */
  start: ReactNode;
  /** Direita do cabeçalho, antes da seta: números vivos, "verificado há…", atualizar. */
  end?: ReactNode;
  /** Segunda linha, dentro da ilha: busca, ordenar e filtros (a barra da lista). */
  tools?: ReactNode;
  /** Para a tela pendurar a barra por portal (`createPortal`) quando ela nasce fora da ilha. */
  toolsRef?: (element: HTMLDivElement | null) => void;
  /** Folha branca que a seta abre. Sem ela (tela sem números para resumir), a ilha não tem seta. */
  sheet?: ReactNode;
  sheetLabel?: string;
  /** Rótulos acessíveis da seta ("Abrir o resumo" / "Fechar o resumo"). */
  chevronLabel?: { open: string; close: string };
  /** Sem animação de entrada (ao trocar de aba a ilha não pode piscar). */
  still?: boolean;
  /** Controle de fora (para pedir dados só quando a folha abre). Sem ele, a ilha guarda o estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Casca única das "ilhas" (padrão Dynamic Island do Gerenciamento) do backoffice: uma pílula preta no topo da tela.
 *
 * Todas as ilhas têm o mesmo desenho, para a pessoa saber onde olhar:
 *  1. cabeçalho em grade: `start` à esquerda, `end` à direita e a SETA DE EXPANDIR sempre no canto direito, centrada na
 *     altura da linha (em tela estreita o `end` desce para a própria linha, a seta continua no canto);
 *  2. `tools`, opcional, numa segunda linha (a barra de busca, ordenar e filtros);
 *  3. a folha branca (`sheet`) que abre por baixo com mola, inerte enquanto fechada.
 * O espaçamento (12px entre os itens, 16px de respiro nas bordas) e a altura mínima vêm de `admin-island.css`.
 */
export function AdminIsland({ ariaLabel, className = "", start, end, tools, toolsRef, sheet, sheetLabel, chevronLabel, still, open: openProp, onOpenChange }: AdminIslandProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const sheetId = useId();
  const toggle = () => {
    const next = !open;
    setInner(next);
    onOpenChange?.(next);
  };
  return (
    <section className={`isl isl-x isl-bar-dark ${className}${open ? " isl-open" : ""}${still ? " isl-still" : ""}`.trim()} aria-label={ariaLabel}>
      <div className="isl-h isl-x-h">
        <div className="isl-x-start">{start}</div>
        {end ? <div className="isl-x-end">{end}</div> : null}
        {sheet ? (
          <button
            type="button"
            className="isl-chev isl-x-chev"
            aria-expanded={open}
            aria-controls={sheetId}
            aria-label={open ? chevronLabel?.close : chevronLabel?.open}
            onClick={toggle}
          >
            <I n="chevdown" cls="sm" />
          </button>
        ) : null}
      </div>
      {tools || toolsRef ? (
        <div className="isl-tools" ref={toolsRef}>
          {tools}
        </div>
      ) : null}
      {sheet ? (
        <div className="isl-b" id={sheetId} role="region" aria-label={sheetLabel} inert={!open || undefined}>
          <div className="isl-bi">
            <div className="isl-sheet">{sheet}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Pendura a barra de uma lista (busca, filtros, atualizar) na segunda linha de uma ilha por portal. `slot` é o elemento que
 * a ilha oferece (`toolsRef`): `null` enquanto a ilha ainda não montou (nada aparece), `undefined` quando a tela não tem
 * ilha (a barra fica onde está). Usado por Atendimento e Comunidade, em que a barra nasce numa fila/aba filha.
 */
export function inIsland(slot: HTMLElement | null | undefined, bar: ReactNode): ReactNode {
  return slot ? createPortal(bar, slot) : slot === undefined ? bar : null;
}
