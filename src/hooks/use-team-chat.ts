/**
 * Socket do chat da equipe (namespace `/team-chat`, mesmo handshake do `/chat`: `auth: { token, workspaceId }`).
 *
 * Fica montado no botão do cabeçalho (contador e aviso em tempo real, com a gaveta fechada) e entrega à gaveta o
 * que ela precisa: enviar, marcar como lida e dizer qual conversa está aberta (`focus_conversation` /
 * `blur_conversation`, que é como o servidor sabe que não precisa avisar no sino). Tudo que chega entra direto no
 * cache do TanStack Query, sem repetir id (a mesma mensagem chega pelo ack do envio e pelo `new_message`).
 * Estado do workspace: arquivado = só leitura; suspenso/excluído = bloqueado e sem reconexão. Handshake recusado
 * (`TEAM_CHAT_FORBIDDEN` / `TEAM_CHAT_UNAUTHENTICATED`): também bloqueia e não reconecta, com a frase da recusa.
 * Cada envio leva um `client_id` (UUID) que o servidor usa para gravar UMA mensagem por envio, mesmo com reenvio.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  applyMessageToConversations,
  bumpUnread,
  setConversationUnread,
  setPeerLastRead,
  teamChatKeys,
  TEAM_CHAT_ROOT,
  upsertConversation,
  upsertMessage,
} from "@/hooks/use-team-chat-queries";
import { useWorkspaceQueryKey } from "@/hooks/use-workspace-query-key";
import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import {
  WORKSPACE_STATE_DEFAULT_MESSAGE,
  isWorkspaceReactionCode,
  readWorkspaceStateError,
  type WorkspaceReactionCode,
} from "@/lib/workspace-state/lifecycle-errors";
import {
  TEAM_CHAT_REFUSAL_MESSAGE,
  isTeamChatRefusalCode,
  mapConversation,
  mapMessage,
  markTeamChatRead,
  sendTeamChatMessage,
  socketErrorText,
  type TeamChatAttachment,
  type TeamChatMessage,
  type TeamChatMessagesPage,
  type TeamChatRefusalCode,
} from "@/shared/services/team-chat";
import { generateIdempotencyKey } from "@/shared/utils/idempotency-key";

/**
 * Por que a escrita está barrada: estado do workspace (a mensagem é a do estado) ou handshake recusado
 * (`TEAM_CHAT_FORBIDDEN` / `TEAM_CHAT_UNAUTHENTICATED`, sem reconexão).
 */
export type TeamChatBlock = { code: WorkspaceReactionCode | TeamChatRefusalCode; message: string };

export interface TeamChatSendInput {
  body: string;
  attachments: TeamChatAttachment[];
  /** UUID v4 do envio: o mesmo em cada tentativa (socket e REST). Sem ele, o hook gera um para esta chamada. */
  clientId?: string;
}

export interface TeamChatController {
  isConnected: boolean;
  /** Escrita barrada pelo estado do workspace (arquivado, suspenso ou excluído); `null` quando livre. */
  blocked: TeamChatBlock | null;
  /** Devolve a mensagem gravada, ou `null` se o servidor confirmou sem devolvê-la (o histórico é recarregado). */
  sendMessage: (conversationId: string, input: TeamChatSendInput) => Promise<TeamChatMessage | null>;
  markRead: (conversationId: string, lastMessageId: string) => void;
  focusConversation: (conversationId: string) => void;
  blurConversation: (conversationId: string) => void;
}

const ACK_TIMEOUT_MS = 15_000;
const SEEN_LIMIT = 300;

type SendAck = { ok?: boolean; message?: unknown; error?: string };

/** Chaves para não tratar duas vezes a mesma mensagem: o id do servidor e, quando há, o `client_id` do remetente. */
function dedupeKeys(message: TeamChatMessage): string[] {
  const keys = [message.id];
  if (message.client_id) keys.push(`cid:${message.conversation_id}:${message.sender_id}:${message.client_id}`);
  return keys;
}

