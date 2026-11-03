/**
 * Vocabulário pt-BR das alterações administrativas (`GET /admin/audit-log`). Cada mapa de união é
 * `Record<União, string>`: código de ação novo no contrato quebra a compilação aqui.
 */
import type { AdminActionCode } from "@/shared/admin-platform.types";

import type { AuditTargetType } from "./activity-search";

/** Texto do filtro "Ação". Nas linhas do log vale o `action_label` que o servidor manda; estes são o plano B e o filtro. */
export const AUDIT_ACTION_LABEL: Record<AdminActionCode, string> = {
  "workspace.update": "Workspace editado",
  "workspace.suspend": "Workspace suspenso",
  "workspace.reactivate": "Workspace reativado",
  "workspace.archive": "Workspace arquivado",
  "workspace.unarchive": "Workspace desarquivado",
  "workspace.delete": "Workspace excluído",
  "workspace.restore": "Workspace restaurado",
  "workspace.delete_by_tenant": "Workspace excluído pelo cliente",
  "workspace.member.add": "Membro adicionado",
  "workspace.member.role_change": "Papel do membro alterado",
  "workspace.member.remove": "Membro removido",
  "user.suspend": "Usuário suspenso",
  "user.reactivate": "Usuário reativado",
  "user.sessions_revoke": "Sessões encerradas",
  "user.merge": "Usuários mesclados",
  "user.delete": "Conta excluída",
  "user.platform_role_change": "Papel na equipe alterado",
  "balance.manual_credit": "Crédito manual de saldo a um criador",
  "balance.topup": "Recarga de saldo de workspace criada por administrador",
  "balance.simulate_payment": "Pagamento simulado por administrador",
};

export const AUDIT_TARGET_LABEL: Record<AuditTargetType, string> = {
  workspace: "Workspace",
  user: "Usuário",
  workspace_member: "Membro de workspace",
};

/** `actor.role` vem como texto livre do servidor; o que não se conhece aparece como veio. */
const ACTOR_ROLE_LABEL: Record<string, string> = {
  admin: "Administrador da plataforma",
  owner: "Proprietário do workspace",
};

export function actorRoleLabel(role: string): string {
  return ACTOR_ROLE_LABEL[role] ?? role;
}
