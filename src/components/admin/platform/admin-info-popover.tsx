import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-info-popover.css";

interface AdminInfoPopoverProps {
  /**
   * O que o botão explica ("Aportes recebidos"): vai no nome acessível, depois do `prefix`
   * ("Como é calculado: Aportes recebidos"). Pode faltar quando `triggerLabel` já diz tudo.
   */
  label?: string;
  /**
   * Nome acessível COMPLETO do botão, no lugar de `prefix` + `label`. Use quando o "i" explica outra coisa
   * que não um cálculo ("Quem são os outros 3 workspaces", "O que são permissões personalizadas").
   */
  triggerLabel?: string;
  /**
   * Início do nome acessível quando não há `triggerLabel` (padrão "Como é calculado"). `""` usa só o `label`
   * ("Linha do tempo"). Ignorado com `triggerLabel`.
   */
  prefix?: string;
  /**
   * O texto da definição. Para vários parágrafos use `AdminInfoPopover.Paragraph` (um `<span>` em bloco):
   * `<p>` quebraria o HTML quando o "i" está dentro de um parágrafo (subtítulo do cabeçalho, descrição da seção).
   */
  children: ReactNode;
}

/** Nome acessível do botão: `triggerLabel`, ou `prefix: label`, ou só um dos dois. */
function triggerName({ label, triggerLabel, prefix = "Como é calculado" }: Pick<AdminInfoPopoverProps, "label" | "triggerLabel" | "prefix">): string {
  if (triggerLabel) return triggerLabel;
  if (label && prefix) return `${prefix}: ${label}`;
  return label || prefix;
}

/**
 * Parágrafo seguro do conteúdo do "i": um `<span>` em bloco (válido dentro de `<p>`, `<h2>`, `<button>`…),
 * com o espaçamento e a cor de apoio do balão. O primeiro é o texto principal; os seguintes ficam em cinza.
 */
function AdminInfoParagraph({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`adm-info-p ${className}`.trim()}>{children}</span>;
}

/**
 * Botão "i" que abre a definição ("como é calculado") ao lado de um número ou de um cabeçalho de coluna.
 *
 * - teclado: o botão recebe foco; Enter/Espaço abre e fecha, Escape fecha e devolve o foco;
 * - leitor de tela: o texto da definição fica sempre no DOM (oculto, `aria-hidden`) e é a descrição do
 *   botão (`aria-describedby` aceita elemento oculto), então é lido ao focar, sem precisar abrir nada; o
 *   balão visual é só para quem enxerga;
 * - o balão é um portal com `position: fixed`, ajustado para nunca sair da tela (vira para cima se faltar
 *   espaço embaixo), e fecha ao rolar, redimensionar ou clicar fora;
 * - o nome do botão é "Como é calculado: <label>" por padrão; `prefix` troca o início e `triggerLabel` o nome inteiro;
 * - o texto fica em `<span>` (nunca `<div>`/`<p>`), então o "i" pode ficar dentro de um parágrafo; para mais de
 *   um parágrafo use `AdminInfoPopover.Paragraph`.
 */
export function AdminInfoPopover({ label, triggerLabel, prefix, children }: AdminInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  const place = useCallback(() => {
    const button = buttonRef.current;
    const pop = popRef.current;
    if (!button || !pop) return;
    const margin = 12;
    const anchor = button.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - margin));
    const below = anchor.bottom + 8;
    const top = below + height > window.innerHeight - margin ? Math.max(margin, anchor.top - height - 8) : below;
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
    else setPosition(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (buttonRef.current?.contains(target) || popRef.current?.contains(target))) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="adm-info"
        aria-label={triggerName({ label, triggerLabel, prefix })}
        aria-describedby={descriptionId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {/* `aria-hidden`: o texto não entra no nome do cabeçalho/cartão onde o botão está, mas segue sendo a descrição do botão */}
      <span id={descriptionId} className="adm-sr" aria-hidden="true">
        {children}
      </span>
      {open
        ? createPortal(
            <div className="pv" data-adm-layer="">
              <div
                ref={popRef}
                className="adm-pop"
                aria-hidden="true"
                style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
              >
                {children}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

AdminInfoPopover.Paragraph = AdminInfoParagraph;
