/**
 * Dados do chat da equipe (TanStack Query): conversas, membros, mensagens paginadas e não lidas.
 * As chaves levam o workspace (`withWorkspaceKey`), então trocar de workspace nunca mostra o cache do outro.
 * Os atualizadores de cache no fim do arquivo são usados pelo socket (`use-team-chat.ts`) e pelo envio.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import { getAuthToken } from "@/lib/utils/api";
import { shouldRetryQuery } from "@/lib/workspace-state/query-client";
import {
  getTeamChatUnread,
  isTeamChatUnavailable,
  listTeamChatMembers,
  listTeamChatMessages,
  listTeamConversations,
  messageIndex,
  openDirectConversation,
  TEAM_CHAT_PAGE_SIZE,
  type TeamChatConversation,
  type TeamChatMessage,
  type TeamChatMessagesPage,
  type TeamChatUnread,
} from "@/shared/services/team-chat";

export const TEAM_CHAT_ROOT = "team-chat";

export const teamChatKeys = {
  conversations: (ws: string | undefined) => withWorkspaceKey([TEAM_CHAT_ROOT, "conversations"], ws),
  members: (ws: string | undefined) => withWorkspaceKey([TEAM_CHAT_ROOT, "members"], ws),
  unread: (ws: string | undefined) => withWorkspaceKey([TEAM_CHAT_ROOT, "unread"], ws),
  messages: (conversationId: string, ws: string | undefined) =>
    withWorkspaceKey([TEAM_CHAT_ROOT, "messages", conversationId], ws),
};

type MessagesData = InfiniteData<TeamChatMessagesPage, string | undefined>;

const UNREAD_POLL_MS = 60_000;

/**
 * Aba aberta ANTES de a API ter o chat (404 = "indisponível"): reverifica sozinha, sem exigir recarregar a página.
 * Quando a API passa a responder, `unavailable` vira `false` e o socket liga na hora.
 */
export const UNAVAILABLE_RECHECK_MS = 30_000;

/** Intervalo da consulta de não lidas: devagar quando o chat está indisponível, no ritmo normal quando funciona. */
export const unreadRefetchInterval = (error: unknown): number =>
  isTeamChatUnavailable(error) ? UNAVAILABLE_RECHECK_MS : UNREAD_POLL_MS;

/** 404 de "API antiga" não se repete; o resto segue a política do app (sem repetir recusas de estado do workspace). */
const retry = (failureCount: number, error: unknown) =>
  !isTeamChatUnavailable(error) && shouldRetryQuery(failureCount, error);

/** O chat só roda com sessão e workspace, e não num workspace suspenso (toda chamada seria recusada). */
export function useTeamChatEnabled(): boolean {
  const workspaceId = useWorkspaceQueryKey();
  const { selectedWorkspace } = useWorkspaceContext();
  return !!workspaceId && !!getAuthToken() && selectedWorkspace?.status !== "suspended";
}

/** Não lidas (botão do cabeçalho). `unavailable` = a API ainda não tem o chat da equipe. */
export function useTeamChatUnread(enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  const query = useQuery({
    queryKey: teamChatKeys.unread(workspaceId),
    queryFn: getTeamChatUnread,
    enabled: enabled && !!workspaceId,
    staleTime: 30_000,
    // Reserva do socket: se ele cair, o contador ainda se corrige.
    refetchInterval: (q) => unreadRefetchInterval(q.state.error),
    retry,
  });
  return {
    total: query.data?.total ?? 0,
    byConversation: query.data?.by_conversation ?? {},
    unavailable: isTeamChatUnavailable(query.error),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useTeamChatConversations(enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: teamChatKeys.conversations(workspaceId),
    queryFn: listTeamConversations,
    enabled: enabled && !!workspaceId,
    staleTime: 30_000,
    retry,
  });
}

