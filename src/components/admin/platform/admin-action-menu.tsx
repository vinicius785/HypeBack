import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";

import type { AdminIconSpec } from "./admin-tooltip";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-action-menu.css";

export interface AdminActionMenuItem {
  /** Estável e único dentro do menu (vira parte do `id` do item). */
  id: string;
  label: string;
  /** Nome do ícone do protótipo ou um elemento pronto. */
  icon?: AdminIconSpec;
  onSelect: () => void;
  /** O item continua visível e focável (`aria-disabled`), mas não executa. */
  disabled?: boolean;
  /** Por que está desabilitado: aparece sob o nome e é a descrição do item para leitor de tela. */
  disabledReason?: string;
  /** `danger`: vermelho (ação destrutiva). */
  tone?: "default" | "danger";
  /** Linha fina antes do item. Sem valor, o primeiro item `danger` depois de itens normais ganha uma sozinho. */
  separatorBefore?: boolean;
}

export interface AdminActionMenuProps {
  items: readonly AdminActionMenuItem[];
  /** Texto do botão (padrão "Mais"). Com `iconOnly` só serve de nome acessível. */
  label?: string;
  /** Botão só com o "⋯", sem texto. */
  iconOnly?: boolean;
  /** Nome acessível do botão quando precisa ser mais específico ("Mais ações de Acme Ltda"). */
  ariaLabel?: string;
  /** Lado do gatilho com que o menu alinha. Padrão `end` (borda direita). */
  align?: "start" | "end";
  /** `secondary`: botão de contorno (branco). `ghost`: sem fundo. Padrão `secondary`. */
  variant?: "secondary" | "ghost";
}

/** Tempo (ms) que a busca por inicial espera a próxima letra antes de recomeçar. */
const TYPEAHEAD_RESET_MS = 600;

const norm = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

/**
 * Menu "⋯"/"Mais" de ações de uma linha ou de um cabeçalho. Padrão WAI-ARIA de botão de menu:
 * - Enter, Espaço e seta para baixo abrem e focam o primeiro item habilitado (seta para cima: o último);
 * - setas, Home e End percorrem os itens; digitar uma letra vai ao próximo item que começa com ela;
 * - Escape fecha e devolve o foco ao botão; Tab fecha e segue para o próximo campo; clicar fora fecha;
 * - item desabilitado fica focável (`aria-disabled`) e mostra o motivo (`aria-describedby`): sem item "morto".
 *
 * O popover é um portal com `position: fixed` calculado a partir do botão (inverte para cima perto da borda
 * de baixo), então um `overflow: hidden` de cartão/tabela não o corta. Fecha ao rolar a página ou redimensionar.
 *
 * Ao escolher um item o foco volta ao botão ANTES de `onSelect` rodar: se a ação abrir um diálogo, é ao botão
 * que ele devolve o foco ao fechar (o item do menu já terá sumido).
 */
