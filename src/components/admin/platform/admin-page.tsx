import type { ReactNode } from "react";

import "@/styles/admin-platform.css";

/**
 * Raiz de uma página do Admin: `.pv` (variáveis e tipografia do protótipo) + coluna com o espaçamento
 * padrão entre cabeçalho, filtros e conteúdo. Todas as telas do Admin começam por aqui.
 */
export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="pv">
      <div className={`adm-page ${className}`.trim()}>{children}</div>
    </div>
  );
}
