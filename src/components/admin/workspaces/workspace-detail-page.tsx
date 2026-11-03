import { useState } from "react";

import {
  AdminAvatar,
  AdminErrorState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
  AdminTabPanel,
  AdminTabs,
  type AdminCrumb,
  type AdminTabItem,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import { useAdminWorkspace } from "@/hooks/admin/use-admin-workspaces";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import type { AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { WorkspaceActionsMenu } from "./workspace-actions-menu";
import { WorkspaceActivityTab } from "./workspace-activity-tab";
import { WorkspaceCampaignsTab } from "./workspace-campaigns-tab";
import {
  availableActions,
  WORKSPACE_TAB_IDS,
  WORKSPACE_TAB_LABEL,
  type WorkspaceAction,
  type WorkspaceTabId,
} from "./workspace-constants";
import { WorkspaceEditDialog } from "./workspace-edit-dialog";
import { WorkspaceFinancialTab } from "./workspace-financial-tab";
import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";

import { WorkspaceActionDialog } from "./workspace-lifecycle-dialogs";
import { WorkspaceMembersTab } from "./workspace-members-tab";
import { WorkspaceSummaryTab } from "./workspace-summary-tab";

import "@/styles/admin-workspaces.css";

const LIST_CRUMB: AdminCrumb = { label: "Workspaces", to: { to: "/admin/workspaces" } };
const TAB_PREFIX = "workspace";

/** Linha discreta do cabeçalho: responsável, "Cliente desde…" e a última atividade. */
function WorkspaceMeta({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const owner = workspace.owners[0];
  const last = workspace.activity.last_activity_at;
  return (
    <>
      {owner ? (
        <span title={owner.email}>
          Responsável <b>{owner.name}</b>
          {workspace.owners.length > 1 ? ` e mais ${workspace.owners.length - 1}` : ""}
        </span>
      ) : (
        <span className="adm-workspaces-noowner">Sem responsável</span>
      )}
      <span title={formatDateTime(workspace.created_at)}>
        {workspace.kind === "brand" ? "Cliente desde" : "Criado em"} <b>{formatDate(workspace.created_at)}</b>
      </span>
      {last ? (
        <span title={formatDateTime(last)}>
          Última atividade <b>{formatRelativeTime(last)}</b>
        </span>
      ) : (
        <span>Sem atividade registrada</span>
      )}
    </>
  );
}

/** Aviso do workspace excluído: ele abre somente para consulta. */
function DeletedNotice({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const { lifecycle } = workspace;
  const when = lifecycle.deleted_at ?? lifecycle.status_changed_at;
  return (
    <div className="adm-workspaces-notice" role="status">
      <I n="alert" />
      <div>
        <b>Este workspace foi excluído</b>
        <p>
          {when ? `Excluído em ${formatDateTime(when)}` : "Excluído"}
          {lifecycle.status_changed_by ? ` por ${lifecycle.status_changed_by.name}` : ""}.
          {lifecycle.status_reason ? ` Motivo: ${lifecycle.status_reason}` : ""} Os dados abaixo são só para consulta: dados, acesso e
          ações estão bloqueados até restaurar o workspace.
        </p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[LIST_CRUMB, { label: "Carregando…" }]}
        leading={<AdminSkeleton width={64} height={64} radius={20} />}
        title={<AdminSkeleton width={260} height={30} />}
        meta={<AdminSkeleton width={340} height={14} />}
      />
      <div role="status">
        <span className="adm-sr">Carregando o workspace…</span>
        <AdminSection>
          <AdminSkeletonLines lines={4} />
        </AdminSection>
      </div>
    </AdminPage>
  );
}

/**
 * Detalhe de um workspace: cabeçalho (nome, estado, responsável, "Editar dados" e o menu "Ações"), abas
 * com a aba na URL (`?tab=`) e os diálogos. Cada aba só consulta o servidor quando abre. Excluído abre só
 * para leitura, com aviso. O que o menu oferece vem de `detail.can` (a máquina de estados do servidor).
 */
export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const query = useAdminWorkspace(workspaceId);
  const capabilities = useAdminCapabilities();
  const [tab, setTab] = useAdminSearchParam<WorkspaceTabId>("tab", "resumo", WORKSPACE_TAB_IDS);
  const [action, setAction] = useState<WorkspaceAction | null>(null);
  const [editing, setEditing] = useState(false);
  const workspace = query.data;

  if (query.isLoading) return <DetailSkeleton />;

  if (!workspace) {
    const missing = isAdminApiError(query.error, "NOT_FOUND");
    return (
      <AdminPage>
        <AdminPageHeader breadcrumb={[LIST_CRUMB, { label: "Workspace" }]} title="Workspace" />
        <AdminErrorState
          boxed
          error={query.error}
          message={missing ? "Não encontramos este workspace. O link pode estar incorreto." : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </AdminPage>
    );
  }

  const { can, counts, lifecycle } = workspace;
  // Suporte só suspende e reativa; somente leitura não age; o administrador faz tudo (a API valida o papel).
  const actions = availableActions(can).filter(
    (candidate) =>
      capabilities.isAdmin ||
      ((candidate === "suspend" || candidate === "reactivate") && capabilities.can("workspaces.moderate")),
  );
  const tabs: AdminTabItem<WorkspaceTabId>[] = WORKSPACE_TAB_IDS.map((id) => ({
    id,
    label: WORKSPACE_TAB_LABEL[id],
    count: id === "usuarios" ? counts.members : id === "campanhas" ? counts.campaigns : undefined,
  }));

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[LIST_CRUMB, { label: workspace.name }]}
        leading={<AdminAvatar name={workspace.name} photo={workspace.photo} shape="square" size={64} />}
        title={workspace.name}
        badges={
          <>
            <AdminStatusBadge kind="workspace" value={lifecycle.status} />
            {workspace.kind !== "brand" ? <AdminStatusBadge kind="workspace-kind" value={workspace.kind} /> : null}
          </>
        }
        meta={<WorkspaceMeta workspace={workspace} />}
        actions={
          <>
            {capabilities.isAdmin ? (
              <button type="button" className="btn" disabled={!can.update} onClick={() => setEditing(true)}>
                Editar dados
              </button>
            ) : null}
            <WorkspaceActionsMenu actions={actions} onSelect={setAction} />
          </>
        }
      />

      {lifecycle.status === "deleted" ? <DeletedNotice workspace={workspace} /> : null}

      <div className="adm-workspaces-tabs">
        <AdminTabs idPrefix={TAB_PREFIX} ariaLabel="Seções do workspace" tabs={tabs} value={tab} onChange={setTab} />
        <AdminTabPanel idPrefix={TAB_PREFIX} id="resumo" active={tab === "resumo"}>
          <WorkspaceSummaryTab workspace={workspace} onOpenTab={setTab} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="usuarios" active={tab === "usuarios"}>
          <WorkspaceMembersTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="campanhas" active={tab === "campanhas"}>
          <WorkspaceCampaignsTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="financeiro" active={tab === "financeiro"}>
          <WorkspaceFinancialTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="atividade" active={tab === "atividade"}>
          <WorkspaceActivityTab workspace={workspace} />
        </AdminTabPanel>
      </div>

      <WorkspaceActionDialog action={action} workspace={workspace} onClose={() => setAction(null)} onSwitch={setAction} />
      <WorkspaceEditDialog open={editing} workspace={workspace} onClose={() => setEditing(false)} />
    </AdminPage>
  );
}
