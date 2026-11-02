import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";

import { WORKSPACE_ACTION_LABEL, type WorkspaceAction } from "./workspace-constants";

import "@/styles/admin-workspaces.css";

interface WorkspaceActionsMenuProps {
  /** Só as ações que o estado atual permite (`detail.can`), já na ordem do menu. */
  actions: readonly WorkspaceAction[];
  onSelect: (action: WorkspaceAction) => void;
}

/**
 * Menu "Ações" do cabeçalho do workspace: um botão que abre uma lista curta (suspender, arquivar, excluir…),
 * em vez de uma fileira de botões. Padrão WAI-ARIA de menu: abre com Enter, Espaço ou seta para baixo; as
 * setas, Home e End percorrem os itens; Escape fecha e devolve o foco ao botão; clicar fora ou Tab fecha.
 *
 * Ao escolher um item o foco volta ao botão ANTES de a ação abrir o diálogo: é ele que o diálogo
 * devolve o foco ao fechar (o item do menu já terá sumido).
 */
export function WorkspaceActionsMenu({ actions, onSelect }: WorkspaceActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? []);

  useEffect(() => {
    if (!open) return;
    // Foco no primeiro item ao abrir (o menu só existe no DOM enquanto aberto).
    items()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % list.length;
    else if (event.key === "ArrowUp") next = (index - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    } else if (event.key === "Tab") {
      close(false);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    list[next]?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="adm-workspaces-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn out"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
      >
        Ações
        <I n="chev" cls="sm adm-workspaces-menu-chev" />
      </button>
      {open ? (
        <div id={menuId} className="adm-workspaces-menu-list" role="menu" aria-label="Ações do workspace" onKeyDown={onMenuKeyDown}>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="adm-workspaces-menu-item"
              data-danger={action === "delete" ? "true" : undefined}
              onClick={() => {
                close(true);
                onSelect(action);
              }}
            >
              {WORKSPACE_ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
