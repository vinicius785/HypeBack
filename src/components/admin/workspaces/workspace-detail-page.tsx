import { useState } from "react";

import {
  AdminActionMenu,
  AdminAvatar,
  AdminBadge,
  AdminErrorState,
  AdminInfoPopover,
  AdminNotFound,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
  AdminTabPanel,
  AdminTabs,
  type AdminActionMenuItem,
  type AdminCrumb,
  type AdminTabItem,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import { useAdminWorkspace } from "@/hooks/admin/use-admin-workspaces";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import type { AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { WorkspaceActivityTab } from "./workspace-activity-tab";
import { WorkspaceCampaignsTab } from "./workspace-campaigns-tab";
import {
  availableActions,
  WORKSPACE_ACTION_LABEL,
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

const LIST_LINK = { to: "/admin/workspaces" };
const LIST_CRUMB: AdminCrumb = { label: "Workspaces", to: LIST_LINK };
const TAB_PREFIX = "workspace";

/** A regra da "última atividade", no "i" do cabeçalho (o Resumo não repete a data): dois parágrafos, a regra e a janela. */
function LastActivityInfo({ windowDays }: { windowDays: number }) {
  return (
    <AdminInfoPopover label="Última atividade">
      <AdminInfoPopover.Paragraph>
        O mais recente entre campanha criada, aporte pago e criadores movimentados pelo time do cliente.
      </AdminInfoPopover.Paragraph>
      <AdminInfoPopover.Paragraph>
        O workspace está ativo quando isso aconteceu nos últimos {windowDays} dias. O updated_at do workspace não conta.
      </AdminInfoPopover.Paragraph>
    </AdminInfoPopover>
  );
}

/** Linha discreta do cabeçalho: responsável, "Cliente desde…" e a última atividade (com a regra no "i"). */
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
        <AdminBadge tone="warn" size="sm">
          Sem responsável
        </AdminBadge>
      )}
      <span title={formatDateTime(workspace.created_at)}>
        {workspace.kind === "brand" ? "Cliente desde" : "Criado em"} <b>{formatDate(workspace.created_at)}</b>
      </span>
      {last ? (
        <span title={formatDateTime(last)}>
          Última atividade <b>{formatRelativeTime(last)}</b>
          <LastActivityInfo windowDays={workspace.activity.window_days} />
        </span>
      ) : (
        <span>
          Sem atividade registrada
          <LastActivityInfo windowDays={workspace.activity.window_days} />
        </span>
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
        breadcrumb={[LIST_CRUMB, { label: "Workspace" }]}
        leading={<AdminSkeleton width={64} height={64} radius={16} />}
        title={
          <>
            <AdminSkeleton width={260} height={34} />
            <span className="adm-sr">Workspace</span>
          </>
        }
        subtitle={<AdminSkeleton width={340} height={14} />}
      />
      <span className="adm-sr" role="status">
        Carregando workspace…
      </span>
      <AdminSection>
        <AdminSkeletonLines lines={5} />
      </AdminSection>
    </AdminPage>
  );
}

/** Itens do menu "Ações": os que o estado e o papel permitem, e "Excluir" por último, separado e em vermelho. */
function lifecycleMenuItems(actions: readonly WorkspaceAction[], onSelect: (action: WorkspaceAction) => void): AdminActionMenuItem[] {
  const ordered = [...actions.filter((candidate) => candidate !== "delete"), ...actions.filter((candidate) => candidate === "delete")];
  return ordered.map((candidate) => ({
    id: candidate,
    label: WORKSPACE_ACTION_LABEL[candidate],
    tone: candidate === "delete" ? "danger" : "default",
    onSelect: () => onSelect(candidate),
  }));
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
    return (
      <AdminPage>
        <AdminPageHeader breadcrumb={[LIST_CRUMB, { label: "Workspace" }]} title="Workspace" />
        {isAdminApiError(query.error, "NOT_FOUND") ? (
          <AdminNotFound entity="workspace" backTo={LIST_LINK} backLabel="Voltar para Workspaces" />
        ) : (
          <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        )}
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
            <AdminActionMenu label="Ações" items={lifecycleMenuItems(actions, setAction)} />
          </>
        }
      />

      {lifecycle.status === "deleted" ? <DeletedNotice workspace={workspace} /> : null}

      <div className="adm-workspaces-tabs">
        <AdminTabs idPrefix={TAB_PREFIX} ariaLabel="Seções do workspace" tabs={tabs} value={tab} onChange={setTab} />
        <AdminTabPanel idPrefix={TAB_PREFIX} id="resumo" active={tab === "resumo"} className="adm-workspaces-panel">
          <WorkspaceSummaryTab workspace={workspace} onOpenTab={setTab} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="usuarios" active={tab === "usuarios"} className="adm-workspaces-panel">
          <WorkspaceMembersTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="campanhas" active={tab === "campanhas"} className="adm-workspaces-panel">
          <WorkspaceCampaignsTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="financeiro" active={tab === "financeiro"} className="adm-workspaces-panel">
          <WorkspaceFinancialTab workspace={workspace} />
        </AdminTabPanel>
        <AdminTabPanel idPrefix={TAB_PREFIX} id="atividade" active={tab === "atividade"} className="adm-workspaces-panel">
          <WorkspaceActivityTab workspace={workspace} />
        </AdminTabPanel>
      </div>

      <WorkspaceActionDialog action={action} workspace={workspace} onClose={() => setAction(null)} onSwitch={setAction} />
      <WorkspaceEditDialog open={editing} workspace={workspace} onClose={() => setEditing(false)} />
    </AdminPage>
  );
}
