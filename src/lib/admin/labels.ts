/**
 * Rótulos pt-BR do vocabulário do contrato do Admin (`admin-platform.types.ts`).
 * Cada mapa é `Record<União, string>`: se o contrato ganhar um valor novo, o TypeScript acusa aqui.
 */
import type {
  AdminActivityKind,
  AdminAlertKind,
  AdminAlertSeverity,
  AdminCampaignStatus,
  AdminCreatorRegistrationState,
  AdminFigureKind,
  AdminMovementType,
  AdminUserKind,
  AdminUserStatus,
  AdminWorkspaceActivity,
  AdminWorkspaceKind,
  AdminWorkspaceRole,
  AdminWorkspaceStatus,
} from "@/shared/admin-platform.types";

export const WORKSPACE_STATUS_LABEL: Record<AdminWorkspaceStatus, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  archived: "Arquivado",
  deleted: "Excluído",
};

/** Atividade real derivada (não é o status do ciclo de vida: um workspace "Ativo" pode estar sem atividade). */
export const WORKSPACE_ACTIVITY_LABEL: Record<AdminWorkspaceActivity["state"], string> = {
  active: "Com atividade",
  inactive: "Sem atividade recente",
  never: "Nunca teve atividade",
};

export function workspaceActivityDescription(state: AdminWorkspaceActivity["state"], windowDays: number): string {
  if (state === "active") return `Teve atividade nos últimos ${windowDays} dias`;
  if (state === "inactive") return `Sem atividade há mais de ${windowDays} dias`;
  return "Nenhuma atividade registrada";
}

export const WORKSPACE_KIND_LABEL: Record<AdminWorkspaceKind, string> = {
  brand: "Marca",
  creator_personal: "Pessoal de criador",
  orphan: "Sem membros",
};

export const USER_STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  deleted: "Excluído",
};

export const USER_KIND_LABEL: Record<AdminUserKind, string> = {
  creator: "Criador",
  brand: "Cliente",
  agency: "Agência",
  admin: "Administrador",
};

export const WORKSPACE_ROLE_LABEL: Record<AdminWorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  aprovador: "Aprovador",
  observador: "Observador",
  juridico: "Jurídico",
  financeiro: "Financeiro",
  analista: "Analista",
  custom: "Personalizado",
};

export const CAMPAIGN_STATUS_LABEL: Record<AdminCampaignStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  finished: "Finalizada",
};

export const CREATOR_REGISTRATION_LABEL: Record<AdminCreatorRegistrationState, string> = {
  complete: "Completo",
  incomplete: "Incompleto",
  stub: "Convite não aceito",
};

export const ALERT_SEVERITY_LABEL: Record<AdminAlertSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Informativo",
};

/** alert = fato objetivo armazenado; suggestion = heurística com limite escolhido pelo produto. */
export const ALERT_KIND_LABEL: Record<AdminAlertKind, string> = {
  alert: "Alerta",
  suggestion: "Sugestão",
};

export const ACTIVITY_KIND_LABEL: Record<AdminActivityKind, string> = {
  admin_action: "Ação administrativa",
  workspace_created: "Workspace criado",
  campaign_created: "Campanha criada",
  charge_paid: "Aporte pago",
  member_joined: "Membro adicionado",
  withdrawal_paid: "Saque pago",
};

export const MOVEMENT_TYPE_LABEL: Record<AdminMovementType, string> = {
  charge: "Aporte",
  ledger_entry: "Lançamento",
  withdrawal: "Saque",
  transfer: "Transferência PIX",
};

// ---------------------------------------------------------------------------
// Números com definição (AdminFigure)
// ---------------------------------------------------------------------------

/** O rótulo que acompanha todo número: a tela nunca apresenta estimativa como realizado. */
export const FIGURE_KIND_LABEL: Record<AdminFigureKind, string> = {
  realized: "Realizado",
  committed: "Comprometido",
  stock: "Posição atual",
  derived: "Calculado",
  proxy: "Aproximado",
  unavailable: "Não apurado",
};

/** Uma frase sobre o que o tipo significa (vai no popover da definição, depois da regra do número). */
export const FIGURE_KIND_HELP: Record<AdminFigureKind, string> = {
  realized: "Fato consolidado: aporte com pagamento confirmado, PIX concluído ou liberação feita.",
  committed: "Compromisso futuro, ainda não é pagamento: reserva de saldo para criador.",
  stock: "Posição de agora, uma fotografia: não depende do período escolhido.",
  derived: "Calculado a partir de outros números por uma regra documentada.",
  proxy: "Aproximação declarada: serve de indicativo, não é o valor exato.",
  unavailable: "Este número não existe no banco de dados, por isso não é mostrado como zero.",
};
