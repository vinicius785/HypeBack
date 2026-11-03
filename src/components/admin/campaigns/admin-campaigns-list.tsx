import { useState, type ReactNode } from "react";

import {
  AdminEntityCell,
  AdminFilterBar,
  AdminInfoPopover,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminStatusBadge,
  AdminTable,
  type AdminFilterDef,
  type AdminFilterOption,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { AdminWorkspacePicker, useAdminWorkspaceSelection } from "@/components/admin/users/admin-workspace-picker";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { ADMIN_CAMPAIGN_LIST_CONFIG, useAdminCampaigns } from "@/hooks/admin/use-admin-campaigns";
import { formatBRLFromCents, formatDate, formatDateTime, formatInt } from "@/lib/admin/format";
import { FIGURE_KIND_HELP } from "@/lib/admin/labels";
import type { AdminCampaignListItem, AdminWorkspaceRef } from "@/shared/admin-platform.types";

import { campaignDetailLink, campaignWorkspaceLink } from "./campaign-links";
import {
  CAMPAIGN_COLUMN_DEFINITIONS,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "./campaign-labels";

import "@/styles/admin-campaigns.css";

const STATUS_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicadas" },
  { value: "finished", label: "Finalizadas" },
];

/** O texto "como é calculado" que o servidor mandou para a coluna (`meta.definitions`), ou o do contrato. */
function pickDefinition(
  definitions: Record<string, string> | undefined,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const text = definitions?.[key];
    if (text) return text;
  }
  return fallback;
}

/**
 * Nome do workspace (link) com a etiqueta do estado quando não está ativo, e o responsável dele embaixo (só o nome:
 * a coluna explica, uma vez, que é o proprietário do workspace).
 */
function WorkspaceCell({ campaign }: { campaign: AdminCampaignListItem }) {
  const { workspace, workspace_owner: owner } = campaign;
  return (
    <div className="adm-campaigns-ws">
      <span className="adm-campaigns-ws-name">
        <AdminLink to={campaignWorkspaceLink(workspace.id)} textLink title={workspace.name}>
          {workspace.name}
        </AdminLink>
        {workspace.status !== "active" ? <AdminStatusBadge kind="workspace" value={workspace.status} size="sm" /> : null}
      </span>
      {owner ? <small title={owner.email}>{owner.name}</small> : <small>Workspace sem proprietário</small>}
    </div>
  );
}

function CreatorsCell({ campaign }: { campaign: AdminCampaignListItem }) {
  const { participating, total } = campaign.participants;
  return (
    <span className="adm-num">
      <b>{formatInt(participating)}</b>
      <span className="adm-muted"> / {formatInt(total)}</span>
    </span>
  );
}

/**
 * Entregas: publicadas e pendentes, cada uma com a palavra ao lado do número. Zero fica apagado (é o "nada a fazer"),
 * mas continua sendo um zero de verdade; pendência acima de zero ganha um destaque sutil (o time do cliente precisa agir).
 */
function DeliveriesCell({ campaign }: { campaign: AdminCampaignListItem }) {
  const { deliveries_published: published, pending_actions: pending } = campaign;
  return (
    <div className="adm-campaigns-deliv adm-num">
      <span className={published === 0 ? "adm-muted" : undefined}>
        <b>{formatInt(published)}</b> {published === 1 ? "publicada" : "publicadas"}
      </span>
      <span className={pending === 0 ? "adm-muted" : undefined} data-pending={pending > 0 ? "true" : undefined}>
        <b>{formatInt(pending)}</b> {pending === 1 ? "pendente" : "pendentes"}
      </span>
    </div>
  );
}

function MoneyCell({ cents }: { cents: number }) {
  return <span className={`adm-num${cents === 0 ? " adm-muted" : ""}`}>{formatBRLFromCents(cents)}</span>;
}

/**
 * Lista global de campanhas (`/admin/campaigns`): busca, status, pagamento, workspace e período de criação, todos na
 * URL e todos enviados à API; tabela ordenável por título, criadores, comprometido, liberado e criação; paginada;
 * a linha abre o detalhe.
 *
 * Campanha não tem "dono" no banco: a coluna Workspace mostra o responsável do workspace (o proprietário), e o
 * cabeçalho da coluna diz isso. O orçamento também não existe no banco (a API devolve sempre "não apurado"): o campo
 * continua no contrato, mas não ocupa uma coluna que só diria "Não apurado" em toda linha.
 */
