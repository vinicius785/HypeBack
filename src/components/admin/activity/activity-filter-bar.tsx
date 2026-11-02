import { AdminFilterBar, type AdminFilterDef } from "@/components/admin/platform";
import { AdminWorkspacePicker } from "@/components/admin/users/admin-workspace-picker";
import type { AdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import { ADMIN_ACTION_CODES } from "@/shared/admin-platform.types";

import {
  ACTIVITY_KINDS,
  AUDIT_TARGET_TYPES,
  type ActivityFilterKey,
  type ActivityFilters,
  type ActivityTab,
} from "./activity-search";
import { AuditActorPicker } from "./audit-actor-picker";
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_LABEL } from "./audit-labels";

const KIND_FILTER: AdminFilterDef = {
  kind: "select",
  key: "kind",
  label: "Tipo",
  options: [{ value: "", label: "Todos" }, ...ACTIVITY_KINDS.map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABEL[kind] }))],
};

const ACTION_FILTER: AdminFilterDef = {
  kind: "select",
  key: "action",
  label: "Ação",
  options: [{ value: "", label: "Todas" }, ...ADMIN_ACTION_CODES.map((code) => ({ value: code, label: AUDIT_ACTION_LABEL[code] }))],
};

const TARGET_TYPE_FILTER: AdminFilterDef = {
  kind: "select",
  key: "target_type",
  label: "Alvo",
  options: [{ value: "", label: "Todos" }, ...AUDIT_TARGET_TYPES.map((type) => ({ value: type, label: AUDIT_TARGET_LABEL[type] }))],
};

/** Chaves de filtro de cada visão (o que "Limpar filtros" zera). O período é de ambas e tem o seu próprio seletor. */
const FILTER_KEYS: Record<ActivityTab, readonly ActivityFilterKey[]> = {
  feed: ["kind", "workspace_id"],
  changes: ["action", "target_type", "target_id", "actor_user_id", "workspace_id"],
};

/** Quantos filtros (fora o período) a visão tem ligados. */
export function activeActivityFilterCount(tab: ActivityTab, filters: ActivityFilters): number {
  const byKey: Record<ActivityFilterKey, string> = {
    workspace_id: filters.workspaceId,
    kind: filters.kind,
    action: filters.action,
    target_type: filters.targetType,
    target_id: filters.targetId,
    actor_user_id: filters.actorUserId,
  };
  return FILTER_KEYS[tab].filter((key) => byKey[key] !== "").length;
}

/** Zera os filtros da visão (numa só navegação). */
export function clearActivityFilters(tab: ActivityTab, state: Pick<AdminListQueryState<ActivityFilterKey>, "setFilters">): void {
  state.setFilters(Object.fromEntries(FILTER_KEYS[tab].map((key) => [key, ""])) as Partial<Record<ActivityFilterKey, string>>);
}

interface ActivityFilterBarProps {
  tab: ActivityTab;
  filters: ActivityFilters;
  state: Pick<AdminListQueryState<ActivityFilterKey>, "setFilter" | "setFilters">;
}

/**
 * Filtros de cada visão das Atividades, todos enviados à API: tipo de evento (linha do tempo); ação, tipo de alvo,
 * autor e alvo específico (alterações administrativas); workspace nas duas. O alvo específico (`target_id`) só
 * entra na barra quando a URL o traz (link de outra tela): aparece como filtro ativo e some com o "×".
 */
export function ActivityFilterBar({ tab, filters, state }: ActivityFilterBarProps) {
  const defs: AdminFilterDef[] = [];
  const values: Record<string, string> = {};

  if (tab === "feed") {
    defs.push(KIND_FILTER);
    values.kind = filters.kind;
  } else {
    defs.push(ACTION_FILTER, TARGET_TYPE_FILTER);
    values.action = filters.action;
    values.target_type = filters.targetType;
    if (filters.targetId) {
      defs.push({
        kind: "select",
        key: "target_id",
        label: "Registro",
        options: [
          { value: "", label: "Todos" },
          { value: filters.targetId, label: filters.targetId },
        ],
      });
      values.target_id = filters.targetId;
    }
  }

  return (
    <AdminFilterBar
      filters={defs}
      values={values}
      onChange={(patch) => state.setFilters(patch as Partial<Record<ActivityFilterKey, string>>)}
      onClear={() => clearActivityFilters(tab, state)}
      search={
        <>
          <AdminWorkspacePicker
            label="Workspace"
            placeholder="Todos"
            value={filters.workspaceId || null}
            onChange={(workspace) => state.setFilter("workspace_id", workspace?.id ?? "")}
          />
          {tab === "changes" ? (
            <AuditActorPicker value={filters.actorUserId} onChange={(userId) => state.setFilter("actor_user_id", userId)} />
          ) : null}
        </>
      }
    />
  );
}
