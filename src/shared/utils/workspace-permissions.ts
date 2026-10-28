import type { WorkspacePermissions } from "@/shared/types";

/** Defaults permissivos quando a API não envia `permissions` (compatibilidade). */
const PERMISSIVE_DEFAULT: WorkspacePermissions = {
  workspace_read: true,
  workspace_settings_write: true,
  workspace_delete: true,
  workspace_photo_write: true,
  members_list: true,
  members_invite: true,
  members_remove: true,
  members_remove_only_member_role: false,
  members_role_write: true,
  campaigns_read: true,
  campaigns_create: true,
  campaigns_write: true,
  campaigns_delete: true,
  campaigns_publish: true,
  influencers_read: true,
  influencers_invite: true,
  influencers_approve: true,
  influencers_reject: true,
  influencer_values_read: true,
  scripts_read: true,
  scripts_write: true,
  scripts_approve: true,
  scripts_reject: true,
  content_read: true,
  content_write: true,
  content_approve: true,
  content_reject: true,
  contracts_read: true,
  contracts_write: true,
  community_lives_read: true,
  community_lives_write: true,
  financial_read: false,
  financial_balance_add: false,
  financial_payments_approve: false,
  financial_reports_export: false,
  catalog_read: true,
  catalog_write: true,
  billing_read: false,
  billing_write: false,
};

const PERMISSION_KEYS = new Set<string>([
  "workspace_read", "workspace_settings_write", "workspace_delete", "workspace_photo_write",
  "members_list", "members_invite", "members_remove", "members_remove_only_member_role", "members_role_write",
  "campaigns_read", "campaigns_create", "campaigns_write", "campaigns_delete", "campaigns_publish",
  "influencers_read", "influencers_invite", "influencers_approve", "influencers_reject",
  "scripts_read", "scripts_write", "scripts_approve", "scripts_reject",
  "content_read", "content_write", "content_approve", "content_reject",
  "contracts_read", "contracts_write",
  "community_lives_read", "community_lives_write",
  "financial_read", "financial_balance_add", "financial_payments_approve", "financial_reports_export",
  "catalog_read", "catalog_write", "billing_read", "billing_write",
]);

/**
 * Converte array de strings `["campaigns_read", ...]` para objeto booleano.
 * Todas as permissões ausentes no array ficam `false`.
 */
function fromStringArray(arr: string[]): WorkspacePermissions {
  const base: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) base[key] = false;
  for (const perm of arr) {
    if (PERMISSION_KEYS.has(perm)) base[perm] = true;
  }
  // Compat aliases
  if (base.influencers_read) base.catalog_read = true;
  if (base.financial_read) base.billing_read = true;
  return base as unknown as WorkspacePermissions;
}

export function mergeWorkspacePermissions(
  raw?: Partial<WorkspacePermissions> | string[] | null,
): WorkspacePermissions {
  if (!raw) return { ...PERMISSIVE_DEFAULT };
  if (Array.isArray(raw)) return fromStringArray(raw);
  if (typeof raw !== "object") return { ...PERMISSIVE_DEFAULT };
  return { ...PERMISSIVE_DEFAULT, ...raw };
}
