import { useState } from "react";

import { ConversationRow } from "@/components/message-center/conversation-row";
import { FilterRow, ListSearch, ListSkeleton, StateBlock, type ListFilter } from "@/components/message-center/list-parts";
import { Av, I } from "@/components/prototype/ui";
import type { TeamChatConversation } from "@/shared/services/team-chat";
import { fmtTime } from "@/shared/utils/chat-time";

import { conversationPreview } from "./format";

export type ConversationListStatus = "ready" | "loading" | "error" | "unavailable";

interface ConversationListProps {
  conversations: TeamChatConversation[];
  selectedId: string | null;
  me: number | null;
  status: ConversationListStatus;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** "Nova conversa" está aberta na área da conversa. */
  newOpen?: boolean;
  /** Sem permissão de escrita (workspace arquivado etc.): "Nova conversa" fica desabilitada. */
  newDisabled?: boolean;
}

/**
 * Lista da aba Equipe: busca, filtros (Todas / Não lidas) e "Nova conversa" sempre à vista; o canal vem primeiro, as
 * conversas 1 a 1 depois. Cada situação sem conversa (nenhuma, nada achado, nenhuma não lida) diz o que fazer.
 */
export function ConversationList({ conversations, selectedId, me, status, onRetry, onSelect, onNew, newOpen, newDisabled }: ConversationListProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");

  if (status === "unavailable") {
    return (
      <StateBlock
        icon="clock"
        title="Disponível em breve"
        text="O chat da equipe ainda está sendo liberado. As conversas com criadores seguem na aba Criadores."
      />
    );
  }

  const needle = q.trim().toLowerCase();
  const unreadCount = conversations.filter((c) => c.unread > 0).length;
  const list = conversations.filter((c) => (filter === "all" || c.unread > 0) && (!needle || c.title.toLowerCase().includes(needle)));
  const channels = list.filter((c) => c.kind === "channel");
  const directs = list.filter((c) => c.kind !== "channel");

  const row = (c: TeamChatConversation, i: number) => {
    const channel = c.kind === "channel";
    return (
      <li key={c.id}>
        <ConversationRow
          index={i}
          selected={selectedId === c.id}
          unread={c.unread}
          channel={channel}
          avatar={channel ? undefined : <Av name={c.peer?.name ?? c.title} src={c.peer?.avatar ?? undefined} size={44} />}
          title={c.title}
          kind={channel ? "Canal geral" : undefined}
          time={c.last_message ? fmtTime(c.last_message.created_at) : undefined}
          preview={conversationPreview(c, me)}
          onSelect={() => onSelect(c.id)}
        />
      </li>
    );
  };

  let body;
  if (status === "loading") {
    body = <ListSkeleton label="Carregando conversas..." />;
  } else if (status === "error") {
    body = (
      <StateBlock
        role="alert"
        icon="alert"
        title="Não foi possível carregar as conversas"
        text="Confira a conexão e tente de novo."
        action={{ label: "Tentar de novo", icon: "refresh", onClick: onRetry }}
      />
    );
  } else if (conversations.length === 0) {
    body = (
      <StateBlock
        icon="msg"
        title="Nenhuma conversa ainda"
        text="Comece uma conversa com alguém do seu workspace."
        action={newDisabled ? undefined : { label: "Nova conversa", icon: "plus", onClick: onNew }}
      />
    );
  } else if (list.length === 0) {
    body =
      filter === "un" && !needle ? (
        <StateBlock
          icon="check"
          title="Nenhuma conversa não lida"
          text="Você está em dia com a equipe."
          action={{ label: "Ver todas as conversas", onClick: () => setFilter("all") }}
        />
      ) : (
        <StateBlock
          icon="search"
          title="Nenhuma conversa encontrada"
          text={needle ? `Nada com “${q.trim()}”. Tente outro nome.` : "Tente outro filtro."}
          action={{ label: needle ? "Limpar busca" : "Ver todas as conversas", onClick: () => (needle ? setQ("") : setFilter("all")) }}
        />
      );
  } else {
    body = (
      <ul className="mc-ul" role="list" aria-label="Conversas da equipe">
        {channels.length > 0 && directs.length > 0 && (
          <li role="presentation" className="mc-sec">
            Canal
          </li>
        )}
        {channels.map((c, i) => row(c, i))}
        {channels.length > 0 && directs.length > 0 && (
          <li role="presentation" className="mc-sec">
            Conversas diretas
          </li>
        )}
        {directs.map((c, i) => row(c, channels.length + i))}
      </ul>
    );
  }

  return (
    <>
      <ListSearch value={q} onChange={setQ} placeholder="Buscar conversa ou pessoa" />
      <FilterRow filter={filter} onFilter={setFilter} unread={unreadCount}>
        <button type="button" className="btn mc-new" onClick={onNew} disabled={newDisabled} aria-pressed={newOpen || undefined}>
          <I n="plus" cls="sm" />
          <span className="mc-new-t">Nova conversa</span>
        </button>
      </FilterRow>
      <div className="mc-items">{body}</div>
    </>
  );
}