export function useTeamChatMembers(enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: teamChatKeys.members(workspaceId),
    queryFn: listTeamChatMembers,
    enabled: enabled && !!workspaceId,
    staleTime: 60_000,
    retry,
  });
}

/** Páginas das mais recentes para as mais antigas; `fetchNextPage` carrega as anteriores. */
export function useTeamChatMessages(conversationId: string | null, enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  return useInfiniteQuery<TeamChatMessagesPage, Error, MessagesData, unknown[], string | undefined>({
    queryKey: teamChatKeys.messages(conversationId ?? "", workspaceId),
    queryFn: ({ pageParam }) => listTeamChatMessages(conversationId as string, { before: pageParam, limit: TEAM_CHAT_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.messages.length > 0 ? last.messages[last.messages.length - 1].id : undefined,
    enabled: enabled && !!conversationId && !!workspaceId,
    staleTime: 30_000,
    retry,
  });
}

/** Abre (ou recupera) a conversa 1 a 1 e já a coloca na lista em cache. */
export function useOpenDirectConversation() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: (userId: number) => openDirectConversation(userId),
    onSuccess: (conversation) => upsertConversation(queryClient, workspaceId, conversation),
  });
}

// ── Cache ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Mensagens do histórico em ordem de leitura (mais antiga primeiro), sem repetidas. */
export function orderedMessages(data: MessagesData | undefined): TeamChatMessage[] {
  if (!data) return [];
  const seen = new Set<string>();
  const newestFirst: TeamChatMessage[] = [];
  for (const page of data.pages) {
    for (const message of page.messages) {
      // O mesmo envio pode aparecer duas vezes (ack e `new_message`, ou página recarregada): vale o `client_id` também.
      const clientKey = message.client_id ? `${message.sender_id}:${message.client_id}` : null;
      if (seen.has(message.id) || (clientKey !== null && seen.has(clientKey))) continue;
      seen.add(message.id);
      if (clientKey !== null) seen.add(clientKey);
      newestFirst.push(message);
    }
  }
  return newestFirst.reverse();
}

/** Canal fixo no topo; o resto por última mensagem (a ordem de chegada se mantém quando não há horário). */
export function sortConversations(list: TeamChatConversation[]): TeamChatConversation[] {
  const at = (c: TeamChatConversation) => (c.last_message ? Date.parse(c.last_message.created_at) || 0 : 0);
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (a.c.kind !== b.c.kind) return a.c.kind === "channel" ? -1 : 1;
      return at(b.c) - at(a.c) || a.i - b.i;
    })
    .map((x) => x.c);
}

export type UpsertMessageResult = "inserted" | "duplicate" | "uncached";

/** Mesma mensagem? Pelo id do servidor ou, no envio idempotente, pelo `client_id` do mesmo remetente. */
export function isSameMessage(a: TeamChatMessage, b: TeamChatMessage): boolean {
  if (a.id === b.id) return true;
  return a.client_id !== null && a.client_id === b.client_id && a.sender_id === b.sender_id && a.conversation_id === b.conversation_id;
}

/** Coloca a mensagem na primeira página (a mais recente) do histórico em cache, sem duplicar por id nem por `client_id`. */
export function upsertMessage(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  message: TeamChatMessage,
): UpsertMessageResult {
  const key = teamChatKeys.messages(message.conversation_id, workspaceId);
  const data = queryClient.getQueryData<MessagesData>(key);
  // Histórico ainda não carregado: o primeiro fetch já traz a mensagem (inventar uma página aqui apagaria `has_more`).
  if (!data || data.pages.length === 0) return "uncached";
  if (data.pages.some((page) => page.messages.some((m) => isSameMessage(m, message)))) return "duplicate";
  const [first, ...rest] = data.pages;
  queryClient.setQueryData<MessagesData>(key, {
    ...data,
    pages: [{ ...first, messages: [message, ...first.messages] }, ...rest],
  });
  return "inserted";
}

