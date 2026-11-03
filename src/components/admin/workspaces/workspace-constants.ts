/**
 * Vocabulário e configuração das telas de Workspaces do Admin: filtros e ordenação da lista, abas e ações do
 * detalhe, papéis e rótulos que não estão em `src/lib/admin/labels.ts`.
 */
import type { AdminFilterDef, AdminFilterOption } from "@/components/admin/platform";
import { isValidCivilDate } from "./workspace-format";
import {
  createAdminListSearchValidator,
  type AdminListSearch,
  type AdminListStateConfig,
} from "@/lib/admin/list-query";
import { WORKSPACE_ROLE_LABEL } from "@/lib/admin/labels";
import {
  WORKSPACE_LIFECYCLE_STATUSES,
  type AdminAssignableWorkspaceRole,
  type AdminDeleteBlockerCode,
  type AdminMovementType,
  type AdminWorkspaceActionAvailability,
  type AdminWorkspaceRole,
} from "@/shared/admin-platform.types";

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export const WORKSPACE_FILTER_KEYS = ["status", "activity", "kind", "created_from", "created_to"] as const;
export type WorkspaceFilterKey = (typeof WORKSPACE_FILTER_KEYS)[number];

/** As chaves de ordenação do contrato (`sort_by`). A padrão do servidor é `created_at` decrescente. */
export const WORKSPACE_SORT_KEYS = ["created_at", "last_activity", "volume", "name", "members", "campaigns"] as const;

/**
 * Padrões iguais aos do servidor: `kind=brand` (clientes), `status` ausente (ativos, suspensos e arquivados) e
 * `created_at` decrescente. Valor igual ao padrão não vai para a URL nem para a API.
 */
export const WORKSPACE_LIST_CONFIG: AdminListStateConfig<WorkspaceFilterKey> = {
  filterKeys: WORKSPACE_FILTER_KEYS,
  defaultFilters: { kind: "brand" },
  sortKeys: WORKSPACE_SORT_KEYS,
  defaultSortBy: "created_at",
  defaultOrder: "desc",
};

/**
 * Segmento de estado da lista. O primeiro é o padrão do servidor: tudo que ainda existe para o cliente
 * (ativos, suspensos e arquivados), então "Todos" é "todos, exceto excluídos". Os excluídos são um filtro à
 * parte (`WORKSPACE_DELETED_STATUS`, o botão "Excluídos" da barra), mas moram no mesmo parâmetro `status` da URL:
 * os valores de cada estado (e os links do Dashboard, `?status=suspended`) não mudaram.
 */
export const WORKSPACE_STATUS_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "suspended", label: "Suspensos" },
  { value: "archived", label: "Arquivados" },
];

/** Valor de `status` do filtro "Excluídos" (o quinto estado, fora do segmento). */
export const WORKSPACE_DELETED_STATUS = "deleted";

/**
 * "Uso recente" é a atividade real derivada (`activity`), não o estado do ciclo de vida: as respostas são curtas
 * ("Uso recente: Sim") para não repetir "Ativos" com outro sentido. Os valores da URL continuam os mesmos.
 */
export const WORKSPACE_ACTIVITY_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Qualquer" },
  { value: "active", label: "Sim" },
  { value: "inactive", label: "Não" },
  { value: "never", label: "Nunca usaram" },
];

export const WORKSPACE_KIND_OPTIONS: readonly AdminFilterOption[] = [
  { value: "brand", label: "Clientes" },
  { value: "creator_personal", label: "Pessoais de criadores" },
  { value: "orphan", label: "Órfãos" },
  { value: "all", label: "Todos" },
];

/**
 * Filtros da barra, fora o liga/desliga "Excluídos" (que depende do estado da tela). "Uso recente" fica sempre à
 * vista (`inline`); "Tipo" e "Criado em" moram no painel "Filtros" do celular (no desktop se misturam à linha).
 */
export const WORKSPACE_LIST_FILTERS: readonly AdminFilterDef[] = [
  { kind: "select", key: "activity", label: "Uso recente", options: WORKSPACE_ACTIVITY_OPTIONS, defaultValue: "", inline: true },
  { kind: "select", key: "kind", label: "Tipo", options: WORKSPACE_KIND_OPTIONS, defaultValue: "brand" },
  { kind: "date-range", label: "Criado em", fromKey: "created_from", toKey: "created_to" },
];

/** Primeira direção de cada coluna ao clicar: nome de A a Z; números e datas do maior/mais novo para o menor. */
export const WORKSPACE_SORT_FIRST_ORDER: Record<string, "asc" | "desc"> = {
  name: "asc",
  last_activity: "desc",
  volume: "desc",
  members: "desc",
  campaigns: "desc",
  created_at: "desc",
};

const STATUS_VALUES: readonly string[] = WORKSPACE_LIFECYCLE_STATUSES;
const ACTIVITY_VALUES = ["active", "inactive", "never"];
const KIND_VALUES = ["brand", "creator_personal", "orphan", "all"];

type WorkspaceListSearch = AdminListSearch<WorkspaceFilterKey>;

/**
 * Tira da URL o que o servidor recusaria (a barra de endereço é entrada de usuário): estado fora do
 * vocabulário (o CSV vale, sem os itens inválidos), atividade e tipo desconhecidos, data que não existe.
 */
