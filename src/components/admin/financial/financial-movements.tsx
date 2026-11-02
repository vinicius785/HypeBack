import { AdminBadge, AdminLink, AdminSegmentedControl, AdminTable, type AdminBadgeTone, type AdminTableColumn } from "@/components/admin/platform";
import { AdminWorkspacePicker } from "@/components/admin/users/admin-workspace-picker";
import { useAdminFinancialMovements } from "@/hooks/admin/use-admin-financial";
import { useAdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";
import { formatBRLFromCents, formatDateTime, formatInt } from "@/lib/admin/format";
import { FIGURE_KIND_HELP, FIGURE_KIND_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/admin/labels";
import type { AdminDateRange, AdminFinancialMovement, AdminMovementType } from "@/shared/admin-platform.types";

import { CopyValue } from "./copy-value";
import { isMovementType, isWorkspaceId, MOVEMENTS_FILTER_CONFIG } from "./financial-search";

import "@/styles/admin-financial.css";

const TYPE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "charge", label: "Cobranças" },
  { value: "ledger_entry", label: "Lançamentos" },
  { value: "withdrawal", label: "Saques" },
  { value: "transfer", label: "Transferências" },
] as const;

const ORIGIN_TYPE_LABEL: Record<AdminFinancialMovement["origin"]["type"], string> = {
  asaas_charge: "Cobrança Asaas",
  balance_entry: "Lançamento do saldo",
  withdrawal: "Saque do criador",
  asaas_transfer: "Transferência Asaas",
};

const DIRECTION_SIGN: Record<AdminFinancialMovement["direction"], string> = { in: "+", out: "−", internal: "" };
const DIRECTION_LABEL: Record<AdminFinancialMovement["direction"], string> = {
  in: "Entrada",
  out: "Saída",
  internal: "Movimento interno",
};

/** Cor da etiqueta de situação pelo estado cru do registro (`status`); o que não se conhece fica neutro. */
const STATUS_TONE: Record<string, AdminBadgeTone> = {
  paid: "ok",
  done: "ok",
  withdrawn: "ok",
  failed: "bad",
  expired: "muted",
  cancelled: "muted",
  reserved: "brand",
};

/** "+ R$ 1.000,00", "− R$ 200,00"; lançamento interno (só mudou de bolso) vai sem sinal. */
export function movementAmountText(movement: Pick<AdminFinancialMovement, "direction" | "amount_cents">): string {
  const sign = DIRECTION_SIGN[movement.direction];
  return `${sign ? `${sign} ` : ""}${formatBRLFromCents(movement.amount_cents)}`;
}

function plural(count: number, one: string, many: string): string {
  return `${formatInt(count)} ${count === 1 ? one : many}`;
}

function MovementCell({ movement }: { movement: AdminFinancialMovement }) {
  return (
    <div className="adm-fin-mov">
      <div className="adm-fin-mov-head">
        <b>{MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type}</b>
        <AdminBadge size="sm" tone={STATUS_TONE[movement.status] ?? "neutral"}>
          {movement.status_label}
        </AdminBadge>
      </div>
      {movement.description ? <span className="adm-sub">{movement.description}</span> : null}
    </div>
  );
}

function AmountCell({ movement }: { movement: AdminFinancialMovement }) {
  return (
    <div className="adm-fin-amount" data-direction={movement.direction}>
      <b aria-label={`${DIRECTION_LABEL[movement.direction]}: ${formatBRLFromCents(movement.amount_cents)}`}>{movementAmountText(movement)}</b>
      <span className="adm-kind" data-kind={movement.kind} title={FIGURE_KIND_HELP[movement.kind]}>
        {FIGURE_KIND_LABEL[movement.kind]}
      </span>
    </div>
  );
}

function PartiesCell({ movement }: { movement: AdminFinancialMovement }) {
  const { workspace, campaign, user } = movement;
  return (
    <div className="adm-fin-parties">
      {workspace ? (
        <AdminLink to={{ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } }} className="adm-fin-entity">
          {workspace.name}
        </AdminLink>
      ) : (
        <span className="adm-muted">Não atribuído</span>
      )}
      {campaign ? (
        <AdminLink to={{ to: "/admin/campaigns/$campaignId", params: { campaignId: campaign.id } }} className="adm-sub adm-fin-sublink">
          {campaign.title}
        </AdminLink>
      ) : null}
      {user ? (
        <span className="adm-sub">
          Criador:{" "}
          <AdminLink to={{ to: "/admin/users/$userId", params: { userId: user.user_id } }} className="adm-fin-sublink">
            {user.name}
          </AdminLink>
        </span>
      ) : null}
    </div>
  );
}

