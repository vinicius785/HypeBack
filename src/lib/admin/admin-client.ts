/**
 * Cliente HTTP do Admin da plataforma — `/api/backoffice/admin/*`.
 *
 * Contrato: `src/shared/admin-platform.types.ts` (cópia do contrato do backend).
 *
 * Regras que este módulo garante para todas as telas do Admin:
 * - **sem** header `Workspace-Id` (escopo de plataforma, `PlatformAdminGuard`);
 * - listas devolvem `{ data, meta }` (nada de descartar a paginação) e feeds, o cursor;
 * - erro tipado (`AdminApiError`): `status`, `code`, `message`, `details`. O `message` do backend pode
 *   vir como `string[]` (validação) e vira texto único, com a lista em `messages`;
 * - 401 (sessão vencida ou conta suspensa no meio da sessão) chama o handler registrado por
 *   `useAdminSessionGuard` — este módulo não navega nem mexe em estado global;
 * - 404 de rota que ainda não existe no servidor vira `ENDPOINT_UNAVAILABLE`; 404 de registro que não
 *   existe vira `NOT_FOUND` (as telas dizem coisas diferentes para cada um);
 * - toda escrita exige `Idempotency-Key` (UUID v4, uma por intenção da pessoa — ver `useIdempotencyKey`).
 */
import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import { generateIdempotencyKey } from "@/shared/utils/idempotency-key";
import {
  ADMIN_ERROR_CODES,
  type AdminCursorMeta,
  type AdminErrorCode,
  type AdminPageMeta,
} from "@/shared/admin-platform.types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AdminQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string | number>;

export type AdminQuery = Record<string, AdminQueryValue>;

/** Códigos que o próprio cliente cria (não vêm do backend). */
export const ADMIN_CLIENT_ERROR_CODES = [
  "UNAUTHENTICATED", // 401: sem token ou token recusado
  "FORBIDDEN", // 403 sem código de domínio
  "NOT_FOUND", // 404 de um registro que não existe (ou está oculto)
  "ENDPOINT_UNAVAILABLE", // 404 de uma rota que o servidor ainda não tem
  "BAD_REQUEST", // 400 (validação)
  "CONFLICT", // 409 sem código de domínio
  "UNPROCESSABLE", // 422 sem código de domínio
  "RATE_LIMITED", // 429
  "SERVER_ERROR", // 5xx
  "NETWORK_ERROR", // fetch falhou: sem rede, CORS, servidor fora do ar
  "INVALID_RESPONSE", // 2xx fora do formato do contrato
  "UNKNOWN",
] as const;
export type AdminClientErrorCode = (typeof ADMIN_CLIENT_ERROR_CODES)[number];

/** `string & {}` mantém o autocomplete dos códigos conhecidos sem proibir um código novo do backend. */
export type AdminApiErrorCode = AdminErrorCode | AdminClientErrorCode | (string & {});

export interface AdminApiErrorInit {
  status: number;
  code: AdminApiErrorCode;
  message: string;
  messages?: string[];
  details?: unknown;
}

export class AdminApiError extends Error {
  /** Status HTTP; 0 quando a requisição nem chegou ao servidor. */
  readonly status: number;
  readonly code: AdminApiErrorCode;
  /** `details` do backend (ex.: `{ blockers }` em WORKSPACE_DELETE_BLOCKED). */
  readonly details: unknown;
  /** Todas as mensagens quando o backend mandou uma lista (validação); sempre ao menos `[message]`. */
  readonly messages: string[];

  constructor(init: AdminApiErrorInit) {
    super(init.message);
    this.name = "AdminApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.messages = init.messages && init.messages.length > 0 ? init.messages : [init.message];
  }
}

export function isAdminApiError(error: unknown, code?: AdminApiErrorCode): error is AdminApiError {
  return error instanceof AdminApiError && (code === undefined || error.code === code);
}

/** Erros de 400 a 499: repetir a mesma chamada não muda o resultado (usado pela política de retry). */
export function isClientError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status >= 400 && error.status < 500;
}

export interface AdminRequestOptions {
  signal?: AbortSignal;
}

export interface AdminWriteOptions extends AdminRequestOptions {
  /** UUID v4, uma por intenção da pessoa. Gere com `newIdempotencyKey()` / `useIdempotencyKey()`. */
  idempotencyKey: string;
}

export interface AdminListResult<T> {
  data: T[];
  meta: AdminPageMeta;
}

