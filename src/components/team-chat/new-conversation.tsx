import { useState } from "react";

import { ListSearch, ListSkeleton, StateBlock } from "@/components/message-center/list-parts";
import { ThreadHeader } from "@/components/message-center/thread-header";
import { Av, I } from "@/components/prototype/ui";
import type { TeamChatMember } from "@/shared/services/team-chat";

import { roleLabel } from "./format";

interface NewConversationProps {
  members: TeamChatMember[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Id do membro cuja conversa está sendo aberta (trava o resto até terminar). */
  openingUserId: number | null;
  /** `user_id` de quem já tem conversa 1 a 1 com a pessoa logada: aparece marcado na lista. */
  existingUserIds: ReadonlySet<number>;
  blockedReason: string | null;
  onPick: (member: TeamChatMember) => void;
  /** Cancela e volta ao que estava aberto (a lista de conversas não muda). */
  onBack: () => void;
  /** Leva a quem pode convidar para onde se convida gente (quando o workspace só tem a própria pessoa). */
  onInvite?: () => void;
}

/** "Nova conversa": escolhe uma pessoa do workspace para abrir (ou retomar) a conversa 1 a 1, ao lado da lista. */
export function NewConversation({ members, isLoading, isError, onRetry, openingUserId, existingUserIds, blockedReason, onPick, onBack, onInvite }: NewConversationProps) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const all = members ?? [];
  const list = all.filter((m) => !needle || m.name.toLowerCase().includes(needle) || roleLabel(m.role).toLowerCase().includes(needle));

  let body;
  if (isLoading) {
    body = <ListSkeleton label="Carregando pessoas..." rows={6} />;
  } else if (isError) {
    body = (
      <StateBlock
        role="alert"
        icon="alert"
        title="Não foi possível carregar as pessoas"
        text="Confira a conexão e tente de novo."
        action={{ label: "Tentar de novo", icon: "refresh", onClick: onRetry }}
      />
    );
  } else if (all.length === 0) {
    body = (
      <StateBlock
        icon="users"
        title="Ninguém mais no workspace"
        text="Convide pessoas para o workspace para conversar com elas por aqui."
        action={onInvite ? { label: "Convidar pessoas", icon: "plus", onClick: onInvite } : undefined}
      />
    );
  } else if (list.length === 0) {
    body = (
      <StateBlock
        icon="search"
        title="Nenhuma pessoa encontrada"
        text={`Nada com “${q.trim()}”. Tente outro nome ou função.`}
        action={{ label: "Limpar busca", onClick: () => setQ("") }}
      />
    );
  } else {
    body = (
      <ul className="mc-ul" role="list" aria-label="Pessoas do workspace">
        {list.map((m) => {
          const opening = openingUserId === m.user_id;
          return (
            <li key={m.user_id}>
              <button
                type="button"
                className="mc-person"
                onClick={() => onPick(m)}
                disabled={!!blockedReason || openingUserId !== null}
                aria-busy={opening || undefined}
              >
                <Av name={m.name} src={m.avatar ?? undefined} size={44} />
                <div>
                  <b>{m.name}</b>
                  <small>{roleLabel(m.role)}</small>
                </div>
                {opening ? <span className="mc-kind">Abrindo...</span> : existingUserIds.has(m.user_id) ? <span className="mc-kind">Conversa existente</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <ThreadHeader
        onBack={onBack}
        avatar={
          <span className="mc-ch" aria-hidden="true">
            <I n="plus" />
          </span>
        }
        title="Nova conversa"
        subtitle="Escolha uma pessoa do workspace"
        actions={
          <button type="button" className="btn out" onClick={onBack}>
            Cancelar
          </button>
        }
      />
      <div className="mc-nc">
        <ListSearch value={q} onChange={setQ} placeholder="Buscar por nome ou função" label="Buscar pessoa" autoFocus />
        {blockedReason && (
          <p className="tc-block" role="status">
            <I n="lock" cls="sm" />
            {blockedReason}
          </p>
        )}
        <div className="mc-items">{body}</div>
      </div>
    </>
  );
}
