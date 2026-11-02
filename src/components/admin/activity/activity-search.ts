/**
 * Parâmetros da URL das Atividades (`/admin/activity?tab=changes&action=workspace.suspend&from=…&to=…`).
 *
 * Os nomes são os do contrato (`workspace_id`, `kind`, `action`, `target_type`, `target_id`, `actor_user_id`,
 * `from`, `to`), então outra tela do Admin linka para cá só com o objeto de busca (ex.: "ver as alterações deste
 * usuário"). A barra de endereço é entrada de usuário: tudo é revalidado e o que não vale é descartado.
 */
import { isCivilDate } from "@/components/admin/financial/financial-period";
import { isWorkspaceId } from "@/components/admin/financial/financial-search";
import {
  createAdminListSearchValidator,
  type AdminListSearch,
  type AdminListStateConfig,
} from "@/lib/admin/list-query";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import {
  ADMIN_ACTION_CODES,
  type AdminActionCode,
  type AdminActivityKind,
  type AdminAuditLogQuery,
} from "@/shared/admin-platform.types";

export const ACTIVITY_TABS = ["feed", "changes"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export const ACTIVITY_TAB_LABEL: Record<ActivityTab, string> = {
  feed: "Atividade",
  changes: "Alterações administrativas",
};

/** Tipos de evento do feed (o `Record` de rótulos é exaustivo: tipo novo no contrato quebra a compilação). */
export const ACTIVITY_KINDS = Object.keys(ACTIVITY_KIND_LABEL) as AdminActivityKind[];

export const AUDIT_TARGET_TYPES = ["workspace", "user", "workspace_member"] as const satisfies readonly NonNullable<
  AdminAuditLogQuery["target_type"]
>[];
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const ACTIVITY_FILTER_KEYS = ["workspace_id", "kind", "action", "target_type", "target_id", "actor_user_id"] as const;
export type ActivityFilterKey = (typeof ACTIVITY_FILTER_KEYS)[number];

/** Filtros e página na URL. O período (`from`/`to`) e a aba são tratados à parte (valem para as duas visões). */
export const ACTIVITY_FILTER_CONFIG = {
  filterKeys: ACTIVITY_FILTER_KEYS,
} as const satisfies AdminListStateConfig<ActivityFilterKey>;

export function isActivityKind(value: unknown): value is AdminActivityKind {
  return typeof value === "string" && (ACTIVITY_KINDS as readonly string[]).includes(value);
}

export function isAdminActionCode(value: unknown): value is AdminActionCode {
  return typeof value === "string" && (ADMIN_ACTION_CODES as readonly string[]).includes(value);
}

export function isAuditTargetType(value: unknown): value is AuditTargetType {
  return typeof value === "string" && (AUDIT_TARGET_TYPES as readonly string[]).includes(value);
}

/** Id de usuário do contrato: inteiro maior ou igual a 1, como texto. */
export function isUserId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,14}$/.test(value);
}

/** `target_id` tem até 64 caracteres (uuid, id numérico ou `workspace:usuário`). */
export const TARGET_ID_MAX_LENGTH = 64;

export type ActivitySearch = AdminListSearch<ActivityFilterKey> & {
  tab?: Exclude<ActivityTab, "feed">;
  from?: string;
  to?: string;
};

const listValidator = createAdminListSearchValidator(ACTIVITY_FILTER_CONFIG);

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Filtros que só existem nas "Alterações administrativas": quem chega com um deles quer essa visão. */
const AUDIT_ONLY_KEYS = ["action", "target_type", "target_id", "actor_user_id"] as const;

/** Aba da URL; sem `tab`, um filtro de alteração administrativa abre as "Alterações administrativas". */
export function readActivityTab(raw: Record<string, unknown>): ActivityTab {
  const tab = text(raw.tab);
  if (tab && (ACTIVITY_TABS as readonly string[]).includes(tab)) return tab as ActivityTab;
  if (text(raw.kind) === undefined && AUDIT_ONLY_KEYS.some((key) => text(raw[key]) !== undefined)) return "changes";
  return "feed";
}

/** Valores válidos dos filtros (o resto vira texto vazio: "sem filtro"). */
export interface ActivityFilters {
  workspaceId: string;
  kind: AdminActivityKind | "";
  action: AdminActionCode | "";
  targetType: AuditTargetType | "";
  targetId: string;
  actorUserId: string;
}

export function readActivityFilters(filters: Readonly<Partial<Record<ActivityFilterKey, string>>>): ActivityFilters {
  const targetId = (filters.target_id ?? "").trim().slice(0, TARGET_ID_MAX_LENGTH);
  return {
    workspaceId: isWorkspaceId(filters.workspace_id) ? filters.workspace_id : "",
    kind: isActivityKind(filters.kind) ? filters.kind : "",
    action: isAdminActionCode(filters.action) ? filters.action : "",
    targetType: isAuditTargetType(filters.target_type) ? filters.target_type : "",
    targetId,
    actorUserId: isUserId(filters.actor_user_id) ? filters.actor_user_id : "",
  };
}

/** `validateSearch` da rota: só o que é válido e diferente do padrão. */
export function validateActivitySearch(raw: Record<string, unknown>): ActivitySearch {
  const out: ActivitySearch = { ...listValidator(raw) };
  const clean = readActivityFilters({
    workspace_id: text(raw.workspace_id),
    kind: text(raw.kind),
    action: text(raw.action),
    target_type: text(raw.target_type),
    target_id: text(raw.target_id),
    actor_user_id: text(raw.actor_user_id),
  });
  // `listValidator` deixou passar os filtros como vieram: aqui só ficam os válidos. Busca e ordenação não existem aqui.
  for (const key of ACTIVITY_FILTER_KEYS) delete out[key];
  delete out.search;
  delete out.sort_by;
  delete out.order;
  if (clean.workspaceId) out.workspace_id = clean.workspaceId;
  if (clean.kind) out.kind = clean.kind;
  if (clean.action) out.action = clean.action;
  if (clean.targetType) out.target_type = clean.targetType;
  if (clean.targetId) out.target_id = clean.targetId;
  if (clean.actorUserId) out.actor_user_id = clean.actorUserId;

  const tab = readActivityTab(raw);
  if (tab !== "feed") out.tab = tab;
  const from = text(raw.from);
  const to = text(raw.to);
  if (isCivilDate(from)) out.from = from;
  if (isCivilDate(to)) out.to = to;
  return out;
}
