import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-tooltip.css";

/**
 * Ícone do kit: o nome do ícone do protótipo (`MAP` em `components/prototype/ui.tsx`: `"more"`, `"x"`, `"trash"`,
 * `"ban"`, `"copy"`, `"link"`, `"refresh"`, `"gear"`, `"send"`…) ou um elemento já pronto (ex.: um ícone do lucide).
 * Atenção: nome que não existe no `MAP` (ex.: `"edit"`) renderiza um círculo, sem erro. Se faltar o ícone, passe o elemento.
 */
export type AdminIconSpec = string | ReactElement;

/** Tempo entre o mouse sair do gatilho e a dica sumir: dá para atravessar o vão e passar o mouse sobre a dica. */
const HIDE_GRACE_MS = 100;

/**
 * O foco veio do teclado (ou de um script depois do teclado)? Foco devolvido por código depois de um clique
 * (ex.: o diálogo fecha e o foco volta ao botão) não é `:focus-visible`, e a dica não deve pipocar sobre o botão.
 * Navegador sem o seletor: trata como teclado (o comportamento anterior).
 */
function isKeyboardFocus(target: EventTarget): boolean {
  try {
    return (target as Element).matches(":focus-visible");
  } catch {
    return true;
  }
}

interface AdminTooltipProps {
  /** O texto da dica. Curto: é um rótulo, não um parágrafo. */
  content: ReactNode;
  /** UM elemento focável (botão, link): ele recebe o `aria-describedby`. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /** Lado preferido; inverte sozinho quando falta espaço. Padrão: em cima. */
  placement?: "top" | "bottom";
  /** Atraso do mouse (ms) antes de mostrar. O foco por teclado mostra na hora. Padrão: 400. */
  delay?: number;
  /**
   * Liga o `aria-describedby` (padrão). `false` quando a dica repete o nome do próprio filho
   * (`AdminIconButton`): o leitor de tela leria o mesmo texto duas vezes.
   */
  describe?: boolean;
}

/**
 * Dica que aparece ao passar o mouse E ao focar por teclado (`role="tooltip"`), some com Escape (sem fechar o
 * diálogo ou menu por baixo) e não aparece em toque. Não carrega informação essencial: é só o nome/explicação
 * curta do gatilho.
 *
 * - leitor de tela: o texto fica sempre no DOM (oculto, `aria-hidden`) e é a descrição do filho
 *   (`aria-describedby`), então é lido ao focar mesmo antes de a dica visual aparecer;
 * - o balão é um portal com `position: fixed`, ajustado para não sair da tela e invertido perto da borda;
 *   some ao rolar ou redimensionar;
 * - o mouse pode passar sobre a dica sem ela sumir (WCAG 1.4.13).
 */