export function AdminActionMenu({ items, label = "Mais", iconOnly = false, ariaLabel, align = "end", variant = "secondary" }: AdminActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Qual item recebe o foco quando o menu abre (ArrowUp no botão abre pelo último). */
  const initialFocus = useRef<"first" | "last">("first");
  const typeahead = useRef({ text: "", timer: undefined as number | undefined });
  const baseId = useId();
  const triggerId = `${baseId}-btn`;
  const menuId = `${baseId}-menu`;

  const itemEls = useCallback(() => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []), []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openWith = (target: "first" | "last") => {
    initialFocus.current = target;
    setOpen(true);
  };

  // Posiciona (antes de pintar, sem piscar) e só então foca: elemento oculto não recebe foco.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const margin = 8;
    const gap = 6;
    const anchor = trigger.getBoundingClientRect();
    list.style.maxHeight = "";
    const width = list.offsetWidth;
    const height = list.offsetHeight;
    const left = align === "end" ? anchor.right - width : anchor.left;
    const roomBelow = window.innerHeight - anchor.bottom - gap - margin;
    const roomAbove = anchor.top - gap - margin;
    const up = height > roomBelow && roomAbove > roomBelow;
    const room = up ? roomAbove : roomBelow;
    const shown = height > room ? Math.max(room, 0) : height;
    if (height > room) list.style.maxHeight = `${shown}px`;
    list.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
    list.style.top = `${up ? anchor.top - gap - shown : anchor.bottom + gap}px`;
    list.dataset.placement = up ? "top" : "bottom";

    const all = itemEls();
    const enabled = all.filter((el) => el.getAttribute("aria-disabled") !== "true");
    const target = initialFocus.current === "last" ? enabled[enabled.length - 1] : enabled[0];
    // Tudo desabilitado: o foco vai para o próprio menu, para o Escape e o Tab continuarem funcionando.
    (target ?? list).focus({ preventScroll: true });
  }, [open, align, itemEls]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || listRef.current?.contains(target))) return;
      setOpen(false);
    };
    // A rolagem do próprio menu (lista longa) não conta: só a da página ou de um contêiner por baixo.
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    const state = typeahead.current;
    return () => window.clearTimeout(state.timer);
  }, []);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (event.key === "ArrowDown") openWith("first");
    else if (event.key === "ArrowUp") openWith("last");
    else return;
    event.preventDefault();
  };

  const focusAt = (index: number) => itemEls()[index]?.focus();

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const els = itemEls();
    const index = els.indexOf(document.activeElement as HTMLElement);
    const count = els.length;
    if (event.key === "ArrowDown") focusAt(index < 0 ? 0 : (index + 1) % count);
    else if (event.key === "ArrowUp") focusAt(index < 0 ? count - 1 : (index - 1 + count) % count);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(count - 1);
    else if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      // Sem preventDefault: o foco já está no botão quando o navegador anda um passo, então Tab segue para
      // o campo depois dele e Shift+Tab para o de antes (o menu é um portal no fim do documento).
      close(true);
      return;
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " ") {
      const state = typeahead.current;
      window.clearTimeout(state.timer);
      state.text += norm(event.key);
      state.timer = window.setTimeout(() => {
        state.text = "";
      }, TYPEAHEAD_RESET_MS);
      // Mesma letra repetida percorre os itens que começam com ela; letras diferentes afinam a busca.
      const repeated = [...state.text].every((char) => char === state.text[0]);
      const needle = repeated ? state.text[0] : state.text;
      const start = repeated ? index + 1 : Math.max(index, 0);
      for (let step = 0; step < count; step += 1) {
        const at = (start + step) % count;
        if (norm(items[at]?.label ?? "").startsWith(needle)) {
          focusAt(at);
          break;
        }
      }
    } else return;
    event.preventDefault();
  };

  if (items.length === 0) return null;

  const accessibleName = ariaLabel ?? (iconOnly ? label : undefined);

  return (
    <div className="adm-actmenu">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`btn${variant === "secondary" ? " out" : ""} adm-actmenu-btn`}
        data-variant={variant}
        data-icon-only={iconOnly ? "true" : undefined}
        aria-label={accessibleName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openWith("first"))}
        onKeyDown={onTriggerKeyDown}
      >
        {iconOnly ? (
          <I n="more" />
        ) : (
          <>
            {label}
            <I n="chev" cls="sm adm-actmenu-chev" />
          </>
        )}
      </button>
      {open
        ? createPortal(
            <div className="pv" data-adm-layer="">
              <div
                ref={listRef}
                id={menuId}
                className="adm-actmenu-list"
                role="menu"
                aria-labelledby={triggerId}
                tabIndex={-1}
                onKeyDown={onMenuKeyDown}
              >
                {items.map((item, index) => {
                  const disabled = !!item.disabled;
                  const danger = item.tone === "danger";
                  const previous = items[index - 1];
                  const separator = index > 0 && (item.separatorBefore ?? (danger && previous?.tone !== "danger"));
                  const reasonId = `${baseId}-why-${item.id}`;
                  const reason = disabled ? item.disabledReason : undefined;
                  return (
                    <Fragment key={item.id}>
                      {separator ? <div className="adm-actmenu-sep" role="separator" /> : null}
                      <button
                        id={`${baseId}-item-${item.id}`}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        className="adm-actmenu-item"
                        data-tone={danger ? "danger" : undefined}
                        aria-disabled={disabled ? true : undefined}
                        aria-describedby={reason ? reasonId : undefined}
                        onMouseMove={(event) => {
                          if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
                        }}
                        onClick={() => {
                          if (disabled) return;
                          close(true);
                          item.onSelect();
                        }}
                      >
                        {item.icon ? <span className="adm-actmenu-ico">{typeof item.icon === "string" ? <I n={item.icon} cls="sm" /> : item.icon}</span> : null}
                        <span className="adm-actmenu-txt">
                          <span>{item.label}</span>
                          {/* `aria-hidden`: o motivo não entra no nome do item, mas segue sendo a descrição dele */}
                          {reason ? (
                            <small id={reasonId} className="adm-actmenu-why" aria-hidden="true">
                              {reason}
                            </small>
                          ) : null}
                        </span>
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