function OriginCell({ movement }: { movement: AdminFinancialMovement }) {
  const { origin } = movement;
  const typeLabel = ORIGIN_TYPE_LABEL[origin.type] ?? origin.type;
  return (
    <div className="adm-fin-origin">
      <span className="adm-sub">{typeLabel}</span>
      <CopyValue value={origin.id} label={`id de origem (${typeLabel})`} />
      {origin.external_id ? <CopyValue value={origin.external_id} label={`id externo (${typeLabel})`} /> : null}
    </div>
  );
}

const COLUMNS: readonly AdminTableColumn<AdminFinancialMovement>[] = [
  {
    key: "occurred_at",
    header: "Data",
    width: "104px",
    nowrap: true,
    wide: true,
    cell: (m) => {
      const text = formatDateTime(m.occurred_at);
      const [date, time] = text.split(" ");
      return (
        <span className="adm-fin-when" title={`${text}, horário de São Paulo`}>
          <span>{date}</span>
          {time ? <small>{time}</small> : null}
        </span>
      );
    },
  },
  { key: "movement", header: "Movimentação", width: "minmax(0, 1.5fr)", primary: true, cell: (m) => <MovementCell movement={m} /> },
  { key: "amount", header: "Valor", width: "minmax(150px, 0.9fr)", align: "right", nowrap: true, cell: (m) => <AmountCell movement={m} /> },
  { key: "parties", header: "Workspace e criador", width: "minmax(0, 1.4fr)", cell: (m) => <PartiesCell movement={m} /> },
  { key: "origin", header: "Origem", width: "minmax(0, 1.2fr)", cell: (m) => <OriginCell movement={m} /> },
];

interface FinancialMovementsProps {
  period: AdminDateRange;
}

/**
 * Movimentações: o feed global por cursor (cobranças, lançamentos, saques e transferências), do mais recente
 * para o mais antigo, com filtro de tipo, de workspace e o período da página. "Carregar mais" pede a página
 * seguinte com o cursor da anterior.
 */
export function FinancialMovements({ period }: FinancialMovementsProps) {
  const state = useAdminListQueryState(MOVEMENTS_FILTER_CONFIG);
  // O que veio da URL é revalidado: um valor solto nunca chega à API.
  const type: AdminMovementType | "" = isMovementType(state.filters.type) ? state.filters.type : "";
  const workspaceId = isWorkspaceId(state.filters.workspace_id) ? state.filters.workspace_id : "";
  const filtered = !!type || !!workspaceId;

  const { query, rows } = useAdminFinancialMovements({ type, workspaceId, period });
  const failedToLoadMore = query.isFetchNextPageError;

  const clear = () => state.setFilters({ type: "", workspace_id: "" });

  return (
    <div className="adm-fin-stack">
      <div className="adm-fin-bar">
        <AdminSegmentedControl
          ariaLabel="Tipo de movimentação"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(value) => state.setFilter("type", value)}
        />
        <AdminWorkspacePicker
          label="Workspace"
          placeholder="Todos"
          value={workspaceId || null}
          onChange={(workspace) => state.setFilter("workspace_id", workspace?.id ?? "")}
        />
        {filtered ? (
          <button type="button" className="adm-textbtn" onClick={clear}>
            Limpar filtros
          </button>
        ) : null}
      </div>

      <AdminTable
        caption="Movimentações financeiras"
        columns={COLUMNS}
        rows={query.isLoading ? undefined : rows}
        rowKey={(m) => m.id}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading && !query.isFetchingNextPage}
        error={query.error}
        onRetry={() => void (failedToLoadMore ? query.fetchNextPage() : query.refetch())}
        retrying={query.isFetching}
        skeletonRows={8}
        empty={{
          title: filtered ? "Nenhuma movimentação com estes filtros" : "Nenhuma movimentação no período",
          description: filtered
            ? "Tente outro tipo, outro workspace ou um período maior."
            : "Não houve cobrança, lançamento, saque nem transferência nestes dias. Tente um período maior.",
          action: filtered ? (
            <button type="button" className="btn out adm-btn-sm" onClick={clear}>
              Limpar filtros
            </button>
          ) : undefined,
        }}
        footer={
          rows.length > 0 ? (
            <div className="adm-fin-more">
              <span role="status">
                {plural(rows.length, "movimentação carregada", "movimentações carregadas")}
                {query.hasNextPage ? "" : " · fim da lista"}
              </span>
              {query.hasNextPage ? (
                <button type="button" className="btn out adm-btn-sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                  {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
