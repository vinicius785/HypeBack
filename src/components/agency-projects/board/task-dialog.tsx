import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AdminActionMenu, type AdminActionMenuItem } from "@/components/admin/platform/admin-action-menu";
import { I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";

import "@/styles/admin-kit-dialog.css";
import "@/styles/agency-projects.css";

interface TaskDialogShellProps {
  /** Nome do diálogo para leitor de tela ("Tarefa", "Subtarefa", "Nova tarefa"). */
  label: string;
  /** Trilha do topo: projeto / Tarefas / [tarefa-mãe] / esta tarefa. */
  crumbs: ReactNode[];
  /** Estado de gravação mostrado no topo ("Salvo ✓", "Salvando…", erro). */
  status?: ReactNode;
  /** Mostra o botão "Atividade" e, aberto, o painel lateral. */
  activity?: { count?: number; open: boolean; onToggle: () => void; panel: ReactNode };
  /** Itens do menu "⋯" (ex.: Excluir tarefa). */
  menu?: readonly AdminActionMenuItem[];
  busy?: boolean;
  dirty?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Rodapé (só na criação): Cancelar e Criar tarefa. */
  footer?: ReactNode;
}

/**
 * Casca do modal da tarefa, no desenho do diálogo de tarefa da Plataforma VNH: barra de topo com a trilha, o aviso de
 * "Salvo", o botão Atividade, o menu "⋯" e o fechar; coluna de documento (até 820px) e, aberto, o painel de atividade ao
 * lado. Mesmo comportamento do `AdminDialog` (foco preso, Esc, rolagem travada, `aria-modal`, "gravando" não fecha).
 */
export function TaskDialogShell({ label, crumbs, status, activity, menu, busy = false, dirty = false, onClose, children, footer }: TaskDialogShellProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const requestClose = () => {
    if (!busy) onClose();
  };
  useModalBehavior({ open: true, containerRef: ref, onEscape: busy ? undefined : onClose });

  useEffect(() => {
    if (!busy) return;
    const dialog = ref.current;
    const active = document.activeElement;
    if (dialog && (!active || active === document.body || !dialog.contains(active) || (active as HTMLElement).matches?.(":disabled"))) dialog.focus();
  }, [busy]);

  return createPortal(
    <div className="pv">
      <div
        className="adm-modal apj-td-wrap"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && event.button === 0 && !dirty) requestClose();
        }}
      >
        <section ref={ref} className="apj-td" role="dialog" aria-modal="true" aria-label={label} aria-busy={busy ? true : undefined} data-activity={activity?.open ? "open" : undefined} tabIndex={-1}>
          <header className="apj-td-top">
            <nav className="apj-td-crumbs" aria-label="Localização">
              <ol>
                {crumbs.map((crumb, i) => (
                  <li key={i} id={i === crumbs.length - 1 ? titleId : undefined}>
                    {crumb}
                  </li>
                ))}
              </ol>
            </nav>
            <div className="apj-td-tools">
              {status ? <span className="apj-td-status">{status}</span> : null}
              {activity ? (
                <button type="button" className="apj-td-act" aria-pressed={activity.open} onClick={activity.onToggle}>
                  <I n="chat" cls="sm" />
                  Atividade{activity.count ? ` (${activity.count})` : ""}
                </button>
              ) : null}
              {menu && menu.length > 0 ? <AdminActionMenu items={menu} iconOnly variant="ghost" ariaLabel="Mais opções da tarefa" /> : null}
              <button type="button" className="apj-td-x" aria-label="Fechar" disabled={busy} onClick={requestClose}>
                <I n="x" cls="sm" />
              </button>
            </div>
          </header>

          <div className="apj-td-main">
            <div className="apj-td-doc">
              <div className="apj-td-col">{children}</div>
            </div>
            {activity?.open ? (
              <aside className="apj-td-side" aria-label="Atividade da tarefa">
                {activity.panel}
              </aside>
            ) : null}
          </div>

          {footer ? <footer className="apj-td-foot">{footer}</footer> : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}

