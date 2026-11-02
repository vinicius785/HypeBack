/**
 * Erros das ações de workspace e de membros em texto pt-BR para a pessoa.
 *
 * O texto que o servidor manda nos códigos de domínio é aproveitado pelo cliente (`toAdminApiError`), mas
 * aqui cada código ganha a frase certa para a AÇÃO (o que a pessoa faz em seguida), então o texto do
 * servidor só serve de reserva para o que não está listado (validação de campo, conflito sem código).
 */
import { isAdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError } from "@/lib/admin/admin-errors";

const MESSAGES: Record<string, string> = {
  INVALID_STATE_TRANSITION: "O estado do workspace mudou e esta ação não é mais permitida. Atualizamos a página.",
  WORKSPACE_DELETE_BLOCKED:
    "A exclusão está bloqueada: resolva os impedimentos listados ou arquive o workspace em vez de excluir.",
  IMPACT_TOKEN_MISMATCH:
    "Os números do workspace mudaram desde que o resumo foi mostrado. Atualizamos o resumo: revise e confirme de novo.",
  CONFIRMATION_MISMATCH: "O nome digitado não confere com o nome do workspace.",
  CANNOT_ACT_ON_SELF: "Você não pode fazer isso na sua própria conta.",
  CANNOT_ACT_ON_PLATFORM_ADMIN: "Não é possível agir sobre outro administrador da plataforma.",
  LAST_OWNER:
    "Este é o último proprietário do workspace. Defina outro proprietário antes de remover ou rebaixar esta pessoa.",
  IDEMPOTENCY_CONFLICT: "Esta solicitação já foi enviada com outros dados. Feche o diálogo e tente de novo.",
  WORKSPACE_DELETED: "Este workspace foi excluído.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
};

/** Texto pronto para o diálogo ou o toast. */
export function workspaceErrorMessage(error: unknown): string {
  if (isAdminApiError(error) && MESSAGES[error.code]) return MESSAGES[error.code];
  return describeAdminError(error);
}