export function sanitizeWorkspaceListSearch(search: WorkspaceListSearch): WorkspaceListSearch {
  const out: WorkspaceListSearch = { ...search };

  if (out.status !== undefined) {
    const parts = out.status.split(",").map((s) => s.trim());
    if (parts.includes("all")) out.status = "all";
    else {
      const valid = parts.filter((s) => STATUS_VALUES.includes(s));
      if (valid.length > 0) out.status = [...new Set(valid)].join(",");
      else delete out.status;
    }
  }
  if (out.activity !== undefined && !ACTIVITY_VALUES.includes(out.activity)) delete out.activity;
  if (out.kind !== undefined && !KIND_VALUES.includes(out.kind)) delete out.kind;
  if (out.created_from !== undefined && !isValidCivilDate(out.created_from)) delete out.created_from;
  if (out.created_to !== undefined && !isValidCivilDate(out.created_to)) delete out.created_to;
  return out;
}

const baseValidator = createAdminListSearchValidator(WORKSPACE_LIST_CONFIG);

/** `validateSearch` da rota da lista. */
export function validateWorkspaceListSearch(raw: Record<string, unknown>): WorkspaceListSearch {
  return sanitizeWorkspaceListSearch(baseValidator(raw));
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export const WORKSPACE_TAB_IDS = ["resumo", "usuarios", "campanhas", "financeiro", "atividade"] as const;
export type WorkspaceTabId = (typeof WORKSPACE_TAB_IDS)[number];

export const WORKSPACE_TAB_LABEL: Record<WorkspaceTabId, string> = {
  resumo: "Resumo",
  usuarios: "Usuários",
  campanhas: "Campanhas",
  financeiro: "Financeiro",
  atividade: "Atividade",
};

export type WorkspaceAction = "suspend" | "reactivate" | "archive" | "unarchive" | "delete" | "restore";

/** Ordem do menu "Ações". Cada item só aparece quando `detail.can` permite. */
export const WORKSPACE_ACTION_ORDER: readonly WorkspaceAction[] = [
  "suspend",
  "reactivate",
  "archive",
  "unarchive",
  "delete",
  "restore",
];

export const WORKSPACE_ACTION_LABEL: Record<WorkspaceAction, string> = {
  suspend: "Suspender",
  reactivate: "Reativar",
  archive: "Arquivar",
  unarchive: "Desarquivar",
  delete: "Excluir",
  restore: "Restaurar",
};

/** `can` do contrato por ação. A edição (`update`) é o botão "Editar dados", fora do menu. */
export function availableActions(can: AdminWorkspaceActionAvailability): WorkspaceAction[] {
  return WORKSPACE_ACTION_ORDER.filter((action) => can[action]);
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

/**
 * Papéis que dá para atribuir pelo Admin. "Personalizado" fica de fora: ele depende de uma lista de
 * permissões que o contrato do Admin não traz (só `has_custom_permissions` na leitura).
 */
export const ASSIGNABLE_ROLES: readonly AdminAssignableWorkspaceRole[] = [
  "owner",
  "admin",
  "member",
  "aprovador",
  "observador",
  "juridico",
  "financeiro",
  "analista",
];

export function isAssignableRole(role: AdminWorkspaceRole): role is AdminAssignableWorkspaceRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function roleLabel(role: AdminWorkspaceRole): string {
  return WORKSPACE_ROLE_LABEL[role] ?? role;
}

// ---------------------------------------------------------------------------
// Impacto, financeiro e atividade
// ---------------------------------------------------------------------------

export const BLOCKER_LABEL: Record<AdminDeleteBlockerCode, string> = {
  HAS_CUSTODY_BALANCE: "Saldo em custódia",
  HAS_COMMITTED_FUNDS: "Valor comprometido",
  HAS_PENDING_CHARGES: "Cobranças pendentes",
  HAS_WITHDRAWALS_IN_FLIGHT: "Saques em andamento",
  HAS_PUBLISHED_CAMPAIGNS: "Campanhas publicadas",
  // Exclusão de CONTA (usuário ou criador)
  IS_SOLE_WORKSPACE_OWNER: "Único proprietário de workspace",
  HAS_OPEN_BALANCE: "Saldo do criador em aberto",
  HAS_PENDING_WITHDRAWAL: "Saque pendente",
};

/** Status do lançamento (ledger) em texto. Status novo do servidor aparece cru, nunca some. */
export const LEDGER_STATUS_LABEL: Record<string, string> = {
  reserved: "reservados",
  pending_release: "em carência",
  available: "disponíveis",
  withdrawn: "sacados",
  cancelled: "cancelados",
};

export const MOVEMENT_ORIGIN_LABEL: Record<string, string> = {
  asaas_charge: "Cobrança Asaas",
  balance_entry: "Lançamento de saldo",
  withdrawal: "Saque",
  asaas_transfer: "Transferência Asaas",
};

export const MOVEMENT_DIRECTION_SIGN: Record<string, string> = { in: "+", out: "−", internal: "" };

export const MOVEMENT_TYPE_OPTIONS: readonly { value: AdminMovementType | "all"; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "charge", label: "Aportes" },
  { value: "ledger_entry", label: "Lançamentos" },
  { value: "withdrawal", label: "Saques" },
  { value: "transfer", label: "PIX" },
];
