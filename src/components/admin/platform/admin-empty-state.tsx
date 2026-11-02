import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";

import "@/styles/admin-platform.css";

interface AdminEmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Nome de ícone do mapa `I`. Sem ícone por padrão: o estado vazio é texto. */
  icon?: string;
  /** Botão ou link de saída (ex.: "Limpar filtros"). */
  action?: ReactNode;
  /** Sem a moldura de altura mínima, para uso dentro de uma tabela ou cartão. */
  compact?: boolean;
  /** Sobre o fundo cinza da página (fora de um cartão): vira um cartão branco. */
  boxed?: boolean;
}

/** Lista vazia: diz o que aconteceu e, se houver, o que fazer. */
export function AdminEmptyState({ title, description, icon, action, compact, boxed }: AdminEmptyStateProps) {
  const cls = ["adm-state", compact ? "adm-state-compact" : "", boxed ? "adm-state-boxed" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} role="status">
      {icon ? <I n={icon} /> : null}
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {action ? <div className="adm-state-action">{action}</div> : null}
    </div>
  );
}
