import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-dialog.css";

export type AdminDialogSize = "sm" | "md" | "lg";

export interface AdminDialogProps {
  open: boolean;
  /** Pedido para fechar (Esc, clique no fundo, botão de fechar). Não é chamado enquanto `busy`. */
  onClose: () => void;
  /** Obrigatório: é o nome do diálogo para leitor de tela (`aria-labelledby`). */
  title: string;
  /** Frase de apoio sob o título; entra em `aria-describedby`. */
  description?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé: a secundária primeiro e a ação principal por último (ela fica à direita). */
  footer?: ReactNode;
  /** Largura: sm 400, md 520 (padrão), lg 720. Na gaveta: 380, 480 e 640. */
  size?: AdminDialogSize;
  /**
   * Gravando: Esc, clique no fundo e botão de fechar não fecham (o botão fica desabilitado) e o painel
   * ganha `aria-busy`. Os botões do rodapé são do chamador: ele os desabilita.
   */
  busy?: boolean;
  /** Quem recebe o foco ao abrir. Sem isso: o `[data-adm-autofocus]`, senão o primeiro controle do conteúdo. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Nome acessível do botão de fechar. */
  closeLabel?: string;
  /**
   * O chamador tem dado digitado que se perde ao fechar. Com dado a perder, um clique no fundo não fecha
   * (Esc e o botão de fechar continuam fechando).
   */
  dirty?: boolean;
}

/** A gaveta tem as mesmas propriedades do diálogo. */
export type AdminDrawerProps = AdminDialogProps;

/** Controles que recebem foco pelo teclado (o mesmo conjunto do `useModalBehavior`, que não o exporta). */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Primeiro controle visível e alcançável por Tab dentro de `root` (o mesmo filtro do `useModalBehavior`). */
function firstFocusable(root: HTMLElement | null | undefined): HTMLElement | undefined {
  if (!root) return undefined;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
    (el) => !el.closest("[hidden]") && !el.closest("[aria-hidden='true']") && el.getAttribute("tabindex") !== "-1",
  );
}

/**
 * Diálogo centralizado do Admin (formulário curto, aviso, passo de um fluxo). Para confirmar uma ação com
 * motivo e texto digitado use `AdminConfirmDialog`.
 *
 * O que ele garante (`useModalBehavior`): `role="dialog"` + `aria-modal` nomeado pelo título, foco preso e
 * devolvido a quem abriu, Escape que não vaza para a tela de baixo e rolagem da página travada. Renderiza em
 * portal dentro de um `.pv` (os estilos do kit são escopados nele). O conteúdo só existe enquanto `open`: o
 * estado interno dos filhos reinicia a cada abertura.
 *
 * ```tsx
 * <AdminDialog open={open} onClose={close} title="Renomear grupo" busy={saving}
 *   footer={<><button className="btn out" onClick={close}>Cancelar</button><button className="btn">Salvar</button></>}>…</AdminDialog>
 * ```
 */
export function AdminDialog(props: AdminDialogProps) {
  if (!props.open) return null;
  return <AdminModal variant="dialog" {...props} />;
}

/**
 * Painel lateral do Admin (detalhe e formulário longo ao lado da lista). Igual ao `AdminDialog` em tudo que
 * é comportamento; muda a forma: encosta na direita, ocupa a altura toda e vira tela cheia em ≤560.
 */
export function AdminDrawer(props: AdminDrawerProps) {
  if (!props.open) return null;
  return <AdminModal variant="drawer" {...props} />;
}

function AdminModal({
  variant,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
  initialFocusRef,
  closeLabel = "Fechar",
  dirty = false,
  onClose,
}: AdminDialogProps & { variant: "dialog" | "drawer" }) {
  const dialogRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = () => {
    if (!busy) onClose();
  };
  // Sem `onEscape` (gravando) o hook só engole o Escape: nada fecha e a tela de baixo não o recebe.
  useModalBehavior({ open: true, containerRef: dialogRef, onEscape: busy ? undefined : onClose });

  // Declarado depois do hook: roda depois dele, então só refina o foco inicial que ele já deu.
  // O hook cai no primeiro controle do DOM, que é o "Fechar" do cabeçalho; aqui o foco vai para o conteúdo.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const explicit = initialFocusRef?.current;
    if (explicit && dialog.contains(explicit)) {
      explicit.focus();
      return;
    }
    if (dialog.querySelector("[data-adm-autofocus]")) return;
    (firstFocusable(bodyRef.current) ?? firstFocusable(footerRef.current))?.focus();
    // Só na abertura: o corpo muda a cada render e o foco não pode voltar para o primeiro campo a cada tecla.
  }, []);

  // Ao começar a gravar, o botão que a pessoa acabou de acionar (ou o Fechar) fica desabilitado e o navegador
  // larga o foco no <body>: o leitor de tela perderia o lugar. O foco fica no próprio painel.
  useEffect(() => {
    if (!busy) return;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    if (!dialog) return;
    if (!active || active === document.body || !dialog.contains(active) || (active as HTMLElement).matches?.(":disabled")) {
      dialog.focus();
    }
  }, [busy]);

  return createPortal(
    <div className="pv">
      <div
        className="adm-modal"
        data-variant={variant}
        onMouseDown={(event) => {
          // Só um clique que começa no fundo fecha: arrastar a seleção de um campo para fora não é "fechar".
          if (event.target === event.currentTarget && event.button === 0 && !dirty) requestClose();
        }}
      >
        <section
          ref={dialogRef}
          className="adm-modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={busy ? true : undefined}
          data-variant={variant}
          data-size={size}
          tabIndex={-1}
        >
          <header className="adm-modal-h">
            <div className="adm-modal-titles">
              <h2 id={titleId} className="adm-modal-title">
                {title}
              </h2>
              {description ? (
                <div id={descriptionId} className="adm-modal-desc">
                  {description}
                </div>
              ) : null}
            </div>
            <button type="button" className="adm-modal-close" aria-label={closeLabel} disabled={busy} onClick={requestClose}>
              <I n="x" cls="sm" />
            </button>
          </header>

          <div ref={bodyRef} className="adm-modal-b">
            {children}
          </div>

          {footer ? (
            <footer ref={footerRef} className="adm-modal-f">
              {footer}
            </footer>
          ) : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}
