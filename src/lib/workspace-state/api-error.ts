/**
 * Erro de API do app com o que as telas precisam além do texto: status HTTP, código de domínio (`error` do
 * corpo) e `details`. Mesma convenção dos serviços que já penduram `status` no `Error`; a diferença é que
 * `code` e `details` também ficam à mão (ex.: `WORKSPACE_DELETE_BLOCKED` traz `details.blockers`).
 */
import { isRecord, normalizeApiMessage } from "./lifecycle-errors";

export type ApiError = Error & {
  status: number;
  code?: string;
  details?: unknown;
};

/**
 * Monta o erro a partir da resposta de erro. O texto é o `message` do servidor (lista vira um texto só); sem
 * ele, o próprio `error` do corpo (ex.: "Bad Request"); sem corpo, `fallbackMessage`.
 */
export function buildApiError(status: number, body: unknown, fallbackMessage: string): ApiError {
  const record = isRecord(body) ? body : {};
  const code = typeof record.error === "string" && record.error !== "" ? record.error : undefined;
  const error = new Error(normalizeApiMessage(record.message) ?? code ?? fallbackMessage) as ApiError;
  error.status = status;
  if (code !== undefined) error.code = code;
  if (record.details !== undefined) error.details = record.details;
  return error;
}
