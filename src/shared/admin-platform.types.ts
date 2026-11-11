/**
 * CONTRATO DA API DO ADMIN DA PLATAFORMA — `/api/backoffice/admin/*`.
 *
 * Fonte da verdade. Este arquivo é copiado byte a byte para o frontend em
 * `hype-backoffice-main/src/shared/admin-platform.types.ts`; os dois precisam ficar idênticos
 * (`diff` vazio). Só tipos e constantes — sem imports, para poder ser copiado como está.
 *
 * Regras que valem para TODOS os endpoints abaixo:
 *  - Escopo de plataforma: sem header `Workspace-Id`. Guards: ClientTypeGuard, AuthGuard, AbilityGuard
 *    (`client_type:backoffice`) e PlatformAdminGuard. O frontend esconder botão NÃO é segurança.
 *  - Envelope: `{ data }` para um item; `{ data, meta }` para listas; erros em `AdminErrorBody`.
 *  - Datas e horas: ISO 8601 em UTC. Períodos (`from`, `to`) são `YYYY-MM-DD`, dias inteiros de SÃO PAULO
 *    (America/Sao_Paulo), `to` inclusivo: um aporte pago às 22h de 31/10 em São Paulo pertence a 31/10.
 *  - Ordenação padrão das listas: created_at desc, com id desc como desempate; feeds: mais recentes primeiro.
 *  - Toda mutação do Admin (POST/PATCH) responde 200 com `{ data }`, nunca 201.
 *  - Dinheiro: sempre centavos inteiros de BRL (`*_cents`).
 *  - Ids públicos: workspace e campanha trafegam por `public_id` (uuid); usuário por id numérico.
 *  - Nada de segredo na resposta: nunca hash de senha, token, `integrations.metadata`, chave PIX.
 *  - Número que não existe no banco NÃO vira 0: vem como `AdminFigure` com `kind: 'unavailable'` e `value: null`.
 *  - Mutação exige `reason` (5 a 500 caracteres) e header `Idempotency-Key` (UUID v4, um por intenção do usuário):
 *    sem o header, 400; repetir a mesma chave na mesma rota devolve a resposta original, sem aplicar a mudança de novo.
 *    Toda mutação grava uma linha em `platform_admin_action_log` na mesma transação da mudança.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. Números com definição
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O que o número É. A UI mostra o rótulo certo e nunca apresenta estimativa como realizado.
 *  - realized     fato consolidado (aporte com pagamento confirmado, PIX concluído, liberação feita)
 *  - committed    compromisso futuro, ainda não é pagamento (reserva de saldo para criador)
 *  - stock        posição atual, fotografia de agora (saldo em custódia); não depende de período
 *  - derived      calculado de outros campos por uma regra documentada em `definition`
 *  - proxy        aproximação declarada (ex.: "sessão usada", que some quando a pessoa sai)
 *  - unavailable  não existe no banco; `value` é null
 */
export type AdminFigureKind =
  | 'realized'
  | 'committed'
  | 'stock'
  | 'derived'
  | 'proxy'
  | 'unavailable';

export type AdminFigureUnit = 'count' | 'brl_cents' | 'percent' | 'days';

export interface AdminFigure {
  value: number | null;
  unit: AdminFigureUnit;
  kind: AdminFigureKind;
  /** pt-BR, curta, com a regra exata (tabelas/estados/janela). É o texto do tooltip "como é calculado". */
  definition: string;
}

export interface AdminDateRange {
  from: string; // YYYY-MM-DD (dia de São Paulo)
  to: string; // YYYY-MM-DD (dia de São Paulo), inclusivo
}
// Quando from/to são omitidos o servidor usa os últimos 30 dias CONTANDO hoje (em São Paulo): de hoje-29 até hoje.
// O intervalo máximo é de 366 dias, contando as duas pontas.

// ═══════════════════════════════════════════════════════════════════════════
// 2. Listas, paginação e erros
// ═══════════════════════════════════════════════════════════════════════════

/** Parâmetros comuns das listas paginadas por página. */
export interface AdminListQuery {
  page?: number; // 1-based, default 1
  per_page?: number; // default 25, máximo 100
  search?: string; // até 100 caracteres; % e _ são tratados como texto
  order?: 'asc' | 'desc';
}

export interface AdminPageMeta {
  page: number;
  per_page: number;
  total: number;
  /** 0 quando a lista está vazia. */
  total_pages: number;
  /**
   * Textos de "como é calculado" das colunas derivadas desta lista. A chave é o id da coluna na tabela da tela
   * ('activity', 'funded', 'custody', 'creators', 'owner', 'last_session', ...).
   */
  definitions?: Record<string, string>;
}

export interface AdminListResponse<T> {
  data: T[];
  meta: AdminPageMeta;
}

export interface AdminItemResponse<T> {
  data: T;
}

/**
 * Feeds longos (atividade, movimentações): cursor opaco assinado pelo servidor. Um cursor só vale para os MESMOS
 * filtros com que foi emitido; usado com outros, o servidor responde 400.
 */
export interface AdminCursorMeta {
  next_cursor: string | null;
  has_more: boolean;
}

export interface AdminFeedResponse<T> {
  data: T[];
  meta: AdminCursorMeta;
}

export const ADMIN_ERROR_CODES = [
  // aplicados fora do Admin também (guards): o cliente final recebe estes códigos
  'ACCOUNT_SUSPENDED', // 403 SÓ no login; em sessão aberta o servidor responde 401 (o app do criador desloga em silêncio)
  'WORKSPACE_SUSPENDED', // 403 em tudo que é do workspace
  'WORKSPACE_ARCHIVED', // 403 em escrita; leitura segue permitida
  'WORKSPACE_DELETED', // 404: o workspace não existe mais para o time do cliente
  // específicos do Admin
  'INVALID_STATE_TRANSITION', // 409
  'WORKSPACE_DELETE_BLOCKED', // 409, `details.blockers`
  'USER_DELETE_BLOCKED', // 409, `details.blockers` (conta com saldo, saque em andamento ou único proprietário)
  'CAMPAIGN_DELETE_BLOCKED', // 409, `details.blockers` (campanha que já movimentou saldo ou reservas de criadores)
  'IMPACT_TOKEN_MISMATCH', // 409: o impacto mudou desde que o resumo foi mostrado
  'CONFIRMATION_MISMATCH', // 422: o nome digitado não confere
  'CANNOT_ACT_ON_SELF', // 409
  'CANNOT_ACT_ON_PLATFORM_ADMIN', // 409
  'LAST_OWNER', // 409
  'LAST_PLATFORM_ADMIN', // 409: tirar o papel do último administrador ativo da plataforma
  'IDEMPOTENCY_CONFLICT', // 409
  'NOT_STAFF_ACCOUNT', // 400: gerar código de recuperação de senha para quem não é da equipe da plataforma
] as const;
export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

