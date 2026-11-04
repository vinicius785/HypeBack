/**
 * Chat da equipe: pessoas do mesmo workspace trocam mensagens (canal geral + conversa 1 a 1).
 * Contrato: `docs/team-chat-spec.md` (rotas `/team-chat/*` do backoffice, header `Workspace-Id`).
 * O chat das campanhas (cliente ↔ criador) fica em `chat.ts` e não passa por aqui.
 */
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { buildApiError } from "@/lib/workspace-state/api-error";
import { readWorkspaceStateError } from "@/lib/workspace-state/lifecycle-errors";

export type TeamChatAttachment = { url: string; name: string; mime_type: string; size: number };
export type TeamChatMember = { user_id: number; name: string; avatar: string | null; role: string };
export type TeamChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  body: string;
  attachments: TeamChatAttachment[];
  created_at: string; // ISO
  /** UUID gerado pelo front no envio (o servidor devolve o mesmo); `null` em mensagem antiga ou de quem não manda. */
  client_id: string | null;
};
/** `Conversation` do contrato (o nome curto já é usado pela aba Criadores). */
export type TeamChatConversation = {
  id: string;
  kind: "channel" | "direct";
  title: string; // "Equipe" no canal; nome do outro no 1 a 1
  peer: { user_id: number; name: string; avatar: string | null } | null; // só em direct
  last_message: {
    body: string;
    sender_id: number;
    sender_name: string;
    created_at: string;
    has_attachments: boolean;
  } | null;
  unread: number;
  peer_last_read_message_id: string | null; // direct: até onde a outra pessoa leu ("Visto")
};
export type TeamChatUnread = { total: number; by_conversation: Record<string, number> };
export type TeamChatMessagesPage = { messages: TeamChatMessage[]; hasMore: boolean };

/** Limites do contrato (mensagem) e do upload de anexos do chat das campanhas (arquivo). */
export const TEAM_CHAT_MAX_BODY = 4000;
export const TEAM_CHAT_MAX_ATTACHMENTS = 5;
export const TEAM_CHAT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const TEAM_CHAT_PAGE_SIZE = 30;

/** A API ainda não tem as rotas do chat da equipe (versão antiga): a aba mostra "Disponível em breve". */
export class TeamChatUnavailableError extends Error {
  status = 404;
  constructor() {
    super("Chat da equipe indisponível nesta versão da API");
    this.name = "TeamChatUnavailableError";
  }
}

export function isTeamChatUnavailable(error: unknown): error is TeamChatUnavailableError {
  return error instanceof TeamChatUnavailableError;
}

/**
 * Os ids públicos das mensagens são UUID (a API não expõe o id numérico): não têm ordem própria. A ordem é a da lista
 * carregada (mais antiga primeiro). Devolve a posição do id, ou -1 quando a mensagem não está na lista.
 */
export function messageIndex(messages: readonly { id: string }[], id: string | null | undefined): number {
  if (!id) return -1;
  return messages.findIndex((m) => m.id === id);
}

/** `readId` (até onde alguém leu) alcança `targetId`? Só vale com as duas na lista; fora dela, não se sabe. */
export function hasReadThrough(messages: readonly { id: string }[], readId: string | null | undefined, targetId: string): boolean {
  const read = messageIndex(messages, readId);
  const target = messageIndex(messages, targetId);
  return read >= 0 && target >= 0 && read >= target;
}

/**
 * Códigos de recusa do handshake (`error { error }` no socket): quem não é membro ativo do workspace, ou sem sessão
 * válida. Não adianta reconectar — o servidor desconecta e a resposta seria a mesma.
 */
export const TEAM_CHAT_REFUSAL_CODES = ["TEAM_CHAT_FORBIDDEN", "TEAM_CHAT_UNAUTHENTICATED"] as const;
export type TeamChatRefusalCode = (typeof TEAM_CHAT_REFUSAL_CODES)[number];

export const TEAM_CHAT_REFUSAL_MESSAGE: Record<TeamChatRefusalCode, string> = {
  TEAM_CHAT_FORBIDDEN: "Você não faz parte deste workspace, então não pode usar o chat da equipe dele.",
  TEAM_CHAT_UNAUTHENTICATED: "Sua sessão expirou. Entre de novo para usar o chat da equipe.",
};

export function isTeamChatRefusalCode(code: unknown): code is TeamChatRefusalCode {
  return typeof code === "string" && (TEAM_CHAT_REFUSAL_CODES as readonly string[]).includes(code);
}