export interface AdminFeedResult<T> {
  data: T[];
  meta: AdminCursorMeta;
}

export interface AdminEnvelope<T, M = unknown> {
  data: T;
  meta: M | undefined;
}

// ---------------------------------------------------------------------------
// Sessão vencida
// ---------------------------------------------------------------------------

export type AdminUnauthorizedHandler = (error: AdminApiError) => void;

let unauthorizedHandler: AdminUnauthorizedHandler | null = null;

/**
 * Registra quem cuida da sessão vencida (o layout do Admin, via `useAdminSessionGuard`). Devolve a
 * função que desfaz o registro. Sem handler, o erro só é lançado.
 */
export function setAdminUnauthorizedHandler(handler: AdminUnauthorizedHandler | null): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function notifyUnauthorized(error: AdminApiError): void {
  try {
    unauthorizedHandler?.(error);
  } catch {
    // o handler não pode transformar a falha da requisição em outra falha
  }
}

// ---------------------------------------------------------------------------
// Idempotência e caminhos
// ---------------------------------------------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID v4 novo. Uma chave por *intenção*; para reaproveitar entre tentativas use `useIdempotencyKey`. */
export function newIdempotencyKey(): string {
  return generateIdempotencyKey();
}

/**
 * Monta um caminho escapando cada valor interpolado, para um id vindo de URL/dados nunca virar outro
 * caminho (`../`, `?x=`, `#`): ``adminPath`/admin/workspaces/${id}/members` ``.
 */
export function adminPath(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  return strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? encodeURIComponent(String(values[i])) : ""),
    "",
  );
}

/** Query string a partir de um objeto: ignora vazios, junta arrays em CSV (formato dos filtros do contrato). */
export function buildAdminQueryString(query?: AdminQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw) ? raw.join(",") : String(raw);
    if (value === "") continue;
    params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

const KNOWN_ADMIN_CODES: readonly string[] = ADMIN_ERROR_CODES;

/** O Nest responde assim a uma rota que não existe: "Cannot GET /api/backoffice/admin/...". */
const ROUTE_MISS_MESSAGE = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//i;

const SERVER_TEXT_STATUSES = new Set([400, 404, 409, 422]);

const DEFAULT_MESSAGE: Record<string, string> = {
  // Códigos de domínio do contrato: só aparecem quando o backend não mandou texto.
  ACCOUNT_SUSPENDED: "Esta conta está suspensa.",
  WORKSPACE_SUSPENDED: "Este workspace está suspenso.",
  WORKSPACE_ARCHIVED: "Este workspace está arquivado e aceita apenas leitura.",
  WORKSPACE_DELETED: "Este workspace foi excluído.",
  INVALID_STATE_TRANSITION: "Esta ação não é permitida no estado atual.",
  WORKSPACE_DELETE_BLOCKED: "A exclusão está bloqueada: resolva os impedimentos listados.",
  IMPACT_TOKEN_MISMATCH: "O impacto mudou desde que o resumo foi mostrado. Revise o resumo e confirme de novo.",
  CONFIRMATION_MISMATCH: "O nome digitado não confere.",
  CANNOT_ACT_ON_SELF: "Você não pode fazer isso na sua própria conta.",
  CANNOT_ACT_ON_PLATFORM_ADMIN: "Não é possível agir sobre outro administrador da plataforma.",
  LAST_OWNER: "Este é o último proprietário do workspace.",
  USER_DELETE_BLOCKED: "A exclusão da conta está bloqueada: resolva os impedimentos listados.",
  LAST_PLATFORM_ADMIN: "Esta é a única conta administradora ativa. Promova outra conta a administrador antes.",
  IDEMPOTENCY_CONFLICT: "Esta solicitação já foi enviada com outros dados. Recarregue e tente de novo.",
  EMAIL_ALREADY_REGISTERED:
    "Este e-mail já está cadastrado. Para dar acesso a quem já tem conta, adicione como membro do workspace.",
  WATCH_ALREADY_ACTIVE: "Esse e-mail já está na lista de vigiados.",
  // Genéricos do cliente.
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para acessar este recurso.",
  NOT_FOUND: "Não encontramos este registro.",
  ENDPOINT_UNAVAILABLE: "Este recurso ainda não está disponível no servidor.",
  BAD_REQUEST: "Os dados enviados não são válidos.",
  CONFLICT: "A operação conflita com o estado atual do registro.",
  UNPROCESSABLE: "Não foi possível processar os dados enviados.",
  RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.",
  SERVER_ERROR: "O servidor teve um problema. Tente novamente em instantes.",
  NETWORK_ERROR: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
  INVALID_RESPONSE: "O servidor respondeu em um formato inesperado.",
  UNKNOWN: "Não foi possível concluir a operação.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMessages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
  }
  return [];
}

