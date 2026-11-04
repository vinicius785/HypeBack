import { useState } from "react";

import { Av, I } from "@/components/prototype/ui";
import type { TeamChatConversation } from "@/shared/services/team-chat";
import { fmtTime } from "@/shared/utils/chat-time";

import { conversationPreview } from "./format";

interface ConversationListProps {
  conversations: TeamChatConversation[];
  selectedId: string | null;
  me: number | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Sem permissão de escrita (workspace arquivado etc.): "Nova conversa" fica desabilitada. */
  newDisabled?: boolean;
}

/** Lista da aba Equipe: canal fixado no topo, depois as conversas 1 a 1; busca e filtro de não lidas. */
export function ConversationList({ conversations, selectedId, me, onSelect, onNew, newDisabled }: ConversationListProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "un">("all");

  const needle = q.trim().toLowerCase();
  const list = conversations.filter(
    (c) => (filter === "all" || c.unread > 0) && (!needle || c.title.toLowerCase().includes(needle)),
  );

  return (
    <>
      <label className="find ch-s">
        <I n="search" cls="sm" />
        <input placeholder="Buscar conversa" aria-label="Buscar conversa" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      <div className="tc-row">
        <div className="gtabs ch-f2">
          {([["all", "Todas"], ["un", "Não lidas"]] as const).map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? "on" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="btn out tc-new" onClick={onNew} disabled={newDisabled}>
          <I n="plus" cls="sm" />
          Nova conversa
        </button>
      </div>
      <div className="ch-ls">
        {list.length === 0 ? (
          <div className="ov-empty">
            <span>
              <I n="search" />
            </span>
            <b>Nada encontrado</b>
            <small>Tente outro nome ou filtro.</small>
          </div>
        ) : (
          <ul className="tc-ls" role="list" aria-label="Conversas da equipe">
            {list.map((c, i) => {
              const channel = c.kind === "channel";
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`ch-c${selectedId === c.id ? " on" : ""}${c.unread ? " un" : ""}`}
                    style={{ ["--i" as string]: Math.min(i, 8) }}
                    aria-current={selectedId === c.id ? "true" : undefined}
                    onClick={() => onSelect(c.id)}
                  >
                    {channel ? (
                      <span className="ch-g tc-ch" style={{ width: 44, height: 44 }} aria-hidden="true">
                        <I n="users" />
                      </span>
                    ) : (
                      <Av name={c.peer?.name ?? c.title} src={c.peer?.avatar ?? undefined} size={44} />
                    )}
                    <div>
                      <div className="ch-nr">
                        <b>{c.title}</b>
                        {channel && (
                          <span className="ch-tg" style={{ ["--c" as string]: "#9e2cfa" }}>
                            <i />
                            Canal geral
                          </span>
                        )}
                      </div>
                      <small>{conversationPreview(c, me)}</small>
                    </div>
                    <span className="ch-m">
                      {c.last_message && <em>{fmtTime(c.last_message.created_at)}</em>}
                      {c.unread > 0 && <i aria-label={`${c.unread} ${c.unread > 1 ? "não lidas" : "não lida"}`}>{c.unread}</i>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