/** Atualiza prévia/horário/contador da conversa. Devolve `false` se ela não está na lista (quem chama recarrega). */
export function applyMessageToConversations(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  message: TeamChatMessage,
  options: { countAsUnread: boolean },
): boolean {
  const key = teamChatKeys.conversations(workspaceId);
  const list = queryClient.getQueryData<TeamChatConversation[]>(key);
  if (!list || !list.some((c) => c.id === message.conversation_id)) return false;
  queryClient.setQueryData<TeamChatConversation[]>(
    key,
    sortConversations(
      list.map((c) =>
        c.id !== message.conversation_id
          ? c
          : {
              ...c,
              last_message: {
                body: message.body,
                sender_id: message.sender_id,
                sender_name: message.sender_name,
                created_at: message.created_at,
                has_attachments: message.attachments.length > 0,
              },
              unread: options.countAsUnread ? c.unread + 1 : c.unread,
            },
      ),
    ),
  );
  return true;
}

/** Mexe no total de não lidas (cache do botão do cabeçalho) sem esperar o servidor. */
export function bumpUnread(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  conversationId: string,
  delta = 1,
): void {
  queryClient.setQueryData<TeamChatUnread>(teamChatKeys.unread(workspaceId), (cur) => {
    if (!cur) return cur;
    const by = { ...cur.by_conversation, [conversationId]: (cur.by_conversation[conversationId] ?? 0) + delta };
    return { total: Object.values(by).reduce((a, n) => a + n, 0), by_conversation: by };
  });
}

/** Conversa lida: zera (ou fixa) o contador nas duas listas. */
export function setConversationUnread(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  conversationId: string,
  unread: number,
): void {
  queryClient.setQueryData<TeamChatConversation[]>(teamChatKeys.conversations(workspaceId), (list) =>
    list?.map((c) => (c.id === conversationId && c.unread !== unread ? { ...c, unread } : c)),
  );
  queryClient.setQueryData<TeamChatUnread>(teamChatKeys.unread(workspaceId), (cur) => {
    if (!cur) return cur;
    const by = { ...cur.by_conversation, [conversationId]: unread };
    return { total: Object.values(by).reduce((a, n) => a + n, 0), by_conversation: by };
  });
}

/**
 * A outra pessoa leu até `lastMessageId` ("Visto"). O servidor só emite quando o ponto de leitura avança; como os ids
 * são UUID (sem ordem), só se ignora o evento quando as duas mensagens estão no histórico em cache e ele recuaria.
 */
export function setPeerLastRead(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  conversationId: string,
  lastMessageId: string,
): void {
  const history = orderedMessages(queryClient.getQueryData<MessagesData>(teamChatKeys.messages(conversationId, workspaceId)));
  const advances = (current: string | null): boolean => {
    if (current === null) return true;
    if (current === lastMessageId) return false;
    const next = messageIndex(history, lastMessageId);
    const prev = messageIndex(history, current);
    return !(next >= 0 && prev >= 0 && next < prev);
  };
  queryClient.setQueryData<TeamChatConversation[]>(teamChatKeys.conversations(workspaceId), (list) =>
    list?.map((c) =>
      c.id === conversationId && c.kind === "direct" && advances(c.peer_last_read_message_id)
        ? { ...c, peer_last_read_message_id: lastMessageId }
        : c,
    ),
  );
}

/** Conversa nova (a minha ao abrir, ou a que outra pessoa criou comigo): entra na lista, no lugar certo. */
export function upsertConversation(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  conversation: TeamChatConversation,
): void {
  const key = teamChatKeys.conversations(workspaceId);
  const list = queryClient.getQueryData<TeamChatConversation[]>(key);
  // Lista ainda não carregada: o fetch dela já inclui a conversa.
  if (!list) return;
  const exists = list.some((c) => c.id === conversation.id);
  queryClient.setQueryData<TeamChatConversation[]>(
    key,
    sortConversations(exists ? list.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)) : [...list, conversation]),
  );
}
