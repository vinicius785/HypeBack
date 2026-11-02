import type { ReactNode } from "react";

import {
  AdminEntityCell,
  AdminFilterBar,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminSearchInput,
  AdminStatusBadge,
  AdminTable,
  type AdminFilterDef,
  type AdminFilterOption,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { AdminWorkspacePicker } from "@/components/admin/users/admin-workspace-picker";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { ADMIN_CAMPAIGN_LIST_CONFIG, useAdminCampaigns } from "@/hooks/admin/use-admin-campaigns";
import { formatBRLFromCents, formatDate, formatDateTime, formatInt, figureText } from "@/lib/admin/format";
import { FIGURE_KIND_HELP } from "@/lib/admin/labels";
import type { AdminCampaignListItem } from "@/shared/admin-platform.types";

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

/** Nome do workspace (link) com a etiqueta do estado quando não está ativo, e o proprietário dele embaixo. */
function WorkspaceCell({ campaign }: { campaign: AdminCampaignListItem }) {
  const { workspace, workspace_owner: owner } = campaign;
  return (
    <div className="adm-campaigns-ws">
      <span className="adm-campaigns-ws-name">
        <AdminLink to={campaignWorkspaceLink(workspace.id)} title={workspace.name}>
          {workspace.name}
        </AdminLink>
        {workspace.status !== "active" ? <AdminStatusBadge kind="workspace" value={workspace.status} size="sm" /> : null}
      </span>
      {owner ? (
        <small title={`Proprietário do workspace (a campanha não tem responsável próprio) · ${owner.email}`}>Proprietário: {owner.name}</small>
      ) : (
        <small>Workspace sem proprietário</small>
      )}
    </div>
  );
}

function CreatorsCell({ campaign }: { campaign: AdminCampaignListItem }) {
  const { participating, total } = campaign.participants;
  return (
    <span
      className="adm-num"
      title={`${formatInt(participating)} em andamento de ${formatInt(total)} ${total === 1 ? "participação" : "participações"}`}
    >
      <b>{formatInt(participating)}</b>
      <span className="adm-muted"> / {formatInt(total)}</span>
    </span>
  );
}

/** Uma contagem: zero fica apagado (é o "nada a fazer" da coluna), mas continua sendo um zero de verdade. */
function CountCell({ value, title }: { value: number; title?: string }) {
  return (
    <span className={`adm-num${value === 0 ? " adm-muted" : ""}`} title={title}>
      {formatInt(value)}
    </span>
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
 * Campanha não tem "dono" no banco: a coluna Workspace mostra o proprietário do workspace, dito assim. Orçamento
 * também não existe: a coluna é sempre "Não apurado" e explica por quê, em vez de inventar um número.
 */
export function AdminCampaignsList() {
  const list = useAdminListQueryState(ADMIN_CAMPAIGN_LIST_CONFIG);
  const query = useAdminCampaigns(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const definitions = meta?.definitions;
  // O orçamento é um `AdminFigure` em cada linha: a definição da própria linha vale mais que a da lista.
  const budgetDefinition =
    query.data?.data[0]?.budget.definition ?? pickDefinition(definitions, ["budget"], CAMPAIGN_COLUMN_DEFINITIONS.budget);

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
    { kind: "select", key: "payment_method", label: "Pagamento", options: paymentOptions },
    { kind: "date-range", label: "Criada em", fromKey: "created_from", toKey: "created_to" },
  ];

  const columns: AdminTableColumn<AdminCampaignListItem>[] = [
    {
      key: "campaign",
      header: "Campanha",
      sortKey: "title",
      primary: true,
      width: "minmax(0, 2.4fr)",
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
      width: "minmax(0, 2fr)",
      cell: (campaign) => <WorkspaceCell campaign={campaign} />,
      definition: pickDefinition(definitions, ["workspace_owner", "owner"], CAMPAIGN_COLUMN_DEFINITIONS.owner),
    },
    {
      key: "status",
      header: "Status",
      width: "104px",
      cell: (campaign) => <AdminStatusBadge kind="campaign" value={campaign.status} />,
    },
    {
      key: "creators",
      header: "Criadores",
      sortKey: "creators",
      align: "right",
      nowrap: true,
      width: "88px",
      cell: (campaign) => <CreatorsCell campaign={campaign} />,
      definition: pickDefinition(definitions, ["participants", "creators"], CAMPAIGN_COLUMN_DEFINITIONS.participants),
    },
    {
      key: "deliveries",
      header: "Entregas publicadas",
      align: "right",
      hideBelow: "lg",
      width: "96px",
      cell: (campaign) => <CountCell value={campaign.deliveries_published} />,
      definition: pickDefinition(definitions, ["deliveries_published", "deliveries"], CAMPAIGN_COLUMN_DEFINITIONS.deliveries),
    },
    {
      key: "pending",
      header: "Pendências",
      align: "right",
      width: "96px",
      cell: (campaign) => (
        <CountCell
          value={campaign.pending_actions}
          title={
            campaign.pending_actions > 0
              ? `${formatInt(campaign.pending_actions)} ${campaign.pending_actions === 1 ? "participação aguarda" : "participações aguardam"} ação do time do cliente`
              : "Nada aguardando ação do time do cliente"
          }
        />
      ),
      definition: pickDefinition(definitions, ["pending_actions", "pending"], CAMPAIGN_COLUMN_DEFINITIONS.pending),
    },
    {
      key: "committed",
      header: "Comprometido",
      sortKey: "committed",
      align: "right",
      nowrap: true,
      width: "124px",
      cell: (campaign) => <MoneyCell cents={campaign.committed_cents} />,
      definition: (
        <>
          <p>{pickDefinition(definitions, ["committed_cents", "committed"], CAMPAIGN_COLUMN_DEFINITIONS.committed)}</p>
          <p>{FIGURE_KIND_HELP.committed}</p>
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
      width: "124px",
      cell: (campaign) => <MoneyCell cents={campaign.released_cents} />,
      definition: (
        <>
          <p>{pickDefinition(definitions, ["released_cents", "released"], CAMPAIGN_COLUMN_DEFINITIONS.released)}</p>
          <p>{FIGURE_KIND_HELP.realized}</p>
        </>
      ),
    },
    {
      key: "budget",
      header: "Orçamento",
      align: "right",
      nowrap: true,
      hideBelow: "lg",
      width: "108px",
      cell: (campaign) => (
        <span className="adm-muted" title={campaign.budget.definition}>
          {figureText(campaign.budget)}
        </span>
      ),
      definition: budgetDefinition,
    },
    {
      key: "created",
      header: "Criada em",
      sortKey: "created_at",
      hideBelow: "md",
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
        search={
          <>
            <AdminSearchInput
              value={list.search}
              onSearch={list.setSearch}
              placeholder="Buscar por título ou workspace"
              label="Buscar campanhas por título ou workspace"
            />
            <AdminWorkspacePicker
              value={list.filters.workspace_id}
              onChange={(workspace) => list.setFilter("workspace_id", workspace?.id ?? "")}
              label="Workspace"
              placeholder="Todos"
            />
          </>
        }
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch)}
        onClear={list.clearFilters}
      />

      <div className="adm-campaigns-table">
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
      </div>
    </AdminPage>
  );
}