export function AdminTooltip({ content, children, placement = "top", delay = 400, describe = true }: AdminTooltipProps) {
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  /** Onde o gatilho estava quando a dica foi posicionada: a rolagem só dispensa se o gatilho de fato se mexeu. */
  const placedAt = useRef<{ top: number; left: number } | null>(null);
  /** Foco que veio de um clique/toque: não mostra a dica (em toque ela taparia o que a pessoa acabou de tocar). */
  const pointerFocusRef = useRef(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const descriptionId = useId();

  const sync = useCallback(() => setVisible(hoverRef.current || focusRef.current), []);

  const clearTimers = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const enter = () => {
    window.clearTimeout(hideTimer.current);
    if (hoverRef.current) return;
    window.clearTimeout(showTimer.current);
    if (delay <= 0) {
      hoverRef.current = true;
      sync();
      return;
    }
    showTimer.current = window.setTimeout(() => {
      hoverRef.current = true;
      sync();
    }, delay);
  };

  const leave = () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      hoverRef.current = false;
      sync();
    }, HIDE_GRACE_MS);
  };

  const dismiss = useCallback(() => {
    clearTimers();
    hoverRef.current = false;
    focusRef.current = false;
    sync();
  }, [clearTimers, sync]);

  const place = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    const margin = 8;
    const gap = 8;
    const anchor = wrap.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - margin));
    const above = anchor.top - gap - height;
    const below = anchor.bottom + gap;
    const fitsAbove = above >= margin;
    const fitsBelow = below + height <= window.innerHeight - margin;
    const useTop = placement === "top" ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(margin, useTop ? above : below)}px`;
    tip.dataset.placement = useTop ? "top" : "bottom";
    placedAt.current = { top: anchor.top, left: anchor.left };
  }, [placement]);

  useLayoutEffect(() => {
    if (visible) place();
  }, [visible, place, content]);

  useEffect(() => {
    if (!visible) return;
    // Captura: a dica some antes de o Escape chegar ao diálogo/menu de baixo (a pessoa fecha uma coisa por vez).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss();
    };
    // Tab para um botão fora da tela faz o navegador rolar até ele DEPOIS de a dica abrir: esse evento de rolagem
    // não move o gatilho em relação à janela (a dica já foi posicionada com a rolagem final), então não dispensa.
    const onScroll = () => {
      const anchor = wrapRef.current?.getBoundingClientRect();
      const placed = placedAt.current;
      if (anchor && placed && Math.abs(anchor.top - placed.top) < 1 && Math.abs(anchor.left - placed.left) < 1) return;
      dismiss();
    };
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [visible, dismiss]);

  const child = Children.only(children);
  if (!isValidElement(child)) return child;
  const describedBy = describe ? [child.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") : child.props["aria-describedby"];
  const target = cloneElement(child, describedBy ? { "aria-describedby": describedBy } : {});

  return (
    <>
      <span
        ref={wrapRef}
        className="adm-tip-wrap"
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          enter();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "touch") return;
          leave();
        }}
        onPointerDown={() => {
          // Clicar/tocar já mostrou o que tinha para mostrar: tira a dica e não deixa o foco do clique reabri-la.
          pointerFocusRef.current = true;
          clearTimers();
          hoverRef.current = false;
          sync();
        }}
        onPointerUp={() => {
          pointerFocusRef.current = false;
        }}
        onPointerCancel={() => {
          pointerFocusRef.current = false;
        }}
        onFocus={(event) => {
          if (pointerFocusRef.current || !isKeyboardFocus(event.target)) return;
          focusRef.current = true;
          sync();
        }}
        onBlur={() => {
          pointerFocusRef.current = false;
          focusRef.current = false;
          sync();
        }}
      >
        {target}
        {/* Dentro do invólucro (e não ao lado): num contêiner como `.adm-cell-actions > *`, que dá `position: relative`
            a todo filho direto, um irmão solto perderia o `position: absolute` do `.adm-sr` e ocuparia espaço. */}
        {describe ? (
          <span id={descriptionId} className="adm-sr" aria-hidden="true">
            {content}
          </span>
        ) : null}
      </span>
      {visible
        ? createPortal(
            <div className="pv" data-adm-layer="">
              <div
                ref={tipRef}
                className="adm-tip"
                role="tooltip"
                onPointerEnter={() => window.clearTimeout(hideTimer.current)}
                onPointerLeave={leave}
              >
                {content}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export interface AdminIconButtonProps extends Omit<ComponentProps<"button">, "children" | "aria-label" | "type"> {
  /** O que o botão faz ("Remover membro"): vira o `aria-label` e o texto da dica. Obrigatório (não há texto visível). */
  label: string;
  /** Nome do ícone do protótipo (`"x"`, `"more"`…) ou um elemento já pronto. */
  icon: AdminIconSpec;
  /** `danger`: vermelho (ação destrutiva). */
  tone?: "default" | "danger";
  /** `sm`: desenho menor; a área clicável continua com o alvo mínimo de toque. */
  size?: "md" | "sm";
  /** Lado preferido da dica. */
  tooltipPlacement?: "top" | "bottom";
}

/**
 * Botão só com ícone: o nome acessível e a dica vêm do `label` (um só texto). Área mínima `var(--adm-hit)`,
 * foco por teclado com o anel do kit. Desabilitado, a dica continua aparecendo no mouse (o botão não recebe foco).
 */
export function AdminIconButton({ label, icon, tone = "default", size = "md", className, onClick, tooltipPlacement, ...rest }: AdminIconButtonProps) {
  return (
    <AdminTooltip content={label} placement={tooltipPlacement} describe={false}>
      <button
        {...rest}
        type="button"
        className={className ? `adm-ibtn ${className}` : "adm-ibtn"}
        aria-label={label}
        data-tone={tone}
        data-size={size}
        onClick={onClick}
      >
        {typeof icon === "string" ? <I n={icon} /> : icon}
      </button>
    </AdminTooltip>
  );
}