export function AdminCampaignsList() {
  const list = useAdminListQueryState(ADMIN_CAMPAIGN_LIST_CONFIG);
  const query = useAdminCampaigns(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const definitions = meta?.definitions;

  // O workspace escolhido: o objeto (nome) que a pessoa acabou de escolher, ou o que a URL só conhece por id; o chip
  // do filtro usa o mesmo texto da pílula, sem uma segunda consulta.
  const [pickedWorkspace, setPickedWorkspace] = useState<AdminWorkspaceRef | null>(null);
  const workspaceId = list.filters.workspace_id;
  const { summary: workspaceSummary } = useAdminWorkspaceSelection(workspaceId, { label: "Workspace", known: pickedWorkspace });

  // Um código de pagamento que veio da URL e o app não conhece ganha a sua própria opção (a pílula não mente).
  const currentPayment = list.filters.payment_method;
  const paymentOptions: AdminFilterOption[] = [
    { value: "", label: "Todos" },
    ...PAYMENT_METHOD_OPTIONS,
    ...(currentPayment && !PAYMENT_METHOD_OPTIONS.some((option) => option.value === currentPayment)
      ? [{ value: currentPayment, label: paymentMethodLabel(currentPayment) }]
      : []),
  ];

  const filters: AdminFilterDef[] = [
    {
      kind: "custom",
      id: "workspace",
      label: "Workspace",
      inline: true,
      summary: workspaceSummary,
      // "Limpar filtros" já zera `workspace_id` pelo `onClear` da barra; este é o do × do chip (e idempotente depois dele).
      onClear: () => {
        setPickedWorkspace(null);
        list.setFilter("workspace_id", "");
      },
      render: ({ label }) => (
        <AdminWorkspacePicker
          variant="filterBar"
          label={label}
          placeholder="Todos"
          value={workspaceId}
          onChange={(workspace) => {
            setPickedWorkspace(workspace);
            list.setFilter("workspace_id", workspace?.id ?? "");
          }}
        />
      ),
    },
    { kind: "select", key: "payment_method", label: "Pagamento", options: paymentOptions },
    { kind: "date-range", label: "Criada em", fromKey: "created_from", toKey: "created_to" },
  ];

  const columns: AdminTableColumn<AdminCampaignListItem>[] = [
    {
      key: "campaign",
      header: "Campanha",
      sortKey: "title",
      primary: true,
      width: "minmax(180px, 2.4fr)",
      cell: (campaign) => (
        <AdminEntityCell
          name={campaign.title}
          photo={campaign.banner}
          shape="square"
          subtitle={paymentMethodLabel(campaign.payment_method)}
        />
      ),
    },
    {
      key: "workspace",
      header: "Workspace",
      wide: true,
      width: "minmax(140px, 2fr)",
      cell: (campaign) => <WorkspaceCell campaign={campaign} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>Abaixo do nome do workspace aparece o responsável dele, que é o proprietário do workspace.</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["workspace_owner", "owner"], CAMPAIGN_COLUMN_DEFINITIONS.owner)}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      cell: (campaign) => <AdminStatusBadge kind="campaign" value={campaign.status} />,
    },
    {
      key: "creators",
      header: "Criadores",
      sortKey: "creators",
      align: "right",
      nowrap: true,
      hideBelow: "sm",
      width: "84px",
      cell: (campaign) => <CreatorsCell campaign={campaign} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>Lê-se "em andamento / total": quantos criadores estão em andamento, de quantas participações a campanha tem no total.</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["participants", "creators"], CAMPAIGN_COLUMN_DEFINITIONS.participants)}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "deliveries",
      header: "Entregas",
      width: "132px",
      cell: (campaign) => <DeliveriesCell campaign={campaign} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["deliveries_published", "deliveries"], CAMPAIGN_COLUMN_DEFINITIONS.deliveries)}</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["pending_actions", "pending"], CAMPAIGN_COLUMN_DEFINITIONS.pending)}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "committed",
      header: "Comprometido",
      sortKey: "committed",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      width: "120px",
      cell: (campaign) => <MoneyCell cents={campaign.committed_cents} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["committed_cents", "committed"], CAMPAIGN_COLUMN_DEFINITIONS.committed)}</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{FIGURE_KIND_HELP.committed}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "released",
      header: "Liberado",
      sortKey: "released",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      width: "120px",
      cell: (campaign) => <MoneyCell cents={campaign.released_cents} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>{pickDefinition(definitions, ["released_cents", "released"], CAMPAIGN_COLUMN_DEFINITIONS.released)}</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{FIGURE_KIND_HELP.realized}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "created",
      header: "Criada em",
      sortKey: "created_at",
      // A criação é a ordenação padrão e a data só existe nesta coluna: ela some só em contêineres estreitos (≤ 1060 px),
      // não em todo laptop. O filtro e o "Ordenar por" do celular seguem valendo.
      hideBelow: 1060,
      nowrap: true,
      width: "104px",
      cell: (campaign) => <span title={formatDateTime(campaign.created_at)}>{formatDate(campaign.created_at)}</span>,
    },
  ];

  // `hasActiveFilters` conta status, pagamento, workspace e período fora do padrão (não conta a busca).
  const filtering = list.hasActiveFilters || !!list.search;
  const emptyAction: ReactNode = (
    <button type="button" className="btn out adm-btn-sm" onClick={list.reset}>
      Limpar busca e filtros
    </button>
  );

  return (
    <AdminPage>
      <AdminPageHeader title="Campanhas" subtitle="Todas as campanhas da plataforma." />

      <AdminFilterBar
        segment={{
          options: STATUS_OPTIONS,
          value: list.filters.status,
          onChange: (value) => list.setFilter("status", value),
          ariaLabel: "Status da campanha",
        }}
        segmentDefault=""
        search={<AdminSearchInput value={list.search} onSearch={list.setSearch} placeholder="Buscar por título ou workspace" />}
        searchLabel="Buscar campanhas"
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch)}
        onClear={list.clearFilters}
        trailing={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
      />

      <AdminTable
        caption="Campanhas"
        columns={columns}
        rows={query.data?.data}
        rowKey={(campaign) => campaign.id}
        rowLink={(campaign) => campaignDetailLink(campaign.id)}
        sort={{ by: list.sortBy, order: list.order }}
        onSort={(key) => list.toggleSort(key, key === "title" ? "asc" : "desc")}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={
          filtering
            ? {
                title: "Nenhuma campanha encontrada",
                description: "Nenhuma campanha corresponde à busca e aos filtros atuais.",
                action: emptyAction,
              }
            : {
                title: "Nenhuma campanha ainda",
                description: "Quando um workspace criar uma campanha, ela aparece aqui.",
              }
        }
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />
    </AdminPage>
  );
}
