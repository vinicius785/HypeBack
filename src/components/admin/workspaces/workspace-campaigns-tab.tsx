import { useState } from "react";

import {
  AdminEntityCell,
  AdminPager,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminWorkspaceCampaigns } from "@/hooks/admin/use-admin-workspaces";
import { formatBRLFromCents, formatDate, formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminCampaignListItem, AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import "@/styles/admin-workspaces.css";

const PER_PAGE = 25;
/** Primeira direção ao clicar numa coluna: título de A a Z, o resto do maior para o menor. */
const FIRST_ORDER: Record<string, "asc" | "desc"> = { title: "asc", creators: "desc", committed: "desc", released: "desc", created_at: "desc" };

function definitionOf(definitions: Record<string, string> | undefined, ...keys: string[]) {
  for (const key of keys) if (definitions?.[key]) return <p>{definitions[key]}</p>;
  return undefined;
}

/** Aba "Campanhas": as campanhas do workspace (a lista global de campanhas, com o workspace fixo). */
export function WorkspaceCampaignsTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ by: string; order: "asc" | "desc" }>({ by: "created_at", order: "desc" });
  const query = useAdminWorkspaceCampaigns(workspace.id, {
    page,
    per_page: PER_PAGE,
    sort_by: sort.by,
    order: sort.order,
  });
  const meta = query.data?.meta;
  useAdminPageClamp(page, meta?.total_pages, setPage);

  const onSort = (key: string) => {
    setPage(1);
    setSort((current) =>
      current.by === key
        ? { by: key, order: current.order === "asc" ? "desc" : "asc" }
        : { by: key, order: FIRST_ORDER[key] ?? "asc" },
    );
  };

  const definitions = meta?.definitions;
  const columns: AdminTableColumn<AdminCampaignListItem>[] = [
    {
      key: "title",
      header: "Campanha",
      sortKey: "title",
      primary: true,
      width: "minmax(0, 2.4fr)",
      cell: (campaign) => <AdminEntityCell name={campaign.title} photo={campaign.banner} shape="square" />,
    },
    {
      key: "status",
      header: "Status",
      width: "124px",
      cell: (campaign) => <AdminStatusBadge kind="campaign" value={campaign.status} size="sm" />,
    },
    {
      key: "creators",
      header: "Criadores",
      sortKey: "creators",
      width: "104px",
      align: "right",
      definition: definitionOf(definitions, "participants", "creators"),
      cell: (campaign) => (
        <span
          className="adm-num"
          title={`${formatInt(campaign.participants.participating)} em andamento de ${formatInt(campaign.participants.total)} participações`}
        >
          <b>{formatInt(campaign.participants.participating)}</b>
          <span className="adm-muted"> / {formatInt(campaign.participants.total)}</span>
        </span>
      ),
    },
    {
      key: "committed",
      header: "Comprometido",
      sortKey: "committed",
      width: "136px",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      definition: definitionOf(definitions, "committed_cents", "committed"),
      cell: (campaign) => <span className="adm-num">{formatBRLFromCents(campaign.committed_cents)}</span>,
    },
    {
      key: "released",
      header: "Liberado",
      sortKey: "released",
      width: "136px",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      definition: definitionOf(definitions, "released_cents", "released"),
      cell: (campaign) => <span className="adm-num">{formatBRLFromCents(campaign.released_cents)}</span>,
    },
    {
      key: "created",
      header: "Criada em",
      sortKey: "created_at",
      width: "104px",
      nowrap: true,
      cell: (campaign) => <span title={formatDateTime(campaign.created_at)}>{formatDate(campaign.created_at)}</span>,
    },
  ];

  return (
    <div className="adm-workspaces-panel">
      <AdminTable
        caption="Campanhas do workspace"
        columns={columns}
        rows={query.data?.data}
        rowKey={(campaign) => campaign.id}
        rowLink={(campaign) => ({ to: "/admin/campaigns/$campaignId", params: { campaignId: campaign.id } })}
        sort={sort}
        onSort={onSort}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        skeletonRows={4}
        stickyHeader={false}
        empty={{ title: "Nenhuma campanha", description: "Este workspace ainda não criou campanhas." }}
        footer={
          meta ? (
            <AdminPager page={meta.page} perPage={meta.per_page} total={meta.total} onPageChange={setPage} disabled={query.isFetching} />
          ) : undefined
        }
      />
    </div>
  );
}