/** `/api/backoffice` sai da URL: o namespace do socket mora na raiz do servidor (igual ao `use-chat`). */
function teamChatSocketUrl(): string {
  let baseUrl = getApiUrl("");
  if (baseUrl.endsWith("/api/backoffice") || baseUrl.endsWith("/api/backoffice/")) {
    baseUrl = baseUrl.replace(/\/api\/backoffice\/?$/, "");
  }
  const protocol = baseUrl.startsWith("https") ? "wss" : "ws";
  return `${protocol}://${baseUrl.replace(/^https?:\/\//, "")}/team-chat`;
}

function blockOf(code: WorkspaceReactionCode, message?: string): TeamChatBlock {
  return { code, message: message || WORKSPACE_STATE_DEFAULT_MESSAGE[code] };
}

/** Bloqueio do workspace arquivado (vem do estado do workspace, não do socket); um objeto só, para não mudar a cada render. */
const ARCHIVED_BLOCK = blockOf("WORKSPACE_ARCHIVED");

function refusalBlock(code: TeamChatRefusalCode): TeamChatBlock {
  return { code, message: TEAM_CHAT_REFUSAL_MESSAGE[code] };
}

export function useTeamChat({ enabled = true }: { enabled?: boolean } = {}): TeamChatController {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  const { selectedWorkspace } = useWorkspaceContext();
  const { user } = useCurrentUser();

  const [isConnected, setIsConnected] = useState(false);
  const [socketBlock, setSocketBlock] = useState<TeamChatBlock | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const focusedRef = useRef<string | null>(null);
  const seenRef = useRef<string[]>([]);
  const meRef = useRef<number | null>(null);
  meRef.current = user?.id != null ? Number(user.id) : null;

  const workspaceStatus = selectedWorkspace?.status;
  const block: TeamChatBlock | null = socketBlock ?? (workspaceStatus === "archived" ? ARCHIVED_BLOCK : null);
  const blockRef = useRef(block);
  blockRef.current = block;
  const workspaceRef = useRef(workspaceId);
  workspaceRef.current = workspaceId;
  // Recusa que não adianta repetir (handshake recusado, workspace suspenso/excluído), venha do socket, do ack do envio
  // ou do REST: o socket é derrubado e nenhum `io server disconnect` o religa.
  const terminalRef = useRef(false);

  // Trocar de workspace ou o estado dele mudar (ex.: suporte reativou) limpa o bloqueio que o socket gravou.
  useEffect(() => {
    terminalRef.current = false;
    setSocketBlock(null);
  }, [workspaceId, workspaceStatus]);

  /** `false` se a mensagem (por id ou por `client_id`) já foi tratada; senão a registra e devolve `true`. */
  const remember = useCallback((message: TeamChatMessage): boolean => {
    const keys = dedupeKeys(message);
    if (keys.some((key) => seenRef.current.includes(key))) return false;
    seenRef.current.push(...keys);
    while (seenRef.current.length > SEEN_LIMIT) seenRef.current.shift();
    return true;
  }, []);

  const noteBlock = useCallback((code: string | undefined, message?: string) => {
    if (isTeamChatRefusalCode(code)) setSocketBlock(refusalBlock(code));
    else if (code && isWorkspaceReactionCode(code)) setSocketBlock(blockOf(code, message));
    else return;
    // Arquivado é só leitura (o socket segue); o resto é terminal: derruba o socket e não reconecta.
    if (code !== "WORKSPACE_ARCHIVED") {
      terminalRef.current = true;
      socketRef.current?.disconnect();
    }
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId || workspaceStatus === "suspended") return;
    const token = getAuthToken();
    if (!token) return;
    const ws = workspaceId;

    const socket = io(teamChatSocketUrl(), {
      auth: { token, workspaceId: ws },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Sem limite: com uma conversa aberta, desistir depois de uma queda longa deixaria a tela sem tempo real até recarregar.
      reconnectionAttempts: Infinity,
      timeout: 20000,
      extraHeaders: { "Workspace-Id": ws },
    });
    socketRef.current = socket;
    let connectedBefore = false;
    let evicted = false;

    socket.on("connect", () => {
      setIsConnected(true);
      if (focusedRef.current) socket.emit("focus_conversation", { conversationId: focusedRef.current });
      // Voltou depois de uma queda: o que chegou nesse meio-tempo vem do histórico, não do socket.
      if (connectedBefore) void queryClient.invalidateQueries({ queryKey: [TEAM_CHAT_ROOT] });
      connectedBefore = true;
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      if (reason === "io server disconnect" && !evicted && !terminalRef.current) socket.connect();
    });

    // Recusa do handshake: o servidor avisa e desconecta; reconectar só repetiria a recusa.
    const refuse = (code: TeamChatRefusalCode) => {
      evicted = true;
      setSocketBlock(refusalBlock(code));
      socket.disconnect();
    };

    socket.on("connect_error", (err?: { message?: string; data?: { error?: string } }) => {
      setIsConnected(false);
      const code = err?.data?.error ?? err?.message;
      if (isTeamChatRefusalCode(code)) refuse(code);
      else if (code && isWorkspaceReactionCode(code) && code !== "WORKSPACE_ARCHIVED") {
        evicted = true;
        noteBlock(code);
      }
    });

    socket.on("new_message", (raw: unknown) => {
      const message = mapMessage(raw);
      if (!message.id || !message.conversation_id || !remember(message)) return;
      const mine = message.sender_id === meRef.current;
      // Conversa aberta e visível: chegou lida, não conta como não lida (o `mark_read` sai pela gaveta).
      const countAsUnread = !mine && focusedRef.current !== message.conversation_id;
      upsertMessage(queryClient, ws, message);
      // Histórico ainda a caminho: a resposta pode ter sido montada antes desta mensagem; busca de novo ao terminar.
      if (queryClient.isFetching({ queryKey: teamChatKeys.messages(message.conversation_id, ws) }) > 0) {
        void queryClient.invalidateQueries({ queryKey: teamChatKeys.messages(message.conversation_id, ws) });
      }
      const known = applyMessageToConversations(queryClient, ws, message, { countAsUnread });
      if (countAsUnread) bumpUnread(queryClient, ws, message.conversation_id, 1);
      if (!known) void queryClient.invalidateQueries({ queryKey: teamChatKeys.conversations(ws) });
    });

    socket.on("read", (event: { conversationId?: unknown; userId?: unknown; lastMessageId?: unknown }) => {
      const conversationId = event?.conversationId != null ? String(event.conversationId) : "";
      if (!conversationId) return;
      if (Number(event.userId) === meRef.current) {
        // Eu li (em outra aba ou nesta): zera o contador, a menos que haja mensagem mais nova que a lida.
        // Os ids são UUID (sem ordem): a mais recente do histórico em cache é a referência.
        const lastRead = event.lastMessageId != null ? String(event.lastMessageId) : null;
        const cached = queryClient.getQueryData<InfiniteData<TeamChatMessagesPage, string | undefined>>(
          teamChatKeys.messages(conversationId, ws),
        );
        const newest = cached?.pages[0]?.messages[0];
        if (lastRead && newest && lastRead !== newest.id) {
          void queryClient.invalidateQueries({ queryKey: teamChatKeys.conversations(ws) });
          void queryClient.invalidateQueries({ queryKey: teamChatKeys.unread(ws) });
        } else {
          setConversationUnread(queryClient, ws, conversationId, 0);
        }
      } else if (event.lastMessageId != null) {
        setPeerLastRead(queryClient, ws, conversationId, String(event.lastMessageId));
      }
    });

    socket.on("conversation_created", (raw: unknown) => {
      const conversation = mapConversation(raw);
      if (!conversation.id) return;
      upsertConversation(queryClient, ws, conversation);
      void queryClient.invalidateQueries({ queryKey: teamChatKeys.conversations(ws), refetchType: "none" });
    });

    socket.on("error", (err: { message?: string; error?: string }) => {
      const code = err?.error;
      if (isTeamChatRefusalCode(code)) {
        refuse(code);
        return;
      }
      if (code && isWorkspaceReactionCode(code)) {
        noteBlock(code, err.message);
        // Suspenso/excluído: o servidor expulsa o socket e não adianta voltar.
        if (code !== "WORKSPACE_ARCHIVED") {
          evicted = true;
          socket.disconnect();
        }
      }
    });

    return () => {
      evicted = true;
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, workspaceId, workspaceStatus, queryClient, remember, noteBlock]);

  const sendMessage = useCallback<TeamChatController["sendMessage"]>(
    async (conversationId, input) => {
      const ws = workspaceRef.current;
      if (blockRef.current) throw new Error(blockRef.current.message);
      // Uma chave por envio, reaproveitada em cada tentativa: o servidor grava UMA mensagem por `client_id`.
      const clientId = input.clientId ?? generateIdempotencyKey();
      const payload = { body: input.body, attachments: input.attachments, client_id: clientId };
      const socket = socketRef.current;
      let message: TeamChatMessage | null;
      try {
        if (socket && socket.connected) {
          message = await new Promise<TeamChatMessage | null>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (settled) return;
              settled = true;
              reject(new Error("O envio demorou demais. Confira a conexão e tente de novo."));
            }, ACK_TIMEOUT_MS);
            socket.emit("send_message", { conversationId, ...payload }, (ack: SendAck) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (ack?.ok) {
                resolve(ack.message ? mapMessage(ack.message) : null);
                return;
              }
              const state = ack?.error && isWorkspaceReactionCode(ack.error) ? ack.error : undefined;
              if (state) noteBlock(state);
              else if (isTeamChatRefusalCode(ack?.error)) noteBlock(ack.error);
              reject(new Error(state ? WORKSPACE_STATE_DEFAULT_MESSAGE[state] : socketErrorText(ack?.error)));
            });
          });
        } else {
          message = await sendTeamChatMessage(conversationId, payload);
        }
      } catch (error) {
        const state = readWorkspaceStateError(error);
        if (state) noteBlock(state.code, state.message);
        throw error;
      }
      if (!message) {
        void queryClient.invalidateQueries({ queryKey: teamChatKeys.messages(conversationId, ws) });
        return null;
      }
      remember(message);
      upsertMessage(queryClient, ws, message);
      if (!applyMessageToConversations(queryClient, ws, message, { countAsUnread: false })) {
        void queryClient.invalidateQueries({ queryKey: teamChatKeys.conversations(ws) });
      }
      return message;
    },
    [queryClient, remember, noteBlock],
  );

  const markRead = useCallback<TeamChatController["markRead"]>(
    (conversationId, lastMessageId) => {
      const ws = workspaceRef.current;
      // Arquivado/suspenso: o servidor recusa `mark_read` (é escrita), então nem tenta.
      if (blockRef.current) return;
      setConversationUnread(queryClient, ws, conversationId, 0);
      const refreshBell = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("mark_read", { conversationId, lastMessageId });
        refreshBell();
        return;
      }
      markTeamChatRead(conversationId, lastMessageId)
        .then(({ unread }) => {
          setConversationUnread(queryClient, ws, conversationId, unread);
          refreshBell();
        })
        .catch((error) => {
          const state = readWorkspaceStateError(error);
          if (state) noteBlock(state.code, state.message);
        });
    },
    [queryClient, noteBlock],
  );

  const focusConversation = useCallback((conversationId: string) => {
    focusedRef.current = conversationId;
    const socket = socketRef.current;
    if (socket && socket.connected) socket.emit("focus_conversation", { conversationId });
  }, []);

  const blurConversation = useCallback((conversationId: string) => {
    if (focusedRef.current === conversationId) focusedRef.current = null;
    const socket = socketRef.current;
    if (socket && socket.connected) socket.emit("blur_conversation", { conversationId });
  }, []);

  return useMemo(
    () => ({ isConnected, blocked: block, sendMessage, markRead, focusConversation, blurConversation }),
    [isConnected, block, sendMessage, markRead, focusConversation, blurConversation],
  );
}