export interface AdminErrorBody {
  statusCode: number;
  /** Lista quando é erro de validação do DTO. O corpo real também traz errors, timestamp, path e method. */
  message: string | string[];
  error?: AdminErrorCode | string;
  /** Para WORKSPACE_DELETE_BLOCKED: `{ blockers: AdminDeleteBlocker[] }`. */
  details?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Vocabulário compartilhado
// ═══════════════════════════════════════════════════════════════════════════

export const WORKSPACE_LIFECYCLE_STATUSES = [
  'active',
  'suspended',
  'archived',
  'deleted',
] as const;
export type AdminWorkspaceStatus = (typeof WORKSPACE_LIFECYCLE_STATUSES)[number];

/**
 * brand            tem ao menos um membro cliente/agência/admin NÃO excluído (users.type 20, 30 ou 100): é um CLIENTE
 * creator_personal tem membro criador (users.type 10, mesmo que excluído: a conta ser apagada não torna o workspace
 *                  pessoal um órfão) e nenhum membro de marca ativo
 * orphan           todo o resto: sem nenhum membro, só membros de marca excluídos ou só tipos desconhecidos;
 *                  inconsistência a investigar
 */
export type AdminWorkspaceKind = 'brand' | 'creator_personal' | 'orphan';

export type AdminWorkspaceRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'aprovador'
  | 'observador'
  | 'juridico'
  | 'financeiro'
  | 'analista'
  | 'cliente'
  | 'custom';

/** users.type: 10 criador, 20 cliente, 30 agência, 100 admin. */
export type AdminUserKind = 'creator' | 'brand' | 'agency' | 'admin';

/** `deleted` quando users.deleted_at está preenchido; `suspended` quando users.status = 'suspended'. */
export type AdminUserStatus = 'active' | 'suspended' | 'deleted';

export interface AdminUserRef {
  user_id: number;
  name: string;
}

export interface AdminWorkspaceRef {
  id: string; // public_id
  name: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Workspaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/workspaces
 * Padrão: só clientes (kind=brand), sem os excluídos.
 * `search` casa nome do workspace, nome/e-mail do dono, public_id e CNPJ (só dígitos).
 */
export interface AdminWorkspaceListQuery extends AdminListQuery {
  /** CSV de AdminWorkspaceStatus ou 'all'. Padrão: 'active,suspended,archived'. */
  status?: string;
  /** Estado de atividade derivado (ver AdminWorkspaceActivity). */
  activity?: 'active' | 'inactive' | 'never';
  /** Padrão: 'brand'. */
  kind?: AdminWorkspaceKind | 'all';
  created_from?: string; // YYYY-MM-DD
  created_to?: string; // YYYY-MM-DD
  sort_by?: 'created_at' | 'last_activity' | 'volume' | 'name' | 'members' | 'campaigns';
}

export interface AdminWorkspaceOwner {
  user_id: number;
  name: string;
  email: string;
}

/**
 * Atividade REAL do workspace. `last_activity_at` é o maior (mais recente) de:
 *  - criação de campanha (campaigns.created_at, não excluída)
 *  - aporte pago (asaas_charges.paid_at)
 *  - movimentação de criadores feita pelo time do cliente (campaign_user_status_history, origem backoffice)
 * `state`: 'active' se `last_activity_at` está dentro de `window_days` dias; 'inactive' se mais antigo;
 * 'never' se não há nenhum evento. `workspaces.updated_at` NÃO entra (não é mantido).
 */
export interface AdminWorkspaceActivity {
  state: 'active' | 'inactive' | 'never';
  last_activity_at: string | null;
  window_days: number; // 30
}

export interface AdminWorkspaceListItem {
  id: string; // public_id
  name: string;
  photo: string | null;
  tax_id: string | null;
  kind: AdminWorkspaceKind;
  status: AdminWorkspaceStatus;
  status_changed_at: string | null;
  /** Primeiro dono (role='owner' mais antigo). null = sem dono (inconsistência). */
  owner: AdminWorkspaceOwner | null;
  owners_count: number;
  created_at: string;
  activity: AdminWorkspaceActivity;
  /** Aproximação: maior last_used_at das sessões dos membros. Some quando a pessoa sai. */
  last_session_at: string | null;
  members_count: number; // exclui usuários excluídos
  campaigns_count: number; // não excluídas
  published_campaigns_count: number;
  /** Criadores distintos com participação em campanhas do workspace. */
  creators_count: number;
  /** Aportes pagos (soma de asaas_charges com paid_at), todo o histórico. É o "volume" da ordenação. */
  funded_cents: number;
  /** Saldo em custódia agora (workspace_balances.balance_cents). */
  custody_cents: number;
}

export type AdminWorkspaceListResponse = AdminListResponse<AdminWorkspaceListItem>;

export interface AdminWorkspaceAddress {
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  unit: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface AdminWorkspaceLifecycle {
  status: AdminWorkspaceStatus;
  suspended_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  status_changed_at: string | null;
  status_reason: string | null;
  status_changed_by: AdminUserRef | null;
}

/** Quais ações o estado atual permite (só a máquina de estados; bloqueios por dinheiro vêm do /impact). */
export interface AdminWorkspaceActionAvailability {
  update: boolean;
  suspend: boolean;
  reactivate: boolean;
  archive: boolean;
  unarchive: boolean;
  delete: boolean;
  restore: boolean;
}

/** GET /admin/workspaces/:workspaceId */
export interface AdminWorkspaceDetail {
  id: string;
  name: string;
  photo: string | null;
  description: string | null;
  niche: { id: number; name: string } | null;
  kind: AdminWorkspaceKind;
  /** Tipo de conta escolhido pelo Admin. Ausente em API antiga = `brand`. Outro conceito que o `kind` (derivado do dono). */
  account_type?: "brand" | "agency";
  legal_name: string | null;
  tax_id: string | null;
  address: AdminWorkspaceAddress;
  created_at: string;
  lifecycle: AdminWorkspaceLifecycle;
  owners: AdminWorkspaceOwner[];
  activity: AdminWorkspaceActivity;
  last_session_at: string | null;
  counts: {
    members: number;
    campaigns: number;
    published_campaigns: number;
    creators: number;
  };
  money: {
    funded_cents: number;
    custody_cents: number;
    committed_cents: number;
  };
  can: AdminWorkspaceActionAvailability;
}

/** GET /admin/workspaces/:workspaceId/members */
export interface AdminWorkspaceMember {
  user_id: number;
  name: string;
  email: string;
  photo: string | null;
  role: AdminWorkspaceRole;
  /** true quando user_workspace.permissions sobrescreve o padrão do papel. */
  has_custom_permissions: boolean;
  joined_at: string;
  user_status: AdminUserStatus;
  is_platform_admin: boolean;
  last_session_at: string | null;
}

/** GET /admin/workspaces/:workspaceId/financial?from&to */
export type AdminWorkspaceFinancial = {
  workspace: AdminWorkspaceRef;
  period: AdminDateRange;
  figures: AdminFinancialFigures;
};

/** PATCH /admin/workspaces/:workspaceId — só estes campos; status NUNCA muda por aqui. */
export interface AdminWorkspaceUpdateBody {
  reason: string;
  name?: string;
  description?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  /** Tipo de conta: `brand` (padrão) ou `agency`. Agência que já tem marcas não volta a `brand` (409). */
  account_type?: "brand" | "agency";
}

export interface AdminReasonBody {
  reason: string; // 5..500
}

/** POST .../suspend | .../reactivate | .../unarchive | .../restore */
export type AdminWorkspaceTransitionBody = AdminReasonBody;

/** POST /admin/campaigns/:campaignId/delete — irreversível; exige o título da campanha digitado. */
export interface AdminCampaignDeleteBody extends AdminReasonBody {
  confirm_title: string;
}

/** POST /admin/users/:userId/delete — irreversível (anonimiza); exige o e-mail atual da conta digitado. */
export interface AdminUserDeleteBody extends AdminReasonBody {
  confirm_email: string;
}

// ─── Equipe da plataforma (papéis) ──────────────────────────────────────────

/** Papéis de `users.platform_role`. Espelha `src/common/platform-roles.ts` (um teste confere os dois). */
export const ADMIN_PLATFORM_ROLES = ['admin', 'support', 'viewer'] as const;
export type AdminPlatformRole = (typeof ADMIN_PLATFORM_ROLES)[number];

export const ADMIN_PLATFORM_PERMISSIONS = ['read', 'users.moderate', 'workspaces.moderate', 'support.manage'] as const;
export type AdminPlatformPermission = (typeof ADMIN_PLATFORM_PERMISSIONS)[number];

export interface AdminPlatformRoleInfo {
  role: AdminPlatformRole;
  label: string; // pt-BR
  description: string; // pt-BR
  permissions: AdminPlatformPermission[];
}

/** GET /admin/me — quem sou eu na equipe e o que posso (o frontend esconde o que não puder). */
export interface AdminMe {
  user_id: number;
  role: AdminPlatformRole;
  permissions: AdminPlatformPermission[];
}

export interface AdminPlatformTeamMember {
  user_id: number;
  name: string;
  email: string;
  /** Foto de perfil (URL ou caminho); ausente em API antiga. */
  photo?: string | null;
  role: AdminPlatformRole;
  status: AdminUserStatus;
}

/** GET /admin/platform-team */
export interface AdminPlatformTeam {
  roles: AdminPlatformRoleInfo[];
  members: AdminPlatformTeamMember[];
}

/** Resposta do PATCH /admin/users/:userId/platform-role. `role: null` = a pessoa saiu da equipe. */
export interface AdminPlatformRoleChange {
  user_id: number;
  role: AdminPlatformRole | null;
  previous_role: AdminPlatformRole | null;
}

/** PATCH /admin/users/:userId/platform-role — `role: null` retira o papel (volta a ser só usuário). */
export interface AdminPlatformRoleBody extends AdminReasonBody {
  role: AdminPlatformRole | null;
}

/** POST .../archive | .../delete — exigem confirmação digitada e o resumo de impacto visto pela pessoa. */
export interface AdminWorkspaceDangerBody extends AdminReasonBody {
  /** Nome do workspace, idêntico (sem diferenciar maiúsculas nas pontas). */
  confirm_name: string;
  impact_token: string;
}

/** Resposta de todas as transições e do PATCH: o workspace já no novo estado. */
export type AdminWorkspaceMutationResponse = AdminItemResponse<AdminWorkspaceDetail>;

/** Papéis que o Admin pode atribuir: 'custom' (permissões avulsas) nasce em outro fluxo e o servidor o recusa (400). */
export type AdminAssignableWorkspaceRole = Exclude<AdminWorkspaceRole, 'custom'>;

export interface AdminWorkspaceMemberAddBody extends AdminReasonBody {
  email: string;
  role: AdminAssignableWorkspaceRole;
}
export interface AdminWorkspaceMemberRoleBody extends AdminReasonBody {
  role: AdminAssignableWorkspaceRole;
}
/** POST /admin/workspaces/:id/members/:userId/remove — POST porque DELETE com corpo é descartado por proxies. */
export type AdminWorkspaceMemberRemoveBody = AdminReasonBody;

/**
 * Respostas da gestão de membros (todas 200):
 *  - POST   .../members                  -> { data: AdminWorkspaceMember }   (o membro adicionado)
 *  - PATCH  .../members/:userId          -> { data: AdminWorkspaceMember }   (já com o novo papel)
 *  - POST   .../members/:userId/remove   -> { data: AdminWorkspaceMemberRemoveResult }
 * GET .../members segue AdminListQuery com per_page padrão 100 (a lista de um workspace é curta).
 */
export interface AdminWorkspaceMemberRemoveResult {
  user_id: number;
  removed: true;
}

// ─── Resumo de impacto (GET /admin/workspaces/:workspaceId/impact) ──────────

export const WORKSPACE_DELETE_BLOCKER_CODES = [
  'HAS_CUSTODY_BALANCE', // workspace_balances.balance_cents > 0
  'HAS_COMMITTED_FUNDS', // committed_cents > 0 ou reservas de criador em aberto
  'HAS_PENDING_CHARGES', // cobranças PIX geradas, não pagas e não expiradas
  'HAS_WITHDRAWALS_IN_FLIGHT', // saques de criadores ainda pendentes ligados a campanhas do workspace
  'HAS_PUBLISHED_CAMPAIGNS', // campanhas com status 'published'
] as const;
/** Impedimentos da exclusão de CONTA (POST /admin/users/:userId/delete). */
export const USER_DELETE_BLOCKER_CODES = [
  'IS_SOLE_WORKSPACE_OWNER', // único proprietário de um workspace que ainda existe
  'HAS_OPEN_BALANCE', // saldo do criador reservado, em carência ou disponível para saque
  'HAS_PENDING_WITHDRAWAL', // saque do criador ainda pendente
] as const;
export type AdminUserDeleteBlockerCode = (typeof USER_DELETE_BLOCKER_CODES)[number];
/** Impedimentos da exclusão de CAMPANHA (POST /admin/campaigns/:campaignId/delete). */
export const CAMPAIGN_DELETE_BLOCKER_CODES = [
  'BALANCE_ENTRIES', // lançamentos de saldo de criadores ligados à campanha
  'BALANCE_HOLDS', // valores reservados para criadores nesta campanha
] as const;
export type AdminCampaignDeleteBlockerCode = (typeof CAMPAIGN_DELETE_BLOCKER_CODES)[number];
export type AdminDeleteBlockerCode =
  | (typeof WORKSPACE_DELETE_BLOCKER_CODES)[number]
  | AdminUserDeleteBlockerCode
  | AdminCampaignDeleteBlockerCode;

export interface AdminDeleteBlocker {
  code: AdminDeleteBlockerCode;
  message: string; // pt-BR
  count?: number;
  amount_cents?: number;
}

export interface AdminWorkspaceImpact {
  workspace: AdminWorkspaceRef & { status: AdminWorkspaceStatus };
  computed_at: string;
  counts: {
    members: number;
    campaigns_total: number;
    campaigns_draft: number;
    campaigns_published: number;
    campaigns_finished: number;
    participations: number;
    creators: number;
    contracts: number;
    charges_total: number;
    charges_pending: number;
    withdrawals_in_flight: number;
    ledger_entries: Record<string, number>; // por status: reserved, pending_release, available, withdrawn, cancelled
  };
  money: {
    custody_cents: number;
    committed_cents: number;
    funded_total_cents: number;
    pending_charges_cents: number;
    reserved_entries_cents: number;
    released_not_withdrawn_cents: number;
    withdrawals_in_flight_cents: number;
  };
  /** Impedem a exclusão. O Admin não consegue passar por cima: resolve antes (ou arquiva). */
  blockers: AdminDeleteBlocker[];
  /** Não impedem, mas a pessoa precisa saber (ex.: saldo de criadores em carência). */
  warnings: { code: string; message: string }[];
  /** O que cada ação faz, em linguagem de produto, para o diálogo de confirmação. */
  consequences: {
    suspend: string[];
    archive: string[];
    delete: string[];
  };
  can: { delete: boolean };
  /** Assina {workspace, estado, contagens, dinheiro}. Dura 10 minutos; o servidor recalcula e compara. */
  impact_token: string;
  impact_token_expires_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Usuários
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/users — padrão: usuários de marca (brand, agency, admin); criadores ficam em /admin/creators. */
export interface AdminUserListQuery extends AdminListQuery {
  /** CSV de AdminUserStatus ou 'all'. Padrão: 'active,suspended'. */
  status?: string;
  /** Padrão: 'brand' (types 20, 30, 100). */
  kind?: 'brand' | 'creator' | 'all';
  workspace_id?: string; // public_id
  created_from?: string;
  created_to?: string;
  sort_by?: 'created_at' | 'name' | 'last_session';
}

export interface AdminUserWorkspaceLink {
  workspace: AdminWorkspaceRef;
  workspace_status: AdminWorkspaceStatus;
  role: AdminWorkspaceRole;
  has_custom_permissions: boolean;
  joined_at: string;
}

/** Nível de confiança da conta: 1 = muito provável bot/atacante · 2 = suspeito · 3 = incerto · 4 = provável pessoa real · 5 = perfil real. */
export type AdminUserTrustLevel = 1 | 2 | 3 | 4 | 5;

/** Um sinal que pesou no nível (positivo soma pontos, negativo tira). Do maior peso para o menor. */
export interface AdminUserTrustReason {
  code: string;
  /** Texto pronto para a tela, em português. */
  label: string;
  effect: 'positive' | 'negative';
  points: number;
}

/**
 * Estimativa automática (por sinais, não uma prova) de que a conta é de uma pessoa real. Serve para a equipe priorizar
 * o que olhar e NUNCA suspende nada sozinha. `null` na conta excluída ou quando o cálculo falhou na hora.
 */
export interface AdminUserTrust {
  level: AdminUserTrustLevel;
  /** 0 a 100. */
  score: number;
  reasons: AdminUserTrustReason[];
}

export interface AdminUserListItem {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  kind: AdminUserKind;
  status: AdminUserStatus;
  is_platform_admin: boolean;
  created_at: string;
  /** Aproximação (±5 min): maior last_used_at das sessões. null após sair/sem sessão. */
  last_session_at: string | null;
  workspaces_count: number;
  /** Até 5 vínculos, o resto vem no detalhe. */
  workspaces: AdminUserWorkspaceLink[];
  /** Nível de confiança da conta; `null` (ou ausente) quando não há cálculo. */
  trust?: AdminUserTrust | null;
}

export type AdminUserListResponse = AdminListResponse<AdminUserListItem>;

/** GET /admin/users/:userId */
export interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  phone: string | null;
  /** Documento mascarado (só os 2 últimos dígitos). */
  document_masked: string | null;
  photo: string | null;
  kind: AdminUserKind;
  status: AdminUserStatus;
  is_platform_admin: boolean;
  created_at: string;
  suspension: {
    suspended_at: string;
    reason: string | null;
    suspended_by: AdminUserRef | null;
  } | null;
  deleted_at: string | null;
  workspaces: AdminUserWorkspaceLink[];
  sessions: {
    active_count: number;
    last_used_at: string | null;
    /** 'backoffice' | 'mobile-app' */
    clients: string[];
  };
  /** Nível de confiança da conta; `null` (ou ausente) quando não há cálculo. */
  trust?: AdminUserTrust | null;
}

/** POST /admin/users/:userId/suspend | /reactivate | /revoke-sessions */
export type AdminUserActionBody = AdminReasonBody;

export type AdminUserMutationResponse = AdminItemResponse<AdminUserDetail>;

// ═══════════════════════════════════════════════════════════════════════════
// 6. Campanhas (visão global)
// ═══════════════════════════════════════════════════════════════════════════

export type AdminCampaignStatus = 'draft' | 'published' | 'finished';

/** GET /admin/campaigns e GET /admin/workspaces/:workspaceId/campaigns (este fixa o workspace). */
export interface AdminCampaignListQuery extends AdminListQuery {
  /** CSV de AdminCampaignStatus. Padrão: todos. */
  status?: string;
  workspace_id?: string; // public_id
  payment_method?: string;
  created_from?: string;
  created_to?: string;
  sort_by?: 'created_at' | 'title' | 'creators' | 'committed' | 'released';
}

export interface AdminCampaignListItem {
  id: string; // public_id
  title: string;
  banner: string | null;
  status: AdminCampaignStatus;
  payment_method: string;
  created_at: string;
  workspace: AdminWorkspaceRef & { status: AdminWorkspaceStatus };
  /** Não existe "responsável pela campanha" no banco: este é o dono do workspace. */
  workspace_owner: AdminWorkspaceOwner | null;
  max_influencers: number;
  participants: {
    /** Todas as participações. */
    total: number;
    /** Em andamento (os 14 estados ativos da regra de capacidade). */
    participating: number;
  };
  /** Conteúdos com status 'published'. */
  deliveries_published: number;
  /** Participações aguardando ação do time do cliente (roteiro/conteúdo/participante pendentes). */
  pending_actions: number;
  /** Reservas em aberto (influencer_balance_entries.status = 'reserved'). Não é pagamento. */
  committed_cents: number;
  /** Liberado a criadores (pending_release + available + withdrawn). Não é "pago via PIX". */
  released_cents: number;
  /** Não existe orçamento no banco; `committed_cents` é o substituto honesto. */
  budget: AdminFigure;
}

export type AdminCampaignListResponse = AdminListResponse<AdminCampaignListItem>;

/** GET /admin/campaigns/:campaignId */
export interface AdminCampaignDetail extends AdminCampaignListItem {
  description: string;
  objective: string;
  registration_deadline: string | null;
  mural_active: boolean;
  steps: { order: number; objective: string; publish_date: string | null }[];
  participations_by_status: Record<string, number>;
  figures: {
    committed: AdminFigure;
    released: AdminFigure;
    paid_pix: AdminFigure;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Criadores (visão global, somente leitura)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * complete    tem os dados mínimos de cadastro
 * incomplete  faltam dados (ver `missing`); é sugestão de atenção, não erro
 * stub        conta externa criada por convite, nunca assumida pela pessoa (users.is_external)
 */
export type AdminCreatorRegistrationState = 'complete' | 'incomplete' | 'stub';

export interface AdminCreatorListQuery extends AdminListQuery {
  /** Rede social: 'instagram' | 'tiktok' | 'youtube' | ... */
  network?: string;
  registration?: AdminCreatorRegistrationState | 'all';
  min_followers?: number;
  created_from?: string;
  created_to?: string;
  sort_by?: 'created_at' | 'followers' | 'campaigns' | 'name';
}

/** `type` é uma rede social real (instagram, instagram_facebook, tiktok, youtube). UGC NÃO é rede social: nunca vem aqui. */
export interface AdminCreatorNetwork {
  type: string;
  username: string;
  followers: number;
  disabled: boolean;
}

export interface AdminCreatorListItem {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  status: AdminUserStatus;
  created_at: string;
  registration: {
    state: AdminCreatorRegistrationState;
    flags: {
      email_verified: boolean;
      phone_verified: boolean;
      has_photo: boolean;
      has_document: boolean;
      has_birth_date: boolean;
      has_gender: boolean;
      has_address: boolean;
      has_niche: boolean;
      has_active_network: boolean;
      is_external: boolean;
    };
    /** Rótulos pt-BR do que falta. */
    missing: string[];
  };
  networks: AdminCreatorNetwork[];
  /** Soma dos seguidores das redes ativas (UGC não é rede e não entra). */
  followers_total: number;
  /** Tem conta do tipo de conteúdo UGC (que não é uma rede social). */
  has_ugc: boolean;
  campaigns_count: number;
  /**
   * Não existe "workspace de origem": todo criador tem um workspace pessoal. Isto é a PRIMEIRA campanha em que
   * participou ("derived"); null se nunca participou.
   */
  first_campaign: {
    workspace: AdminWorkspaceRef;
    campaign: { id: string; title: string };
    at: string;
  } | null;
}

export type AdminCreatorListResponse = AdminListResponse<AdminCreatorListItem>;

export interface AdminDuplicatesQuery extends AdminListQuery {
  reason?: AdminDuplicateReason;
  confidence?: 'high' | 'possible';
}

export type AdminDuplicateReason =
  | 'email'
  | 'phone'
  | 'document'
  | 'social_handle'
  | 'identity_conflict';

/** GET /admin/creators/duplicates — só LEITURA. Nada é fundido nem alterado automaticamente. */
export interface AdminDuplicateGroup {
  key: string;
  reason: AdminDuplicateReason;
  /** 'high' = valor idêntico normalizado; 'possible' = parecido/sinal indireto. */
  confidence: 'high' | 'possible';
  /** Valor em comum, mascarado (e-mail e telefone parciais). */
  match_masked: string;
  users: {
    id: number;
    name: string;
    email_masked: string;
    created_at: string;
    is_external: boolean;
    networks_count: number;
    campaigns_count: number;
  }[];
}

export type AdminDuplicatesResponse = AdminListResponse<AdminDuplicateGroup>;

/** GET /admin/creators/inconsistencies — só LEITURA. */
export interface AdminInconsistency {
  code: string;
  /** 'alert' = fato objetivo armazenado; 'suggestion' = heurística. */
  kind: AdminAlertKind;
  title: string;
  description: string;
  count: number;
  samples: { type: string; id: string | number; label: string }[];
}

export interface AdminInconsistenciesResponse {
  data: AdminInconsistency[];
  meta: { computed_at: string };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Financeiro
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Conjunto de números financeiros — o mesmo formato no global e por workspace.
 * "Pago" NÃO é "liberado": liberado = o valor foi para o saldo do criador; pago = o PIX foi concluído.
 */
export interface AdminFinancialFigures {
  /** realized — soma de asaas_charges pagas, todo o histórico. */
  funded_total: AdminFigure;
  /** realized — cobranças pagas no período. */
  funded_in_period: AdminFigure;
  /** stock — SUM(workspace_balances.balance_cents). O comprometido é um subconjunto, NÃO se soma a isso. */
  custody: AdminFigure;
  /** committed — SUM(committed_cents): parte da custódia travada em reservas de criadores. */
  committed: AdminFigure;
  /** derived — custody - committed. */
  free_balance: AdminFigure;
  /** stock — entradas em carência (pending_release). */
  in_grace: AdminFigure;
  /** stock — entradas disponíveis para saque (available). */
  available_to_withdraw: AdminFigure;
  /** realized — liberado a criadores no período (por released_at). */
  released_in_period: AdminFigure;
  released_total: AdminFigure;
  /** realized — entradas 'withdrawn' cujo saque está 'paid' (influencer_withdrawals), pela data de processamento do saque (processed_at; updated_at se faltar), no período. */
  paid_pix_in_period: AdminFigure;
  paid_pix_total: AdminFigure;
  /** stock — saques solicitados e ainda pendentes. */
  withdrawals_in_flight: AdminFigure;
  /** stock — cobranças geradas, não pagas e não expiradas. */
  pending_charges: AdminFigure;
  /** unavailable — não há modelo de taxa/comissão no banco. */
  platform_revenue: AdminFigure;
}

/** GET /admin/financial/summary?from&to */
export interface AdminFinancialSummary {
  period: AdminDateRange;
  generated_at: string;
  figures: AdminFinancialFigures;
  /** Conferências entre fontes; diferença diferente de zero é sinal para investigar, não erro de tela. */
  reconciliation: {
    /** workspace_balances.committed_cents  menos  reservas (ledger) ligadas a campanhas. */
    committed_vs_reserved_drift: AdminFigure;
    /** Reservas sem campanha (campaign_id nulo): não atribuíveis a nenhum workspace. */
    unattributed_reserved: AdminFigure;
  };
}

export type AdminMovementType = 'charge' | 'ledger_entry' | 'withdrawal' | 'transfer';

export interface AdminFinancialMovementsQuery {
  workspace_id?: string; // public_id
  type?: AdminMovementType | 'all';
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number; // máx 100, padrão 50
}

/**
 * GET /admin/financial/movements — feed por cursor, mais recentes primeiro.
 *
 * Regras (iguais no backend e nas telas):
 *  - occurred_at: charge = pago em (ou criado em, se não pago); ledger_entry, withdrawal e transfer = criado em.
 *  - direction: charge = in; withdrawal e transfer = out; ledger_entry = internal.
 *  - kind: charge paga = realized, pendente = stock, expirada/cancelada = derived; ledger_entry reservada =
 *    committed, sacada = realized, cancelada = derived, as demais = stock; withdrawal paga/transfer concluída =
 *    realized, as demais = stock.
 *  - workspace: o da cobrança; para ledger_entry, o da campanha (null se sem campanha); saque e transferência
 *    herdam o das entradas sacadas (null quando não há como atribuir).
 */
export interface AdminFinancialMovement {
  /** 'charge:<public_id>' | 'entry:<public_id>' | 'withdrawal:<id>' | 'transfer:<id>' */
  id: string;
  occurred_at: string;
  type: AdminMovementType;
  /** in = entrou na plataforma; out = saiu; internal = só mudou de bolso. */
  direction: 'in' | 'out' | 'internal';
  /** Estado cru do registro de origem. */
  status: string;
  status_label: string;
  amount_cents: number;
  kind: AdminFigureKind;
  /** null = não atribuído a nenhum workspace (ex.: lançamento manual, campanha removida). */
  workspace: AdminWorkspaceRef | null;
  campaign: { id: string; title: string } | null;
  /** Criador beneficiado, quando houver. */
  user: AdminUserRef | null;
  /** O registro que originou o valor, para rastrear. */
  origin: {
    type: 'asaas_charge' | 'balance_entry' | 'withdrawal' | 'asaas_transfer';
    id: string;
    external_id: string | null;
  };
  description: string | null;
}

export type AdminFinancialMovementsResponse = AdminFeedResponse<AdminFinancialMovement>;

/** GET /admin/financial/by-workspace */
export interface AdminFinancialByWorkspaceQuery extends AdminListQuery {
  from?: string;
  to?: string;
  sort_by?: 'funded' | 'custody' | 'committed' | 'released' | 'name';
}

export interface AdminFinancialByWorkspaceRow {
  /** null = a linha "não atribuído" (valores sem workspace). */
  workspace: AdminWorkspaceRef | null;
  funded_cents: number;
  custody_cents: number;
  committed_cents: number;
  released_cents: number;
  paid_pix_cents: number;
}

export type AdminFinancialByWorkspaceResponse = AdminListResponse<AdminFinancialByWorkspaceRow>;

// ═══════════════════════════════════════════════════════════════════════════
// 9. Visão geral (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/overview?from&to
 *
 * `kind` de cada número: totais e posições de agora = 'stock'; ativos/inativos (status + janela de atividade) =
 * 'derived'; "novos no período" e "criadas no período" = 'realized'; sessão recente = 'proxy'; trial e receita =
 * 'unavailable'. `users.*` conta usuários de MARCA (users.type 20, 30, 100, não excluídos), inclusive
 * `suspended`; criadores aparecem em `creators` e em `users.creators_total`.
 */
export interface AdminOverview {
  period: AdminDateRange;
  generated_at: string;
  activity_window_days: number;
  workspaces: {
    /** Clientes: workspaces de marca não excluídos (ativo + suspenso + arquivado). */
    total: AdminFigure;
    /** status 'active' COM atividade real na janela. */
    active: AdminFigure;
    /** status 'active' SEM atividade real na janela (inclui quem nunca teve). */
    inactive: AdminFigure;
    suspended: AdminFigure;
    archived: AdminFigure;
    new_in_period: AdminFigure;
    /** unavailable — não existe conceito de teste/plano no banco. */
    trial: AdminFigure;
  };
  users: {
    brand_total: AdminFigure;
    brand_new_in_period: AdminFigure;
    suspended: AdminFigure;
    /** proxy — com sessão usada na janela. */
    recent_session: AdminFigure;
    creators_total: AdminFigure;
  };
  campaigns: {
    total: AdminFigure;
    published: AdminFigure;
    finished: AdminFigure;
    draft: AdminFigure;
    created_in_period: AdminFigure;
  };
  creators: {
    total: AdminFigure;
    new_in_period: AdminFigure;
  };
  financial: Pick<
    AdminFinancialFigures,
    | 'funded_in_period'
    | 'custody'
    | 'committed'
    | 'released_in_period'
    | 'paid_pix_in_period'
    | 'pending_charges'
    | 'platform_revenue'
  >;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. Atividade e auditoria
// ═══════════════════════════════════════════════════════════════════════════

export const ADMIN_ACTION_CODES = [
  'workspace.update',
  'workspace.suspend',
  'workspace.reactivate',
  'workspace.archive',
  'workspace.unarchive',
  'workspace.delete',
  'workspace.restore',
  /** O próprio cliente excluiu o workspace pelo app (agora lógico). */
  'workspace.delete_by_tenant',
  /** O cliente pediu a troca do tipo de conta (marca/agência). */
  'workspace.account_type.request',
  /** O Admin aprovou o pedido: o tipo de conta mudou. */
  'workspace.account_type.approve',
  /** O Admin rejeitou o pedido: o tipo de conta continua o mesmo. */
  'workspace.account_type.reject',
  'workspace.member.add',
  'workspace.member.role_change',
  'workspace.member.remove',
  'user.suspend',
  'user.reactivate',
  'user.sessions_revoke',
  'user.merge',
  /** Exclusão (anonimização LGPD) de conta de usuário ou criador pelo Admin. */
  'user.delete',
  /** Papel da equipe da plataforma concedido, trocado ou retirado (`users.platform_role`). */
  'user.platform_role_change',
  /** Operações de dinheiro feitas por administrador da plataforma (rotas de saldo): sempre com registro. */
  'balance.manual_credit',
  'balance.topup',
  'balance.simulate_payment',
] as const;
export type AdminActionCode = (typeof ADMIN_ACTION_CODES)[number];

/** GET /admin/audit-log — leitura de platform_admin_action_log. */
export interface AdminAuditLogQuery extends AdminListQuery {
  target_type?: 'workspace' | 'user' | 'workspace_member' | 'campaign';
  target_id?: string;
  workspace_id?: string; // public_id
  actor_user_id?: number;
  action?: AdminActionCode;
  from?: string;
  to?: string;
}

/**
 * Convenção do alvo: workspace -> id é o public_id (uuid); user -> id numérico; workspace_member -> id é o id
 * numérico do usuário afetado e `workspace` indica o workspace do vínculo.
 */
export interface AdminAuditLogEntry {
  id: number;
  created_at: string;
  action: AdminActionCode;
  action_label: string;
  actor: { user_id: number | null; name: string | null; email: string | null; role: string };
  target: { type: string; id: string; label: string | null };
  workspace: AdminWorkspaceRef | null;
  reason: string;
  before_state: unknown | null;
  after_state: unknown | null;
  impact: unknown | null;
  ip: string | null;
}

export type AdminAuditLogResponse = AdminListResponse<AdminAuditLogEntry>;

export type AdminActivityKind =
  | 'admin_action'
  | 'workspace_created'
  | 'campaign_created'
  | 'charge_paid'
  | 'member_joined'
  | 'withdrawal_paid';

/**
 * GET /admin/activity e GET /admin/workspaces/:workspaceId/activity — feed por cursor.
 * Mistura as ações administrativas (fonte: log) com fatos que o sistema já guarda (fonte: derived).
 * Não é um log completo de tudo que acontece: só os tipos acima.
 */
export interface AdminActivityEvent {
  /** Estável: 'action:<id>' | 'workspace:<public_id>' | 'campaign:<public_id>' | 'charge:<public_id>' | ... */
  id: string;
  occurred_at: string;
  kind: AdminActivityKind;
  source: 'platform_admin_action_log' | 'derived';
  /** Frase curta pt-BR, pronta para a linha do tempo. */
  title: string;
  actor: AdminUserRef | null;
  workspace: AdminWorkspaceRef | null;
  target: { type: string; id: string; label: string | null } | null;
  /** Para admin_action: motivo informado. */
  reason: string | null;
}

export interface AdminActivityQuery {
  workspace_id?: string; // só no endpoint global
  kind?: AdminActivityKind;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number; // máx 100, padrão 50
}

export type AdminActivityResponse = AdminFeedResponse<AdminActivityEvent>;

// ═══════════════════════════════════════════════════════════════════════════
// 11. Monitoramento e saúde
// ═══════════════════════════════════════════════════════════════════════════

/**
 * alert       fato objetivo armazenado (cobrança vencida, saque travado, job morto). Tem predicado exato.
 * suggestion  heurística com limite escolhido por produto (inatividade, cadastro incompleto). Mostra o limite.
 */
export type AdminAlertKind = 'alert' | 'suggestion';
export type AdminAlertSeverity = 'critical' | 'warning' | 'info';

export interface AdminAlert {
  id: string;
  code: string;
  kind: AdminAlertKind;
  severity: AdminAlertSeverity;
  title: string;
  description: string;
  /** A regra exata, com os limites usados. Sempre presente. */
  rule: string;
  /** Tabelas/colunas de onde o fato vem. */
  source: string;
  count: number;
  /** Até 5 exemplos; só nomes/identificadores públicos, sem e-mail nem dado pessoal. */
  samples: { type: string; id: string | number; label: string; detail?: string }[];
  /** Para onde o botão "ver todos" leva: ROTA DA TELA (ex.: '/admin/workspaces'), não caminho da API. */
  link: { path: string; query?: Record<string, string> } | null;
}

export interface AdminAlertsQuery {
  kind?: AdminAlertKind;
  severity?: AdminAlertSeverity;
}

/** GET /admin/health/alerts */
export interface AdminAlertsResponse {
  data: AdminAlert[];
  meta: { computed_at: string };
}

/** GET /admin/health/system */
export interface AdminSystemHealth {
  checked_at: string;
  database: { status: 'ok' | 'down'; latency_ms: number | null };
  redis: { status: 'ok' | 'down' | 'disabled'; latency_ms: number | null };
  metrics_snapshot: { last_computed_at: string | null; age_hours: number | null };
  /** Não há registro de execução dos jobs agendados; não inventamos. */
  scheduled_jobs: AdminFigure;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. Tabela de endpoints
// ═══════════════════════════════════════════════════════════════════════════

/** Caminhos sob /api/backoffice. Um teste de conformidade confere os controllers contra esta tabela. */
export const ADMIN_ENDPOINTS = [
  { key: 'overview', method: 'GET', path: '/admin/overview' },
  { key: 'workspaces.list', method: 'GET', path: '/admin/workspaces' },
  { key: 'workspaces.detail', method: 'GET', path: '/admin/workspaces/:workspaceId' },
  { key: 'workspaces.members', method: 'GET', path: '/admin/workspaces/:workspaceId/members' },
  { key: 'workspaces.campaigns', method: 'GET', path: '/admin/workspaces/:workspaceId/campaigns' },
  { key: 'workspaces.financial', method: 'GET', path: '/admin/workspaces/:workspaceId/financial' },
  { key: 'workspaces.activity', method: 'GET', path: '/admin/workspaces/:workspaceId/activity' },
  { key: 'workspaces.impact', method: 'GET', path: '/admin/workspaces/:workspaceId/impact' },
  { key: 'workspaces.update', method: 'PATCH', path: '/admin/workspaces/:workspaceId' },
  { key: 'workspaces.suspend', method: 'POST', path: '/admin/workspaces/:workspaceId/suspend' },
  { key: 'workspaces.reactivate', method: 'POST', path: '/admin/workspaces/:workspaceId/reactivate' },
  { key: 'workspaces.archive', method: 'POST', path: '/admin/workspaces/:workspaceId/archive' },
  { key: 'workspaces.unarchive', method: 'POST', path: '/admin/workspaces/:workspaceId/unarchive' },
  { key: 'workspaces.delete', method: 'POST', path: '/admin/workspaces/:workspaceId/delete' },
  { key: 'workspaces.restore', method: 'POST', path: '/admin/workspaces/:workspaceId/restore' },
  { key: 'workspaces.members.add', method: 'POST', path: '/admin/workspaces/:workspaceId/members' },
  { key: 'workspaces.members.role', method: 'PATCH', path: '/admin/workspaces/:workspaceId/members/:userId' },
  { key: 'workspaces.members.remove', method: 'POST', path: '/admin/workspaces/:workspaceId/members/:userId/remove' },
  { key: 'users.list', method: 'GET', path: '/admin/users' },
  { key: 'users.detail', method: 'GET', path: '/admin/users/:userId' },
  { key: 'users.suspend', method: 'POST', path: '/admin/users/:userId/suspend' },
  { key: 'users.reactivate', method: 'POST', path: '/admin/users/:userId/reactivate' },
  { key: 'users.revokeSessions', method: 'POST', path: '/admin/users/:userId/revoke-sessions' },
  { key: 'users.delete', method: 'POST', path: '/admin/users/:userId/delete' },
  { key: 'team.me', method: 'GET', path: '/admin/me' },
  { key: 'team.list', method: 'GET', path: '/admin/platform-team' },
  { key: 'team.setRole', method: 'PATCH', path: '/admin/users/:userId/platform-role' },
  { key: 'users.merge', method: 'POST', path: '/admin/users/:duplicateId/merge-into/:survivorId' },
  { key: 'campaigns.list', method: 'GET', path: '/admin/campaigns' },
  { key: 'campaigns.detail', method: 'GET', path: '/admin/campaigns/:campaignId' },
  { key: 'creators.list', method: 'GET', path: '/admin/creators' },
  { key: 'creators.duplicates', method: 'GET', path: '/admin/creators/duplicates' },
  { key: 'creators.inconsistencies', method: 'GET', path: '/admin/creators/inconsistencies' },
  { key: 'financial.summary', method: 'GET', path: '/admin/financial/summary' },
  { key: 'financial.movements', method: 'GET', path: '/admin/financial/movements' },
  { key: 'financial.byWorkspace', method: 'GET', path: '/admin/financial/by-workspace' },
  { key: 'audit.list', method: 'GET', path: '/admin/audit-log' },
  { key: 'activity.feed', method: 'GET', path: '/admin/activity' },
  { key: 'health.alerts', method: 'GET', path: '/admin/health/alerts' },
  { key: 'health.system', method: 'GET', path: '/admin/health/system' },
] as const;
export type AdminEndpointKey = (typeof ADMIN_ENDPOINTS)[number]['key'];
