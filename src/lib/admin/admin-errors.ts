/**
 * Leitura de erros do Admin para as telas: texto pronto para a pessoa e dados estruturados do backend.
 * O mapeamento status/código → texto mora em `toAdminApiError` (`admin-client.ts`).
 */
import type { AdminDeleteBlocker } from "@/shared/admin-platform.types";
import { USER_DELETE_BLOCKER_CODES, WORKSPACE_DELETE_BLOCKER_CODES } from "@/shared/admin-platform.types";

import { AdminApiError } from "./admin-client";

const GENERIC = "Não foi possível concluir a operação.";

/** Texto pt-BR para exibir (toast, estado de erro, mensagem do diálogo). Nunca expõe erro técnico cru. */
export function describeAdminError(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  return GENERIC;
}

/** O servidor ainda não tem a rota (deploy do backend atrasado): a tela mostra "recurso indisponível". */
export function isEndpointUnavailable(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === "ENDPOINT_UNAVAILABLE";
}

const BLOCKER_CODES: readonly string[] = [...WORKSPACE_DELETE_BLOCKER_CODES, ...USER_DELETE_BLOCKER_CODES];

/**
 * Impedimentos de WORKSPACE_DELETE_BLOCKED e de USER_DELETE_BLOCKED (`details.blockers`); lista vazia para qualquer
 * outro erro.
 */
export function getDeleteBlockers(error: unknown): AdminDeleteBlocker[] {
  if (!(error instanceof AdminApiError)) return [];
  if (error.code !== "WORKSPACE_DELETE_BLOCKED" && error.code !== "USER_DELETE_BLOCKED") return [];
  const details = error.details;
  if (typeof details !== "object" || details === null) return [];
  const blockers = (details as { blockers?: unknown }).blockers;
  if (!Array.isArray(blockers)) return [];
  return blockers.filter(
    (b): b is AdminDeleteBlocker =>
      typeof b === "object" &&
      b !== null &&
      typeof (b as { code?: unknown }).code === "string" &&
      BLOCKER_CODES.includes((b as { code: string }).code) &&
      typeof (b as { message?: unknown }).message === "string",
  );
}