/** Mensagens que o servidor devolve no `error` do ack do socket como CÓDIGO (não como frase): texto para a pessoa. */
const SOCKET_ERROR_TEXT: Record<string, string> = {
  ...TEAM_CHAT_REFUSAL_MESSAGE,
  RATE_LIMITED: "Você está enviando muito rápido. Aguarde um instante.",
  TEAM_CHAT_PEER_UNAVAILABLE: "Esta pessoa não faz mais parte deste workspace.",
};

/** O `error` do ack do socket é o código quando existe (ex.: `RATE_LIMITED`) ou a própria mensagem do servidor. */
export function socketErrorText(error: string | undefined, fallback = "Não foi possível enviar a mensagem."): string {
  if (!error) return fallback;
  return SOCKET_ERROR_TEXT[error] ?? (/^[A-Z][A-Z0-9_]+$/.test(error) ? fallback : error);
}

/** Toda rota do chat precisa de sessão e de um workspace selecionado. */
function requireSession(): { token: string; workspaceId: string } {
  const token = getAuthToken();
  const workspaceId = getWorkspaceId();
  if (!token) throw new Error("Token de autenticação não encontrado");
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");
  return { token, workspaceId };
}

function headers(json = false): Record<string, string> {
  const { token, workspaceId } = requireSession();
  return {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${token}`,
    "Workspace-Id": workspaceId,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** 404 do Nest para rota inexistente (`Cannot GET ...`) ou sem corpo JSON (proxy): a API não conhece o chat. */
function isMissingRoute(body: unknown): boolean {
  if (body === null || typeof body !== "object") return true;
  const message = (body as { message?: unknown }).message;
  return typeof message === "string" && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message);
}

/**
 * Lê a resposta. 404 vira `TeamChatUnavailableError` quando a rota não existe — nas listagens (`anyNotFound`)
 * qualquer 404 que não seja "workspace excluído" conta; nas rotas de um recurso (conversa, membro) um 404
 * com corpo do serviço é "não encontrado" de verdade e segue como erro normal.
 */
async function parse<T>(response: Response, fallback: string, anyNotFound = false): Promise<T> {
  const body = await readBody(response);
  if (response.ok) return (body as { data: T }).data;
  if (response.status === 404 && readWorkspaceStateError(body) === null && (anyNotFound || isMissingRoute(body))) {
    throw new TeamChatUnavailableError();
  }
  throw buildApiError(response.status, body, fallback);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function mapAttachment(raw: unknown): TeamChatAttachment {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { url: str(o.url), name: str(o.name), mime_type: str(o.mime_type), size: num(o.size) };
}

export function mapMessage(raw: unknown): TeamChatMessage {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id),
    conversation_id: str(o.conversation_id),
    sender_id: num(o.sender_id),
    sender_name: str(o.sender_name),
    sender_avatar: strOrNull(o.sender_avatar),
    body: str(o.body),
    attachments: Array.isArray(o.attachments) ? o.attachments.map(mapAttachment) : [],
    created_at: str(o.created_at),
    client_id: strOrNull(o.client_id),
  };
}

export function mapMember(raw: unknown): TeamChatMember {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { user_id: num(o.user_id), name: str(o.name), avatar: strOrNull(o.avatar), role: str(o.role) };
}

export function mapConversation(raw: unknown): TeamChatConversation {
  const o = (raw ?? {}) as Record<string, unknown>;
  const peer = o.peer as Record<string, unknown> | null | undefined;
  const last = o.last_message as Record<string, unknown> | null | undefined;
  const kind = o.kind === "direct" ? "direct" : "channel";
  return {
    id: str(o.id),
    kind,
    title: str(o.title) || (kind === "channel" ? "Equipe" : peer ? str(peer.name) : ""),
    peer:
      kind === "direct" && peer
        ? { user_id: num(peer.user_id), name: str(peer.name), avatar: strOrNull(peer.avatar) }
        : null,
    last_message: last
      ? {
          body: str(last.body),
          sender_id: num(last.sender_id),
          sender_name: str(last.sender_name),
          created_at: str(last.created_at),
          has_attachments: last.has_attachments === true,
        }
      : null,
    unread: Math.max(0, num(o.unread)),
    peer_last_read_message_id: o.peer_last_read_message_id == null ? null : str(o.peer_last_read_message_id),
  };
}

/** Canal primeiro, depois as conversas por `last_message_at desc` (a API já ordena; reforça o canal no topo). */
export async function listTeamConversations(): Promise<TeamChatConversation[]> {
  const response = await fetch(getApiUrl("/team-chat/conversations"), { headers: headers() });
  const data = await parse<unknown[]>(response, "Não foi possível carregar as conversas", true);
  const list = (Array.isArray(data) ? data : []).map(mapConversation);
  return [...list.filter((c) => c.kind === "channel"), ...list.filter((c) => c.kind !== "channel")];
}

export async function listTeamChatMembers(): Promise<TeamChatMember[]> {
  const response = await fetch(getApiUrl("/team-chat/members"), { headers: headers() });
  const data = await parse<unknown[]>(response, "Não foi possível carregar os membros", true);
  return (Array.isArray(data) ? data : []).map(mapMember);
}

/** Abre (ou devolve) a conversa 1 a 1 com um membro — idempotente no servidor. */
export async function openDirectConversation(userId: number): Promise<TeamChatConversation> {
  const response = await fetch(getApiUrl("/team-chat/conversations/direct"), {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ user_id: userId }),
  });
  return mapConversation(await parse<unknown>(response, "Não foi possível abrir a conversa"));
}

/** Mensagens mais recentes primeiro; `before` (id) pagina para trás. */
export async function listTeamChatMessages(
  conversationId: string,
  options: { before?: string; limit?: number } = {},
): Promise<TeamChatMessagesPage> {
  const search = new URLSearchParams({ limit: String(Math.min(options.limit ?? TEAM_CHAT_PAGE_SIZE, 50)) });
  if (options.before) search.set("before", options.before);
  const response = await fetch(
    getApiUrl(`/team-chat/conversations/${encodeURIComponent(conversationId)}/messages?${search.toString()}`),
    { headers: headers() },
  );
  const body = await readBody(response);
  if (!response.ok) {
    if (response.status === 404 && readWorkspaceStateError(body) === null && isMissingRoute(body)) {
      throw new TeamChatUnavailableError();
    }
    throw buildApiError(response.status, body, "Não foi possível carregar as mensagens");
  }
  const record = (body ?? {}) as { data?: unknown; meta?: { has_more?: unknown } };
  return {
    messages: (Array.isArray(record.data) ? record.data : []).map(mapMessage),
    hasMore: record.meta?.has_more === true,
  };
}

export interface SendTeamChatMessageInput {
  body?: string;
  attachments?: TeamChatAttachment[];
  /** UUID v4 da mensagem: o servidor grava UMA por `(conversa, remetente, client_id)`; o "Tentar de novo" reusa o mesmo. */
  client_id?: string;
}

/** Envio por REST (fallback do socket). O mesmo `client_id` num reenvio devolve a mensagem já gravada, sem duplicar. */
export async function sendTeamChatMessage(
  conversationId: string,
  input: SendTeamChatMessageInput,
): Promise<TeamChatMessage> {
  const response = await fetch(getApiUrl(`/team-chat/conversations/${encodeURIComponent(conversationId)}/messages`), {
    method: "POST",
    // Sem `Idempotency-Key`: o `client_id` do corpo já torna o envio idempotente no serviço (reenvio = 200 com a mensagem
    // gravada). Com o cabeçalho, o interceptor genérico da API repetiria a resposta em cache com 201, fora do contrato.
    headers: headers(true),
    body: JSON.stringify({
      body: input.body ?? "",
      attachments: input.attachments ?? [],
      ...(input.client_id ? { client_id: input.client_id } : {}),
    }),
  });
  return mapMessage(await parse<unknown>(response, "Não foi possível enviar a mensagem"));
}

export async function uploadTeamChatAttachment(conversationId: string, file: File): Promise<TeamChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    getApiUrl(`/team-chat/conversations/${encodeURIComponent(conversationId)}/attachments`),
    { method: "POST", headers: headers(), body: form },
  );
  return mapAttachment(await parse<unknown>(response, "Não foi possível enviar o anexo"));
}

/** Marca a conversa como lida até `lastMessageId` (só avança). Devolve quantas ainda restam. */
export async function markTeamChatRead(conversationId: string, lastMessageId: string): Promise<{ unread: number }> {
  const response = await fetch(getApiUrl(`/team-chat/conversations/${encodeURIComponent(conversationId)}/read`), {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ last_message_id: lastMessageId }),
  });
  const data = await parse<{ unread?: unknown }>(response, "Não foi possível marcar como lida");
  return { unread: Math.max(0, num(data?.unread)) };
}

export async function getTeamChatUnread(): Promise<TeamChatUnread> {
  const response = await fetch(getApiUrl("/team-chat/unread"), { headers: headers() });
  const data = await parse<{ total?: unknown; by_conversation?: unknown }>(
    response,
    "Não foi possível carregar as não lidas",
    true,
  );
  const by: Record<string, number> = {};
  if (data?.by_conversation && typeof data.by_conversation === "object") {
    for (const [id, n] of Object.entries(data.by_conversation as Record<string, unknown>)) by[id] = Math.max(0, num(n));
  }
  return { total: Math.max(0, num(data?.total)), by_conversation: by };
}
