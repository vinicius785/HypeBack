import { useId, useState } from "react";

import {
  AdminErrorState,
  AdminFigureCard,
  AdminFigureGrid,
  AdminLink,
  AdminSegmentedControl,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import {
  useAdminWorkspaceFinancial,
  useAdminWorkspaceMovements,
} from "@/hooks/admin/use-admin-workspaces";
import { civilDateInSaoPaulo, formatBRLFromCents, formatDateTime } from "@/lib/admin/format";
import { FIGURE_KIND_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/admin/labels";
import type {
  AdminDateRange,
  AdminFinancialFigures,
  AdminFinancialMovement,
  AdminMovementType,
  AdminWorkspaceDetail,
} from "@/shared/admin-platform.types";

import {
  MOVEMENT_DIRECTION_SIGN,
  MOVEMENT_ORIGIN_LABEL,
  MOVEMENT_TYPE_OPTIONS,
} from "./workspace-constants";
import { presetRange } from "./workspace-format";
import { WorkspacePeriodSelector } from "./workspace-period-selector";

import "@/styles/admin-workspaces.css";

interface FigureSpec {
  key: keyof AdminFinancialFigures;
  label: string;
  /** Depende do período escolhido (os demais são a posição de agora). */
  inPeriod?: boolean;
}

/** Os números do contrato, agrupados como a pessoa pergunta: o que entrou, o que está guardado, o que foi aos criadores, o que está pendente. */
const GROUPS: readonly { title: string; figures: readonly FigureSpec[] }[] = [
  {
    title: "Entradas",
    figures: [
      { key: "funded_total", label: "Aportes recebidos (total)" },
      { key: "funded_in_period", label: "Aportes recebidos no período", inPeriod: true },
      { key: "platform_revenue", label: "Receita da plataforma" },
    ],
  },
  {
    title: "Custódia e reservas",
    figures: [
      { key: "custody", label: "Em custódia" },
      { key: "committed", label: "Comprometido" },
      { key: "free_balance", label: "Saldo livre" },
    ],
  },
  {
    title: "Criadores",
    figures: [
      { key: "released_in_period", label: "Liberado no período", inPeriod: true },
      { key: "released_total", label: "Liberado (total)" },
      { key: "in_grace", label: "Em carência" },
      { key: "available_to_withdraw", label: "Disponível para saque" },
      { key: "paid_pix_in_period", label: "PIX concluído no período", inPeriod: true },
      { key: "paid_pix_total", label: "PIX concluído (total)" },
    ],
  },
  {
    title: "Pendências",
    figures: [
      { key: "withdrawals_in_flight", label: "Saques em andamento" },
      { key: "pending_charges", label: "Cobranças pendentes" },
    ],
  },
];

/** Aba "Financeiro": os números do workspace no período e o extrato de movimentações, tudo com a origem. */
export function WorkspaceFinancialTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const idPrefix = useId();
  const [period, setPeriod] = useState<AdminDateRange>(() => presetRange("30d", civilDateInSaoPaulo()));
  const [type, setType] = useState<AdminMovementType | "all">("all");
  const financial = useAdminWorkspaceFinancial(workspace.id, period);
  const movements = useAdminWorkspaceMovements(workspace.id, period, type);

  const figures = financial.data?.figures;
  const rows = movements.data?.pages.flatMap((page) => page.data);

  const columns: AdminTableColumn<AdminFinancialMovement>[] = [
    {
      key: "when",
      header: "Data",
      width: "136px",
      nowrap: true,
      cell: (movement) => formatDateTime(movement.occurred_at),
    },
    {
      key: "movement",
      header: "Movimentação",
      primary: true,
      width: "minmax(0, 2fr)",
      cell: (movement) => (
        <span>
          <b>{MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type}</b>
          <span className="adm-muted"> · {movement.status_label}</span>
          {movement.description ? <small className="adm-sub">{movement.description}</small> : null}
        </span>
      ),
    },
    {
      key: "origin",
      header: "Origem",
      width: "minmax(0, 1.4fr)",
      hideBelow: "md",
      definition: <p>O registro que originou o valor, para rastrear: o tipo e o identificador dele no banco.</p>,
      cell: (movement) => (
        <span className="adm-workspaces-origin" title={movement.origin.external_id ? `Identificador externo: ${movement.origin.external_id}` : undefined}>
          {MOVEMENT_ORIGIN_LABEL[movement.origin.type] ?? movement.origin.type}
          <code title={movement.origin.id}>{movement.origin.id}</code>
        </span>
      ),
    },
    {
      key: "links",
      header: "Campanha e criador",
      width: "minmax(0, 1.4fr)",
      hideBelow: "lg",
      cell: (movement) =>
        movement.campaign || movement.user ? (
          <span className="adm-workspaces-links">
            {movement.campaign ? (
              <AdminLink to={{ to: "/admin/campaigns/$campaignId", params: { campaignId: movement.campaign.id } }}>
                {movement.campaign.title}
              </AdminLink>
            ) : null}
            {movement.user ? (
              <AdminLink to={{ to: "/admin/users/$userId", params: { userId: movement.user.user_id } }}>{movement.user.name}</AdminLink>
            ) : null}
          </span>
        ) : (
          <span className="adm-muted">—</span>
        ),
    },
    {
      key: "amount",
      header: "Valor",
      width: "132px",
      align: "right",
      nowrap: true,
      cell: (movement) => (
        <span className="adm-num adm-workspaces-amount" data-direction={movement.direction}>
          {MOVEMENT_DIRECTION_SIGN[movement.direction] ?? ""}
          {formatBRLFromCents(movement.amount_cents)}
        </span>
      ),
    },
    {
      key: "kind",
      header: "Tipo do valor",
      width: "136px",
      hideBelow: "md",
      definition: <p>O que o valor É: realizado (fato), comprometido (reserva), posição atual, calculado ou aproximado.</p>,
      cell: (movement) => (
        <span className="adm-kind" data-kind={movement.kind}>
          {FIGURE_KIND_LABEL[movement.kind] ?? movement.kind}
        </span>
      ),
    },
  ];

  return (
    <div className="adm-workspaces-panel">
      <WorkspacePeriodSelector value={period} onChange={setPeriod} />

      {financial.isError ? (
        <AdminErrorState boxed error={financial.error} onRetry={() => void financial.refetch()} retrying={financial.isRefetching} />
      ) : (
        GROUPS.map((group, index) => (
          <section className="adm-workspaces-group" key={group.title} aria-labelledby={`${idPrefix}-group-${index}`}>
            <h3 id={`${idPrefix}-group-${index}`}>{group.title}</h3>
            <AdminFigureGrid>
              {group.figures.map((spec) => (
                <AdminFigureCard
                  key={spec.key}
                  label={spec.label}
                  figure={figures?.[spec.key]}
                  loading={financial.isLoading}
                  hint={spec.inPeriod ? "no período" : undefined}
                />
              ))}
            </AdminFigureGrid>
          </section>
        ))
      )}

      <section className="adm-workspaces-group" aria-labelledby={`${idPrefix}-movements`}>
        <div className="adm-workspaces-group-head">
          <h3 id={`${idPrefix}-movements`}>Movimentações</h3>
          <AdminSegmentedControl
            ariaLabel="Tipo de movimentação"
            options={MOVEMENT_TYPE_OPTIONS}
            value={type}
            onChange={(value) => setType(value as AdminMovementType | "all")}
          />
        </div>
        <AdminTable
          caption="Movimentações do workspace"
          columns={columns}
          rows={rows}
          rowKey={(movement) => movement.id}
          loading={movements.isLoading}
          refreshing={movements.isFetching && !movements.isLoading && !movements.isFetchingNextPage}
          error={movements.error}
          onRetry={() => void (movements.isFetchNextPageError ? movements.fetchNextPage() : movements.refetch())}
          retrying={movements.isFetching}
          skeletonRows={4}
          stickyHeader={false}
          empty={{
            title: "Nenhuma movimentação no período",
            description: "Não há aportes, lançamentos, saques ou transferências deste workspace nestas datas.",
          }}
          footer={
            movements.hasNextPage ? (
              <div className="adm-workspaces-loadmore">
                <button
                  type="button"
                  className="btn out adm-btn-sm"
                  disabled={movements.isFetchingNextPage}
                  onClick={() => void movements.fetchNextPage()}
                >
                  {movements.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            ) : undefined
          }
        />
      </section>
    </div>
  );
}
