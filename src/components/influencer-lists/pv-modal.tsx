import { useEffect } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";

interface PvModalProps {
  /** Texto pequeno acima do título (`cmShell` do protótipo). */
  sub: string;
  title: string;
  onClose: () => void;
  /** Rodapé `.cm-f` (omitido quando não informado). */
  footer?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}

/** Casca `cmShell` do protótipo: backdrop + diálogo `ovd` com cabeçalho e rodapé. */
export function PvModal({ sub, title, onClose, footer, wide, children }: PvModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={onClose} />
      <div className="ovw">
        <section
          className={`ovd on${wide ? " wide" : ""}`}
          role="dialog"
          aria-label={title}
        >
          <div className="sh-h cm-h">
            <div>
              <small>{sub}</small>
              <h2>{title}</h2>
            </div>
            <button type="button" className="round" onClick={onClose} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className="sh-b cm-b">{children}</div>
          {footer ? <div className="cm-f">{footer}</div> : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}
