import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkspaceQueryKey } from "@/hooks/use-workspace-query-key";
import type { TeamChatController } from "@/hooks/use-team-chat";
import {
  useOpenDirectConversation,
  useTeamChatConversations,
  useTeamChatMembers,
} from "@/hooks/use-team-chat-queries";
import { isTeamChatRefusalCode, isTeamChatUnavailable, type TeamChatMember } from "@/shared/services/team-chat";

import { ConversationList } from "./conversation-list";
import { ConversationView } from "./conversation-view";
import { NewConversation } from "./new-conversation";
import type { OpenTeamChatRequest } from "./open-team-chat";

interface TeamChatTabProps {
  /** Título e abas da gaveta, que ficam no topo da coluna da lista. */
  top: ReactNode;
  /** Pedido de `openTeamChat` (clique no sino): mesmo objeto = mesmo pedido. */
  request: OpenTeamChatRequest | null;
  chat: TeamChatController;
  /** Avisa a gaveta quando há conversa (ou "nova conversa") aberta: no celular ela ocupa a tela. */
  onThreadChange: (open: boolean) => void;
}

type View = { kind: "none" } | { kind: "new" } | { kind: "conversation"; id: string };

/** Aba Equipe da gaveta: conversas entre as pessoas do mesmo workspace (canal geral + 1 a 1). */
export function TeamChatTab({ top, request, chat, onThreadChange }: TeamChatTabProps) {
  const { user } = useCurrentUser();
  const me = user?.id != null ? Number(user.id) : null;
  const workspaceId = useWorkspaceQueryKey();
  const conversations = useTeamChatConversations();
  const unavailable = isTeamChatUnavailable(conversations.error);
  const [view, setView] = useState<View>({ kind: "none" });
  const [pendingRequest, setPendingRequest] = useState<OpenTeamChatRequest | null>(request);
  const openDirect = useOpenDirectConversation();
  const [opening, setOpening] = useState<number | null>(null);
  const members = useTeamChatMembers(view.kind === "new");

  const list = conversations.data;
  const current = view.kind === "conversation" ? (list?.find((c) => c.id === view.id) ?? null) : null;

  useLayoutEffect(() => {
    onThreadChange(view.kind === "new" || current !== null);
  }, [view.kind, current, onThreadChange]);

  useEffect(() => {
    if (request) setPendingRequest(request);
  }, [request]);

  // Pedido de abertura: por conversa (direto) ou por pessoa (usa a conversa 1 a 1 que já existe, ou cria).
  useEffect(() => {
    if (!pendingRequest) return;
    // Pedido de outro workspace (clique no sino): espera a troca de workspace terminar, para não abrir a conversa
    // procurando-a na lista do workspace errado.
    if (pendingRequest.workspaceId && workspaceId && pendingRequest.workspaceId !== workspaceId) return;
    if (pendingRequest.conversationId) {
      setView({ kind: "conversation", id: pendingRequest.conversationId });
      setPendingRequest(null);
      return;
    }
    const userId = pendingRequest.userId;
    if (userId == null) {
      setPendingRequest(null);
      return;
    }
    if (!list) return;
    setPendingRequest(null);
    const found = list.find((c) => c.kind === "direct" && c.peer?.user_id === userId);
    if (found) {
      setView({ kind: "conversation", id: found.id });
      return;
    }
    openDirect.mutate(userId, {
      onSuccess: (c) => setView({ kind: "conversation", id: c.id }),
      onError: () => toast.error("Não foi possível abrir a conversa."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest, list, workspaceId]);

  // Conversa pedida que a lista ainda não conhece (criada agora por outra pessoa): busca de novo uma vez; se
  // continuar fora, volta para a lista em vez de ficar vazio.
  const refetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (view.kind !== "conversation" || !list || list.some((c) => c.id === view.id)) return;
    if (refetchedFor.current !== view.id && !conversations.isFetching) {
      refetchedFor.current = view.id;
      void conversations.refetch();
      return;
    }
    if (!conversations.isFetching) setView({ kind: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, list, conversations.isFetching]);

  const pick = async (member: TeamChatMember) => {
    if (opening !== null) return;
    setOpening(member.user_id);
    try {
      const c = await openDirect.mutateAsync(member.user_id);
      setView({ kind: "conversation", id: c.id });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      setOpening(null);
    }
  };

  const left = unavailable ? (
    <div className="ch-ls">
      <div className="ov-empty big">
        <span>
          <I n="clock" />
        </span>
        <b>Disponível em breve</b>
        <small>O chat da equipe ainda está sendo liberado. As conversas com criadores seguem na aba Criadores.</small>
      </div>
    </div>
  ) : conversations.isLoading ? (
    <div className="ch-ls">
      <div className="ov-empty" role="status">
        <small>Carregando conversas...</small>
      </div>
    </div>
  ) : conversations.isError ? (
    <div className="ch-ls">
      <div className="ov-empty" role="alert">
        <span>
          <I n="alert" />
        </span>
        <b>Não foi possível carregar as conversas</b>
        <button type="button" className="btn out" onClick={() => void conversations.refetch()}>
          <I n="refresh" cls="sm" />
          Tentar de novo
        </button>
      </div>
    </div>
  ) : (
    <ConversationList
      conversations={list ?? []}
      selectedId={current?.id ?? null}
      me={me}
      onSelect={(id) => setView({ kind: "conversation", id })}
      onNew={() => setView({ kind: "new" })}
      newDisabled={chat.blocked !== null}
    />
  );

  return (
    <>
      <div className="ch-l">
        {top}
        {chat.blocked && isTeamChatRefusalCode(chat.blocked.code) && (
          <p className="tc-block" role="alert" style={{ margin: "0 16px 10px" }}>
            <I n="lock" cls="sm" />
            {chat.blocked.message}
          </p>
        )}
        {left}
      </div>
      <div className="ch-r">
        {view.kind === "new" && !unavailable ? (
          <NewConversation
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => void members.refetch()}
            openingUserId={opening}
            blockedReason={chat.blocked?.message ?? null}
            onPick={pick}
            onBack={() => setView({ kind: "none" })}
          />
        ) : current ? (
          <ConversationView key={current.id} conversation={current} chat={chat} me={me} onBack={() => setView({ kind: "none" })} />
        ) : (
          <div className="ov-empty big">
            <span>
              <I n="msg" />
            </span>
            <b>{unavailable ? "Chat da equipe em breve" : "Selecione uma conversa"}</b>
            <small>
              {unavailable
                ? "Quando estiver liberado, você conversa aqui com as pessoas do seu workspace."
                : "Converse com as pessoas do seu workspace, no canal da equipe ou em particular."}
            </small>
          </div>
        )}
      </div>
    </>
  );
}
