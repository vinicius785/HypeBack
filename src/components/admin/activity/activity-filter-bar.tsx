import { useState, type ComponentProps } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import { AdminFilterBar, AdminRefreshButton, type AdminFilterDef } from "@/components/admin/platform";
import { AdminWorkspacePicker, useAdminWorkspaceSelection } from "@/components/admin/users/admin-workspace-picker";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_ACTIVITY_RESOURCE, ADMIN_AUDIT_RESOURCE } from "@/hooks/admin/use-admin-activity";
import type { AdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import { ADMIN_ACTION_CODES, type AdminWorkspaceRef } from "@/shared/admin-platform.types";

import {
  ACTIVITY_KINDS,
  AUDIT_TARGET_TYPES,
  type ActivityFilterKey,
  type ActivityFilters,
  type ActivityTab,
} from "./activity-search";
import { AuditActorPicker, useAuditActorSelection, type AuditActorOption } from "./audit-actor-picker";
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_LABEL } from "./audit-labels";

/** Os de uso diário ficam na linha da barra (`inline`); o resto abre em "Filtros" no celular. */
const KIND_FILTER: AdminFilterDef = {
  kind: "select",
  key: "kind",
  label: "Tipo",
  inline: true,
  options: [{ value: "", label: "Todos" }, ...ACTIVITY_KINDS.map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABEL[kind] }))],
};

const ACTION_FILTER: AdminFilterDef = {
  kind: "select",
  key: "action",
  label: "Ação",
  inline: true,
  options: [{ value: "", label: "Todas" }, ...ADMIN_ACTION_CODES.map((code) => ({ value: code, label: AUDIT_ACTION_LABEL[code] }))],
};

const TARGET_TYPE_FILTER: AdminFilterDef = {
  kind: "select",
  key: "target_type",
  label: "Alvo",
  options: [{ value: "", label: "Todos" }, ...AUDIT_TARGET_TYPES.map((type) => ({ value: type, label: AUDIT_TARGET_LABEL[type] }))],
};

/** Chaves de filtro de cada visão (o que "Limpar filtros" zera). O período é de ambas e fica no cabeçalho. */
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

/** "Atualizar" das Atividades: refaz a linha do tempo e as alterações administrativas. Só o ícone, no fim da barra. */
function ActivityRefreshButton() {
  const queryClient = useQueryClient();
  const fetching =
    useIsFetching({ queryKey: adminKeys.resource(ADMIN_ACTIVITY_RESOURCE) }) + useIsFetching({ queryKey: adminKeys.resource(ADMIN_AUDIT_RESOURCE) }) > 0;
  return (
    <AdminRefreshButton
      iconOnly
      loading={fetching}
      onClick={() => {
        void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_ACTIVITY_RESOURCE) });
        void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_AUDIT_RESOURCE) });
      }}
    />
  );
}

interface ActivityFilterBarProps {
  tab: ActivityTab;
  filters: ActivityFilters;
  state: Pick<AdminListQueryState<ActivityFilterKey>, "setFilter" | "setFilters">;
  /** Seletor "Tudo na plataforma / Alterações administrativas", na mesma linha da busca e dos filtros. */
  segment?: ComponentProps<typeof AdminFilterBar>["segment"];
}

/**
 * A barra de filtros das Atividades (uma só, acima do painel da aba aberta), todos enviados à API: tipo de evento
 * (linha do tempo); ação, tipo de alvo, autor e alvo específico (alterações administrativas); workspace nas duas.
 * Workspace e autor são seletores com busca (filtros `custom` na linha da barra); tipo, ação e alvo são listas. O alvo
 * específico (`target_id`) só entra na barra quando a URL o traz (link de outra tela): aparece como filtro ativo e
 * some com o "×". "Limpar filtros" zera os filtros da visão e mantém o período.
 */
export function ActivityFilterBar({ tab, filters, state, segment }: ActivityFilterBarProps) {
  // Quem acabou de ser escolhido (workspace e autor): o chip mostra o nome já (a URL só muda um instante depois) em vez
  // de buscar o detalhe e piscar "Carregando…". Recarregada a página, só há o id e o nome vem da busca.
  const [pickedWorkspace, setPickedWorkspace] = useState<AdminWorkspaceRef | null>(null);
  const workspace = useAdminWorkspaceSelection(filters.workspaceId || null, { known: pickedWorkspace });
  const [pickedActor, setPickedActor] = useState<AuditActorOption | null>(null);
  // O autor só existe nas alterações administrativas: na linha do tempo não se busca o nome de ninguém.
  const actor = useAuditActorSelection(tab === "changes" ? filters.actorUserId || null : null, { known: pickedActor });

  const workspaceFilter: AdminFilterDef = {
    kind: "custom",
    id: "workspace",
    label: "Workspace",
    inline: true,
    summary: workspace.summary,
    onClear: () => state.setFilter("workspace_id", ""),
    render: () => (
      <AdminWorkspacePicker
        variant="filterBar"
        label="Workspace"
        placeholder="Todos"
        value={filters.workspaceId || null}
        onChange={(picked) => {
          setPickedWorkspace(picked);
          state.setFilter("workspace_id", picked?.id ?? "");
        }}
      />
    ),
  };

  const defs: AdminFilterDef[] = [workspaceFilter];
  const values: Record<string, string> = {};

  if (tab === "feed") {
    defs.push(KIND_FILTER);
    values.kind = filters.kind;
  } else {
    defs.push({
      kind: "custom",
      id: "actor",
      label: "Autor",
      inline: true,
      summary: actor.summary,
      onClear: () => state.setFilter("actor_user_id", ""),
      render: () => (
        <AuditActorPicker
          variant="filterBar"
          value={filters.actorUserId}
          onChange={(userId, person) => {
            setPickedActor(person ?? null);
            state.setFilter("actor_user_id", userId);
          }}
        />
      ),
    });
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
      segment={segment}
      compact
      filters={defs}
      values={values}
      onChange={(patch) => state.setFilters(patch as Partial<Record<ActivityFilterKey, string>>)}
      onClear={() => clearActivityFilters(tab, state)}
      trailing={<ActivityRefreshButton />}
    />
  );
}
