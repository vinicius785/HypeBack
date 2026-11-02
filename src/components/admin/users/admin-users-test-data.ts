/**
 * Dados de teste de Usuários, tipados pelo contrato (`src/shared/admin-platform.types.ts`): se o contrato mudar,
 * o TypeScript acusa aqui. Só os testes importam este arquivo.
 */
import type { AdminListResult } from "@/lib/admin/admin-client";
import type {
  AdminAuditLogEntry,
  AdminPageMeta,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserWorkspaceLink,
  AdminWorkspaceListItem,
} from "@/shared/admin-platform.types";

/** O "agora" dos testes (mesmo relógio do mock do Admin). */
export const NOW_ISO = "2026-10-31T15:00:00.000Z";
export const NOW = Date.parse(NOW_ISO);

/** Instante `ms` antes do "agora" dos testes. */
export function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const WS_CAFE = "7a1e0000-0000-4000-8000-000000000002";
export const WS_LUME = "7a1e0000-0000-4000-8000-000000000003";
export const WS_AURORA = "7a1e0000-0000-4000-8000-000000000004";
export const WS_BELA = "7a1e0000-0000-4000-8000-000000000005";

export function makeLink(over: Partial<AdminUserWorkspaceLink> = {}): AdminUserWorkspaceLink {
  return {
    workspace: { id: WS_CAFE, name: "Café Serra Verde" },
    workspace_status: "active",
    role: "owner",
    has_custom_permissions: false,
    joined_at: "2025-03-10T12:00:00.000Z",
    ...over,
  };
}

export function makeUserListItem(over: Partial<AdminUserListItem> = {}): AdminUserListItem {
  const workspaces = over.workspaces ?? [makeLink()];
  return {
    id: 9,
    name: "Bernardo Medeiros Moraes",
    email: "bernardo@cafeserraverde.com.br",
    photo: null,
    kind: "brand",
    status: "active",
    is_platform_admin: false,
    created_at: "2025-03-10T12:00:00.000Z",
    last_session_at: ago(3 * HOUR),
    workspaces_count: workspaces.length,
    workspaces,
    ...over,
  };
}

export function makeUserDetail(over: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 9,
    name: "Bernardo Medeiros Moraes",
    email: "bernardo@cafeserraverde.com.br",
    email_verified: true,
    phone: "11987654321",
    document_masked: "***.***.***-45",
    photo: null,
    kind: "brand",
    status: "active",
    is_platform_admin: false,
    created_at: "2025-03-10T12:00:00.000Z",
    suspension: null,
    deleted_at: null,
    workspaces: [
      makeLink(),
      makeLink({
        workspace: { id: WS_LUME, name: "Studio Lume Fotografia" },
        workspace_status: "suspended",
        role: "financeiro",
        has_custom_permissions: true,
        joined_at: "2025-06-02T12:00:00.000Z",
      }),
    ],
    sessions: { active_count: 2, last_used_at: ago(3 * HOUR), clients: ["backoffice", "mobile-app"] },
    ...over,
  };
}

/** Detalhe de uma conta suspensa: sem sessão e com o bloco da suspensão. */
export function makeSuspendedDetail(over: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return makeUserDetail({
    status: "suspended",
    suspension: {
      suspended_at: "2026-10-30T13:30:00.000Z",
      reason: "Suspeita de acesso indevido à conta",
      suspended_by: { user_id: 1, name: "Marina Albuquerque" },
    },
    sessions: { active_count: 0, last_used_at: null, clients: [] },
    ...over,
  });
}

export function makeAuditEntry(over: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry {
  return {
    id: 501,
    created_at: "2026-10-30T13:30:00.000Z",
    action: "user.suspend",
    action_label: "Usuário suspenso",
    actor: { user_id: 1, name: "Marina Albuquerque", email: "marina@hype.com", role: "admin" },
    target: { type: "user", id: "9", label: "Bernardo Medeiros Moraes" },
    workspace: null,
    reason: "Suspeita de acesso indevido à conta",
    before_state: { status: "active" },
    after_state: { status: "suspended" },
    impact: null,
    ip: "203.0.113.10",
    ...over,
  };
}

export function makeWorkspaceItem(over: Partial<AdminWorkspaceListItem> = {}): AdminWorkspaceListItem {
  return {
    id: WS_CAFE,
    name: "Café Serra Verde",
    photo: null,
    tax_id: null,
    kind: "brand",
    status: "active",
    status_changed_at: null,
    owner: { user_id: 9, name: "Bernardo Medeiros Moraes", email: "bernardo@cafeserraverde.com.br" },
    owners_count: 1,
    created_at: "2025-03-10T12:00:00.000Z",
    activity: { state: "active", last_activity_at: ago(2 * DAY), window_days: 30 },
    last_session_at: null,
    members_count: 4,
    campaigns_count: 3,
    published_campaigns_count: 1,
    creators_count: 5,
    funded_cents: 1_000_000,
    custody_cents: 250_000,
    ...over,
  };
}

export function pageMeta(total: number, over: Partial<AdminPageMeta> = {}): AdminPageMeta {
  const perPage = over.per_page ?? 25;
  return { page: 1, per_page: perPage, total, total_pages: total === 0 ? 0 : Math.ceil(total / perPage), ...over };
}

export function listResult<T>(rows: T[], total = rows.length, meta: Partial<AdminPageMeta> = {}): AdminListResult<T> {
  return { data: rows, meta: pageMeta(total, meta) };
}
