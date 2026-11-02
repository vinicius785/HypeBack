/**
 * Reconhecimento dos códigos de ciclo de vida que o servidor devolve ao time do cliente (e ao login).
 *
 * Contrato: `src/shared/admin-platform.types.ts` (`ADMIN_ERROR_CODES`). O corpo do erro é
 * `{ statusCode, message, error, details? }`: o código fica em `error` e `message` pode vir como `string[]`.
 *
 * Os serviços do app lançam esse corpo cru (`throw errorData`) ou um `Error` com `status`/`code`
 * (`http-client`, `buildApiError`). `readWorkspaceStateError` lê os dois formatos; um `Error` que só leva a
 * mensagem não tem como ser reconhecido por aqui, e é por isso que o reconhecimento de verdade das respostas
 * acontece no observador de `fetch` (`response-observer.ts`), que enxerga o corpo antes de qualquer serviço.
 */

export const WORKSPACE_STATE_ERROR_CODES = [
  "WORKSPACE_SUSPENDED", // 403 em tudo que é do workspace, leitura inclusive
  "WORKSPACE_ARCHIVED", // 403 só nas escritas (leitura segue permitida)
  "WORKSPACE_DELETED", // 404: o workspace não existe mais para o time
  "ACCOUNT_SUSPENDED", // 403 só no login (em sessão aberta o servidor responde 401)
  "WORKSPACE_DELETE_BLOCKED", // 409 na exclusão, com `details.blockers`
] as const;
export type WorkspaceStateErrorCode = (typeof WORKSPACE_STATE_ERROR_CODES)[number];

/** Os três que mudam o que o app mostra enquanto a pessoa usa um workspace. */
export const WORKSPACE_REACTION_CODES = ["WORKSPACE_SUSPENDED", "WORKSPACE_ARCHIVED", "WORKSPACE_DELETED"] as const;
export type WorkspaceReactionCode = (typeof WORKSPACE_REACTION_CODES)[number];

const KNOWN_CODES: ReadonlySet<string> = new Set(WORKSPACE_STATE_ERROR_CODES);
const REACTION_CODES: ReadonlySet<string> = new Set(WORKSPACE_REACTION_CODES);

/** Texto pt-BR de cada código para quando o servidor não manda `message`. */
export const WORKSPACE_STATE_DEFAULT_MESSAGE: Record<WorkspaceStateErrorCode, string> = {
  WORKSPACE_SUSPENDED: "Este workspace está suspenso. Fale com o suporte para reativá-lo.",
  WORKSPACE_ARCHIVED: "Este workspace está arquivado e permite apenas consulta.",
  WORKSPACE_DELETED: "Este workspace foi excluído e não está mais disponível.",
  ACCOUNT_SUSPENDED: "Conta suspensa. Entre em contato com o suporte.",
  WORKSPACE_DELETE_BLOCKED: "A exclusão está bloqueada: resolva os impedimentos listados.",
};

export interface WorkspaceStateError {
  code: WorkspaceStateErrorCode;
  /** Status HTTP (`statusCode` do corpo ou `status` do erro); 0 quando não veio. */
  status: number;
  /** Texto do servidor (lista de mensagens vira um texto só) ou o texto padrão do código. */
  message: string;
  details?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `message` do Nest: `string` ou `string[]` (validação). Vazio vira `null`. */
export function normalizeApiMessage(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() === "" ? null : raw.trim();
  if (Array.isArray(raw)) {
    const parts = raw.filter((part): part is string => typeof part === "string" && part.trim() !== "").map((part) => part.trim());
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

export function isWorkspaceReactionCode(code: string): code is WorkspaceReactionCode {
  return REACTION_CODES.has(code);
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function build(code: string, status: number, message: unknown, details: unknown): WorkspaceStateError | null {
  if (!KNOWN_CODES.has(code)) return null;
  const known = code as WorkspaceStateErrorCode;
  return {
    code: known,
    status,
    message: normalizeApiMessage(message) ?? WORKSPACE_STATE_DEFAULT_MESSAGE[known],
    ...(details !== undefined ? { details } : {}),
  };
}

/**
 * Corpo de uma resposta de erro (`await response.json()`) → erro de ciclo de vida, ou `null` quando o corpo não
 * traz um dos códigos conhecidos.
 */
export function parseWorkspaceStateErrorBody(status: number, body: unknown): WorkspaceStateError | null {
  if (!isRecord(body) || typeof body.error !== "string") return null;
  return build(body.error, status, body.message, body.details);
}

/**
 * Qualquer coisa que um serviço lançou → erro de ciclo de vida, ou `null`. Aceita o corpo cru
 * (`{ statusCode, message, error, details }`) e um `Error` com `code`/`status`/`details`.
 */
export function readWorkspaceStateError(error: unknown): WorkspaceStateError | null {
  if (!isRecord(error)) return null;
  const code = typeof error.error === "string" ? error.error : typeof error.code === "string" ? error.code : null;
  if (code === null) return null;
  return build(code, firstNumber(error.statusCode, error.status), error.message, error.details);
}
