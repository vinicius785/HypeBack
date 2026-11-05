/**
 * Textos da equipe da plataforma. O catálogo de papéis (nome, descrição, permissões) vem de
 * `GET /admin/platform-team`; aqui só o que é da tela: a cor de cada papel e a frase de cada permissão.
 */
import type { AdminBadgeTone } from "@/components/admin/platform";
import { AdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError } from "@/lib/admin/admin-errors";
import type { AdminPlatformPermission, AdminPlatformRole } from "@/shared/admin-platform.types";

import { translateValidationMessage } from "../users/admin-user-errors";

export const ROLE_TONE: Record<AdminPlatformRole, AdminBadgeTone> = {
  admin: "brand",
  support: "ok",
  viewer: "muted",
};

/** Nome curto do papel, para quando o catálogo ainda não chegou. */
export const ROLE_FALLBACK_LABEL: Record<AdminPlatformRole, string> = {
  admin: "Administrador",
  support: "Suporte",
  viewer: "Somente leitura",
};

export const PERMISSION_TEXT: Record<AdminPlatformPermission, string> = {
  read: "Ver todas as telas do Admin",
  "users.moderate": "Suspender e reativar contas e encerrar sessões",
  "workspaces.moderate": "Suspender e reativar workspaces",
  "support.manage": "Responder pedidos de suporte e mudar status, prioridade e responsável",
};

/** O que só o administrador faz (os outros papéis nunca têm). */
export const ADMIN_ONLY_TEXT: readonly string[] = [
  "Excluir contas e arquivar ou excluir workspaces",
  "Mexer em membros, em dinheiro e nos dados dos workspaces",
  "Gerenciar a equipe da plataforma",
];

/** Erros da troca de papel, em português claro e no contexto da ação. */
export function describeTeamError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return describeAdminError(error);
  switch (error.code) {
    case "LAST_PLATFORM_ADMIN":
      return "Esta é a única conta administradora ativa. Promova outra conta a administrador antes de tirar este papel.";
    case "CANNOT_ACT_ON_SELF":
      return "Você não pode mudar o seu próprio papel. Peça a outro administrador.";
    case "FORBIDDEN":
      return "Só administradores da plataforma podem mudar papéis da equipe.";
    case "NOT_FOUND":
      return "Não encontramos esta conta. Ela pode ter sido removida.";
    case "BAD_REQUEST":
    case "UNPROCESSABLE": {
      const translated = [...new Set(error.messages.map(translateValidationMessage).filter(Boolean))];
      return translated.length > 0 ? translated.join(" ") : describeAdminError(error);
    }
    default:
      // INVALID_STATE_TRANSITION traz a frase certa do servidor ("A conta já tem esse papel.", "Criadores não fazem parte…").
      return describeAdminError(error);
  }
}

/** O erro mostra que a lista na tela está velha (a conta mudou antes): a tela busca de novo. */
export function teamErrorOutdatesScreen(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.code === "INVALID_STATE_TRANSITION" || error.code === "LAST_PLATFORM_ADMIN" || error.code === "NOT_FOUND")
  );
}
