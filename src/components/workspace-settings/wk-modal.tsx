import { useEffect } from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";

import "@/styles/prototype-workspace.css";

interface WkModalProps {
  /** Classes extras do diálogo (`wkm`, `wki`). */
  cls: string;
  sub: string;
  title: string;
  onClose: () => void;
  bodyCls?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** Casca `wkShell` do protótipo (backdrop + `ovd wkm`). */
export function WkModal({ cls, sub, title, onClose, bodyCls = "sh-b wkm-b", footer, children }: WkModalProps) {
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
        <section className={`ovd on ${cls}`} role="dialog" aria-label={title}>
          <div className="sh-h cm-h">
            <div>
              <small>{sub}</small>
              <h2>{title}</h2>
            </div>
            <button type="button" className="round" onClick={onClose} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className={bodyCls}>{children}</div>
          <div className="cm-f">{footer}</div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
