import { useId, type ReactNode } from "react";

import "@/styles/admin-platform.css";

interface AdminSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Ações do cabeçalho do cartão (alinhadas à direita). */
  actions?: ReactNode;
  /** Sem o respiro interno: para conteúdo que vai de ponta a ponta (tabela, lista com divisores). */
  flush?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Cartão branco (raio 28) com título de seção (18px), descrição e ações. É a "seção" de toda página do Admin. */
export function AdminSection({ title, description, actions, flush, children, className = "" }: AdminSectionProps) {
  const headingId = useId();
  const hasHeader = !!title || !!description || !!actions;
  return (
    <section className={`adm-card${flush ? " adm-card-flush" : ""} ${className}`.trim()} aria-labelledby={title ? headingId : undefined}>
      {hasHeader ? (
        <div className="adm-card-h">
          <div>
            {title ? <h2 id={headingId}>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="adm-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
