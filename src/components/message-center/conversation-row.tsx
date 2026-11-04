import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";

interface ConversationRowProps {
  selected: boolean;
  unread: number;
  /** Foto/iniciais (conversa 1 a 1) — ignorado quando `channel`. */
  avatar?: ReactNode;
  /** Canal: avatar de ícone, em quadrado arredondado, para não parecer uma pessoa. */
  channel?: boolean;
  title: string;
  /** Horário curto da última mensagem. */
  time?: string;
  /** Prévia já com o remetente quando faz sentido ("Você: ...", "Ana: ..."). */
  preview: string;
  /** Selo ao lado do nome (ex.: "Canal geral"). */
  kind?: string;
  /** Linha de contexto abaixo da prévia (ex.: a campanha, nos Criadores). */
  tag?: string;
  onSelect: () => void;
  /** Posição na lista: escalona a entrada da linha (até a 9ª). */
  index?: number;
}

/** Linha da lista de conversas: nome, horário, prévia e contador, com hierarquia igual nas duas abas. */
export function ConversationRow({ selected, unread, avatar, channel, title, time, preview, kind, tag, onSelect, index = 0 }: ConversationRowProps) {
  return (
    <button
      type="button"
      className={`mc-row${selected ? " on" : ""}${unread > 0 ? " un" : ""}`}
      aria-current={selected ? "true" : undefined}
      style={{ ["--i" as string]: Math.min(index, 8) }}
      onClick={onSelect}
    >
      {channel ? (
        <span className="mc-ch" aria-hidden="true">
          <I n="users" />
        </span>
      ) : (
        avatar
      )}
      <span className="mc-rb">
        <span className="mc-rh">
          <b>{title}</b>
          {kind && <span className="mc-kind">{kind}</span>}
          {time && <em>{time}</em>}
        </span>
        <span className="mc-rp">
          <span>{preview}</span>
          {unread > 0 && (
            <i className="mc-badge" aria-label={`${unread} ${unread > 1 ? "não lidas" : "não lida"}`}>
              {unread}
            </i>
          )}
        </span>
        {tag && <span className="mc-tag">{tag}</span>}
      </span>
    </button>
  );
}
