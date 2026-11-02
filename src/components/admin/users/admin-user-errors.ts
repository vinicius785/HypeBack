/**
 * Erros das ações de usuário (suspender, reativar, encerrar sessões) em português claro, por código do
 * contrato, e não pelo texto do servidor: o diálogo diz o que aconteceu e o que fazer, sempre no contexto da ação.
 */
import { AdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError } from "@/lib/admin/admin-errors";
import type { AdminUserActionName } from "@/hooks/admin/use-admin-users-actions";

const SELF_TEXT: Record<AdminUserActionName, string> = {
  suspend: "Você não pode suspender a sua própria conta.",
  reactivate: "Você não pode reativar a sua própria conta.",
  "revoke-sessions": "Você não pode encerrar as sessões da sua própria conta.",
};

const PLATFORM_ADMIN_TEXT: Record<AdminUserActionName, string> = {
  suspend: "Esta pessoa é administradora da plataforma: não é possível suspender a conta de outro administrador.",
  reactivate: "Esta pessoa é administradora da plataforma: não é possível reativar a conta de outro administrador.",
  "revoke-sessions": "Esta pessoa é administradora da plataforma: não é possível encerrar as sessões de outro administrador.",
};

/**
 * Mensagens de validação do DTO (class-validator, em inglês) viram texto de tela. O que não é reconhecido
 * passa como veio: o servidor já escreve as mensagens próprias do produto em português.
 */
export function translateValidationMessage(message: string): string {
  const text = message.trim();
  if (/^reason must be longer than or equal to \d+ characters?$/i.test(text)) return "O motivo precisa ter pelo menos 5 caracteres.";
  if (/^reason must be shorter than or equal to \d+ characters?$/i.test(text)) return "O motivo pode ter no máximo 500 caracteres.";
  if (/^reason (should not be empty|must be a string)$/i.test(text)) return "Informe o motivo.";
  if (/^property \S+ should not exist$/i.test(text)) return "O servidor não reconheceu um dos dados enviados.";
  if (/idempotency-key/i.test(text)) return "Não foi possível identificar este envio. Feche o diálogo e tente de novo.";
  return text;
}

/** Texto do erro de uma ação de usuário, para o diálogo de confirmação. */
export function describeUserActionError(error: unknown, action: AdminUserActionName): string {
  if (!(error instanceof AdminApiError)) return describeAdminError(error);

  switch (error.code) {
    case "CANNOT_ACT_ON_SELF":
      return SELF_TEXT[action];
    case "CANNOT_ACT_ON_PLATFORM_ADMIN":
      return PLATFORM_ADMIN_TEXT[action];
    case "INVALID_STATE_TRANSITION":
      if (action === "suspend") return "Só é possível suspender uma conta ativa. O estado desta conta mudou: confira os dados na tela.";
      if (action === "reactivate") return "Só é possível reativar uma conta suspensa. O estado desta conta mudou: confira os dados na tela.";
      return "Não é possível encerrar as sessões de uma conta excluída.";
    case "NOT_FOUND":
      return "Não encontramos esta conta. Ela pode ter sido removida.";
    case "ENDPOINT_UNAVAILABLE":
      return "Esta ação ainda não está disponível no servidor.";
    case "ACCOUNT_SUSPENDED":
      return "A sua conta foi suspensa. Entre novamente para continuar.";
    case "BAD_REQUEST":
    case "UNPROCESSABLE": {
      // O backend manda uma lista quando o DTO falha em vários campos: uma frase para cada, sem repetir.
      const translated = [...new Set(error.messages.map(translateValidationMessage).filter(Boolean))];
      return translated.length > 0 ? translated.join(" ") : describeAdminError(error);
    }
    default:
      return describeAdminError(error);
  }
}

/**
 * O erro mostra que o estado da conta na tela está velho (outra pessoa agiu antes, ou a conta sumiu): a tela
 * busca o detalhe de novo para mostrar a verdade, em vez de deixar botões que não funcionam mais.
 */
export function userActionErrorOutdatesScreen(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.code === "INVALID_STATE_TRANSITION" ||
      error.code === "CANNOT_ACT_ON_SELF" ||
      error.code === "CANNOT_ACT_ON_PLATFORM_ADMIN" ||
      error.code === "NOT_FOUND")
  );
}
