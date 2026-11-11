/** Erros de "Gerar código de recuperação" em português claro, por status e código, sem vazar detalhe técnico. */
import { AdminApiError } from "@/lib/admin/admin-client";

export function describeStaffRecoveryError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Não foi possível gerar o código. Tente novamente.";
  if (error.code === "APPROVAL_CODE_REQUIRED") return "Informe o código do Google Authenticator.";
  if (error.code === "APPROVAL_CODE_INVALID") {
    return "Código do Authenticator inválido ou já usado. Aguarde o próximo código (30 s) e tente de novo.";
  }
  if (error.code === "APPROVAL_CODE_LOCKED") return "Muitas tentativas com o código do Authenticator. Tente novamente em alguns minutos.";
  if (error.code === "CANNOT_ACT_ON_SELF") return "Você não pode gerar um código para a sua própria conta. Peça a outro admin.";
  if (error.code === "NOT_STAFF_ACCOUNT") return "Este usuário não é da equipe da plataforma.";
  switch (error.status) {
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 403:
      return "Só administradores da plataforma podem gerar códigos de recuperação.";
    case 429:
      return "Muitos códigos gerados. Tente novamente mais tarde.";
    case 503:
      return "Recuperação indisponível no momento. Tente novamente.";
    default:
      return "Não foi possível gerar o código. Tente novamente.";
  }
}
