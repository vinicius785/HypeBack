import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ChatColumns, type ChatSlots } from "@/components/message-center/chat-columns";
import { StateBlock } from "@/components/message-center/list-parts";
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

import { ConversationList, type ConversationListStatus } from "./conversation-list";
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
  /** Leva a quem pode convidar para onde se convida gente ao workspace. */
  onInvite?: () => void;
  /** Dentro da gaveta: onde projetar a lista e a conversa (o título e as abas ficam fixos, sem remontar). */
  slots?: ChatSlots;
}

type View = { kind: "none" } | { kind: "new" } | { kind: "conversation"; id: string };

/** Aba Equipe da gaveta: conversas entre as pessoas do mesmo workspace (canal geral + 1 a 1). */
export function TeamChatTab({ top, request, chat, onThreadChange, onInvite, slots }: TeamChatTabProps) {
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

  const status: ConversationListStatus = unavailable
    ? "unavailable"
    : conversations.isLoading
      ? "loading"
      : conversations.isError
        ? "error"
        : "ready";
  // Quem já tem conversa 1 a 1 comigo aparece marcado na "Nova conversa".
  const existingUserIds = useMemo(
    () => new Set((list ?? []).flatMap((c) => (c.kind === "direct" && c.peer ? [c.peer.user_id] : []))),
    [list],
  );

  return (
    <ChatColumns
      top={top}
      slots={slots}
      list={
        <>
        {chat.blocked && isTeamChatRefusalCode(chat.blocked.code) && (
          <p className="tc-block" role="alert" style={{ margin: "0 20px 10px" }}>
            <I n="lock" cls="sm" />
            {chat.blocked.message}
          </p>
        )}
        <ConversationList
          conversations={list ?? []}
          selectedId={current?.id ?? null}
          me={me}
          status={status}
          onRetry={() => void conversations.refetch()}
          onSelect={(id) => setView({ kind: "conversation", id })}
          onNew={() => setView({ kind: "new" })}
          newOpen={view.kind === "new"}
          newDisabled={chat.blocked !== null}
        />
        </>
      }
      thread={
        <>
        {view.kind === "new" && !unavailable ? (
          <NewConversation
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => void members.refetch()}
            openingUserId={opening}
            existingUserIds={existingUserIds}
            blockedReason={chat.blocked?.message ?? null}
            onPick={pick}
            onBack={() => setView({ kind: "none" })}
            onInvite={onInvite}
          />
        ) : current ? (
          <ConversationView key={current.id} conversation={current} chat={chat} me={me} onBack={() => setView({ kind: "none" })} />
        ) : unavailable ? (
          <StateBlock fill icon="msg" title="Chat da equipe em breve" text="Quando estiver liberado, você conversa aqui com as pessoas do seu workspace." />
        ) : (
          <StateBlock
            fill
            icon="msg"
            title="Nenhuma conversa selecionada"
            text="Escolha uma conversa na lista, no canal da equipe ou em particular, ou comece uma nova."
            action={chat.blocked !== null ? undefined : { label: "Nova conversa", icon: "plus", onClick: () => setView({ kind: "new" }) }}
          />
        )}
        </>
      }
    />
  );
}