function resolveCode(status: number, serverCode: string | undefined, messages: string[], hasBody: boolean): AdminApiErrorCode {
  if (serverCode && KNOWN_ADMIN_CODES.includes(serverCode)) return serverCode;
  if (status === 404) {
    // Sem corpo JSON (proxy/CDN) ou com a mensagem padrão do roteador: a rota não existe no servidor.
    return !hasBody || ROUTE_MISS_MESSAGE.test(messages[0] ?? "") ? "ENDPOINT_UNAVAILABLE" : "NOT_FOUND";
  }
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 400) return "BAD_REQUEST";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "UNPROCESSABLE";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}

/**
 * Converte a resposta de erro do backend (`AdminErrorBody`: `{ statusCode, message, error?, details? }`)
 * em `AdminApiError`. `message` pode ser `string | string[]`; o contrato só tipa `string`.
 */
export function toAdminApiError(status: number, body: unknown): AdminApiError {
  const raw = isRecord(body) ? body : {};
  const messages = normalizeMessages(raw.message);
  const fallbackMessages = messages.length > 0 ? messages : normalizeMessages(raw.errors);
  const serverCode = typeof raw.error === "string" ? raw.error : undefined;
  const code = resolveCode(status, serverCode, fallbackMessages, body !== undefined);
  // O texto do servidor só entra quando serve à pessoa: códigos de domínio (mensagem pt-BR escrita para a
  // tela) e 400/404/409/422 (validação, "não encontrado", conflito). "Unauthorized", "Forbidden resource",
  // "Cannot GET /..." e mensagens de 5xx (mascaradas em produção) ficam com o texto padrão daqui.
  const useServerText =
    fallbackMessages.length > 0 &&
    (KNOWN_ADMIN_CODES.includes(code) || (code !== "ENDPOINT_UNAVAILABLE" && SERVER_TEXT_STATUSES.has(status)));
  const message = useServerText ? fallbackMessages.join(" · ") : (DEFAULT_MESSAGE[code] ?? DEFAULT_MESSAGE.UNKNOWN);
  return new AdminApiError({
    status,
    code,
    message,
    messages: useServerText ? fallbackMessages : [message],
    details: raw.details,
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

// ---------------------------------------------------------------------------
// Requisição
// ---------------------------------------------------------------------------

interface RequestInitInternal {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: AdminQuery;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function readJson(res: Response): Promise<unknown | undefined> {
  if (res.status === 204) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function request({ method, path, query, body, idempotencyKey, signal }: RequestInitInternal): Promise<unknown | undefined> {
  const token = getAuthToken();
  if (!token) {
    // Nada de "Bearer null": sem token a chamada nem sai.
    const error = toAdminApiError(401, undefined);
    notifyUnauthorized(error);
    throw error;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${token}`,
    // NÃO incluir "Workspace-Id": o Admin opera em escopo de plataforma.
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey !== undefined) {
    if (!UUID_V4.test(idempotencyKey)) {
      throw new Error("Idempotency-Key inválida: gere com newIdempotencyKey() ou useIdempotencyKey().");
    }
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let res: Response;
  try {
    res = await fetch(getApiUrl(`${normalizedPath}${buildAdminQueryString(query)}`), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw toNetworkError();
  }

  const json = await readJson(res);
  if (!res.ok) {
    const error = toAdminApiError(res.status, json);
    if (res.status === 401 || error.code === "ACCOUNT_SUSPENDED") notifyUnauthorized(error);
    throw error;
  }
  return json;
}

function toNetworkError(): AdminApiError {
  return new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: DEFAULT_MESSAGE.NETWORK_ERROR });
}

function invalidResponse(what: string): AdminApiError {
  return new AdminApiError({
    status: 200,
    code: "INVALID_RESPONSE",
    message: DEFAULT_MESSAGE.INVALID_RESPONSE,
    details: { reason: what },
  });
}

function asEnvelope(json: unknown): { data: unknown; meta: unknown } {
  if (!isRecord(json) || !("data" in json)) throw invalidResponse("envelope sem `data`");
  return { data: json.data, meta: json.meta };
}

function isPageMeta(meta: unknown): meta is AdminPageMeta {
  return (
    isRecord(meta) &&
    typeof meta.page === "number" &&
    typeof meta.per_page === "number" &&
    typeof meta.total === "number" &&
    typeof meta.total_pages === "number"
  );
}

function isCursorMeta(meta: unknown): meta is AdminCursorMeta {
  return (
    isRecord(meta) &&
    typeof meta.has_more === "boolean" &&
    (typeof meta.next_cursor === "string" || meta.next_cursor === null)
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** GET que devolve só o `data` do envelope `{ data }`. */
export async function adminGet<T>(path: string, query?: AdminQuery, options: AdminRequestOptions = {}): Promise<T> {
  const json = await request({ method: "GET", path, query, signal: options.signal });
  return asEnvelope(json).data as T;
}

/** GET que preserva o `meta` do envelope (ex.: `computed_at` de alertas e inconsistências). */
export async function adminGetEnvelope<T, M = unknown>(
  path: string,
  query?: AdminQuery,
  options: AdminRequestOptions = {},
): Promise<AdminEnvelope<T, M>> {
  const json = await request({ method: "GET", path, query, signal: options.signal });
  const { data, meta } = asEnvelope(json);
  return { data: data as T, meta: meta as M | undefined };
}

/** Lista paginada por página: `{ data, meta: { page, per_page, total, total_pages } }`. */
export async function adminList<T>(
  path: string,
  query?: AdminQuery,
  options: AdminRequestOptions = {},
): Promise<AdminListResult<T>> {
  const json = await request({ method: "GET", path, query, signal: options.signal });
  const { data, meta } = asEnvelope(json);
  if (!Array.isArray(data)) throw invalidResponse("`data` não é uma lista");
  if (!isPageMeta(meta)) throw invalidResponse("`meta` de paginação ausente ou incompleto");
  return { data: data as T[], meta };
}

/** Feed por cursor: `{ data, meta: { next_cursor, has_more } }`. */
export async function adminFeed<T>(
  path: string,
  query?: AdminQuery,
  options: AdminRequestOptions = {},
): Promise<AdminFeedResult<T>> {
  const json = await request({ method: "GET", path, query, signal: options.signal });
  const { data, meta } = asEnvelope(json);
  if (!Array.isArray(data)) throw invalidResponse("`data` não é uma lista");
  if (!isCursorMeta(meta)) throw invalidResponse("`meta` de cursor ausente ou incompleto");
  return { data: data as T[], meta };
}

/** POST com corpo JSON e `Idempotency-Key`. Devolve o `data` (ou `undefined` em 204). */
export async function adminPost<T = void>(path: string, body: unknown, options: AdminWriteOptions): Promise<T> {
  const json = await request({
    method: "POST",
    path,
    // Ações sem corpo (reactivate, revoke-sessions…) ainda mandam `{}`: o servidor valida o DTO.
    body: body ?? {},
    idempotencyKey: options.idempotencyKey,
    signal: options.signal,
  });
  return (json === undefined ? undefined : asEnvelope(json).data) as T;
}

/** PATCH com corpo JSON e `Idempotency-Key`. Devolve o `data`. */
export async function adminPatch<T = void>(path: string, body: unknown, options: AdminWriteOptions): Promise<T> {
  const json = await request({
    method: "PATCH",
    path,
    body: body ?? {},
    idempotencyKey: options.idempotencyKey,
    signal: options.signal,
  });
  return (json === undefined ? undefined : asEnvelope(json).data) as T;
}

/**
 * POST sem `Idempotency-Key` (rotas que a API não trata como idempotentes, como as da sentinela de segurança). O
 * corpo é opcional: sem ele nem o `Content-Type` vai.
 */
export async function adminPostPlain<T = void>(path: string, body?: unknown, options: AdminRequestOptions = {}): Promise<T> {
  const json = await request({ method: "POST", path, body, signal: options.signal });
  return (json === undefined ? undefined : asEnvelope(json).data) as T;
}

/** DELETE sem corpo e sem `Idempotency-Key`. Devolve o `data` do envelope. */
export async function adminDelete<T = void>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const json = await request({ method: "DELETE", path, signal: options.signal });
  return (json === undefined ? undefined : asEnvelope(json).data) as T;
}
