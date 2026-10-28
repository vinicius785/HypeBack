import { useId, useState, type ReactNode } from "react";

import { clsx } from "clsx";

import { Icon } from "@/components/ui/icon";

/**
 * Tooltip acessível e leve (sem dependências externas).
 *
 * Padrão: balão aparece ao hover do mouse OU focus pelo teclado no trigger.
 * O conteúdo do tooltip é vinculado ao trigger via `aria-describedby` para
 * leitores de tela.
 *
 * Uso:
 *   <Tooltip content="Explicação...">
 *     <Icon name="Info" size={14} />
 *   </Tooltip>
 *
 * Se nenhum `children` for passado, usa um ícone de info por padrão (caso de
 * uso mais comum em labels de formulário).
 */
interface TooltipProps {
  /** Texto ou nó exibido no balão. */
  content: ReactNode;
  /** Posição do balão. Default `top`. */
  side?: "top" | "bottom" | "left" | "right";
  /** Elemento que dispara o tooltip. Default: ícone de info. */
  children?: ReactNode;
  /** Largura máxima do balão. Default `max-w-xs` (~20rem). */
  className?: string;
}

const SIDE_POSITION: Record<
  NonNullable<TooltipProps["side"]>,
  string
> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ARROW_POSITION: Record<
  NonNullable<TooltipProps["side"]>,
  string
> = {
  top: "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-neutral-950",
  bottom: "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-neutral-950",
  left: "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-neutral-950",
  right: "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-neutral-950",
};

export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center">
      <span
        tabIndex={0}
        role="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center cursor-help text-neutral-400 hover:text-neutral-700 transition-colors outline-none focus-visible:text-primary-600"
      >
        {children ?? <Icon name="Info" size={14} color="currentColor" />}
      </span>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={clsx(
            "absolute z-50 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white shadow-lg leading-relaxed",
            "max-w-xs w-max pointer-events-none",
            SIDE_POSITION[side],
            className,
          )}
        >
          {content}
          <span
            aria-hidden
            className={clsx(
              "absolute w-0 h-0 border-4 border-transparent",
              ARROW_POSITION[side],
            )}
          />
        </span>
      )}
    </span>
  );
}
