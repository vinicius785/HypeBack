import { useEffect } from "react";

import { clsx } from "clsx";

import { Icon } from "@/components/ui/icon";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Largura customizada do painel (Tailwind classes). Default: `sm:max-w-md` (~28rem). */
  panelClassName?: string;
  /** Conteúdo opcional fixo no rodapé do drawer (ex.: botões CTA). */
  footer?: React.ReactNode;
}

/**
 * Drawer lateral (slide-in da direita). Mesma estética do `<Modal>` mas
 * pensado para fluxos persistentes — saldo, listas, formulários — onde o
 * usuário quer manter contexto da tela atrás.
 *
 * Fecha em ESC, click no backdrop e botão X.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  panelClassName,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <aside
        className={clsx(
          "relative h-full w-full bg-white shadow-2xl flex flex-col border-l border-neutral-200/80",
          panelClassName ?? "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-200/80 shrink-0">
            <h2 className="text-lg font-semibold text-neutral-950 tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <Icon name="X" size={20} color="#525252" />
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="px-6 py-4 border-t border-neutral-200/80 shrink-0 bg-white">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
