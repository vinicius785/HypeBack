import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";

/**
 * Cabeçalho fixo da conversa: no celular o "Conversas" (voltar à lista) fica sempre à vista; ao lado vêm o avatar, o
 * nome, o tipo da conversa com o contexto do workspace e as ações da conversa.
 */
export function ThreadHeader({
  onBack,
  avatar,
  title,
  subtitle,
  actions,
}: {
  onBack: () => void;
  avatar: ReactNode;
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mc-th">
      <button type="button" className="mc-back" onClick={onBack} aria-label="Voltar às conversas">
        <I n="back" cls="sm" />
        Conversas
      </button>
      {avatar}
      <div className="mc-ti">
        <b>{title}</b>
        <small>{subtitle}</small>
      </div>
      {actions}
    </div>
  );
}
