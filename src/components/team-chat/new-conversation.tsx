import { useState } from "react";

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
  blockedReason: string | null;
  onPick: (member: TeamChatMember) => void;
  onBack: () => void;
}

/** "Nova conversa": escolhe uma pessoa do workspace para abrir (ou retomar) a conversa 1 a 1. */
export function NewConversation({ members, isLoading, isError, onRetry, openingUserId, blockedReason, onPick, onBack }: NewConversationProps) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = (members ?? []).filter((m) => !needle || m.name.toLowerCase().includes(needle));

  return (
    <>
      <div className="ch-th">
        <button type="button" className="round ch-bk" onClick={onBack} aria-label="Voltar às conversas">
          <I n="back" cls="sm" />
        </button>
        <div>
          <b>Nova conversa</b>
          <small>Escolha uma pessoa do workspace</small>
        </div>
      </div>
      <div className="tc-nc">
        <label className="find ch-s">
          <I n="search" cls="sm" />
          <input
            placeholder="Buscar pessoa"
            aria-label="Buscar pessoa"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </label>
        {blockedReason && (
          <p className="tc-block" role="status">
            <I n="lock" cls="sm" />
            {blockedReason}
          </p>
        )}
        <div className="ch-ls">
          {isLoading ? (
            <div className="ov-empty" role="status">
              <small>Carregando pessoas...</small>
            </div>
          ) : isError ? (
            <div className="ov-empty" role="alert">
              <span>
                <I n="alert" />
              </span>
              <b>Não foi possível carregar as pessoas</b>
              <button type="button" className="btn out" onClick={onRetry}>
                <I n="refresh" cls="sm" />
                Tentar de novo
              </button>
            </div>
          ) : (members ?? []).length === 0 ? (
            <div className="ov-empty">
              <span>
                <I n="users" />
              </span>
              <b>Ninguém mais no workspace</b>
              <small>Convide pessoas em Gerenciar workspace para conversar por aqui.</small>
            </div>
          ) : list.length === 0 ? (
            <div className="ov-empty">
              <span>
                <I n="search" />
              </span>
              <b>Nada encontrado</b>
              <small>Tente outro nome.</small>
            </div>
          ) : (
            <ul className="tc-ls" role="list" aria-label="Pessoas do workspace">
              {list.map((m) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    className="ch-c"
                    onClick={() => onPick(m)}
                    disabled={!!blockedReason || openingUserId !== null}
                    aria-busy={openingUserId === m.user_id || undefined}
                  >
                    <Av name={m.name} src={m.avatar ?? undefined} size={44} />
                    <div>
                      <b>{m.name}</b>
                      <small>{roleLabel(m.role)}</small>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
