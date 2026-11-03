import { useState } from "react";

import {
  adminToast,
  AdminErrorState,
  AdminFigureCard,
  AdminFigureGrid,
  AdminFilterBar,
  AdminIconButton,
  AdminKeyValueList,
  AdminLink,
  AdminLoadMore,
  AdminPeriodSelect,
  AdminRefreshButton,
  AdminTable,
  type AdminKeyValueItem,
  type AdminPeriodChange,
  type AdminPeriodPresetOption,
  type AdminTableColumn,
} from "@/components/admin/platform";
import {
  useAdminWorkspaceFinancial,
  useAdminWorkspaceMovements,
} from "@/hooks/admin/use-admin-workspaces";
import { civilDateInSaoPaulo, formatBRLFromCents, formatDateRange, formatDateTime } from "@/lib/admin/format";
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
import { detectPreset, MAX_PERIOD_DAYS, presetRange, type PeriodPreset } from "./workspace-format";

import "@/styles/admin-workspaces.css";

interface FigureSpec {
  key: keyof AdminFinancialFigures;
  label: string;
}

/**
 * Os oito indicadores em destaque, na ordem em que a pessoa pergunta: o que entrou, o que está guardado, o que
 * pode sair. Os que dependem do período dizem isso no próprio nome (sem o "no período" repetido embaixo de cada um).
 */
const HIGHLIGHTS: readonly FigureSpec[] = [
  { key: "funded_total", label: "Aportes recebidos (total)" },
  { key: "funded_in_period", label: "Aportes recebidos no período" },
  { key: "custody", label: "Em custódia" },
  { key: "committed", label: "Comprometido" },
  { key: "free_balance", label: "Saldo livre" },
  { key: "released_in_period", label: "Liberado no período" },
  { key: "available_to_withdraw", label: "Disponível para saque" },
  { key: "pending_charges", label: "Cobranças pendentes" },
];

/** O restante dos números do contrato, agrupados, em "Ver detalhes": nada some, só sai da primeira vista. */
const DETAIL_GROUPS: readonly { title: string; figures: readonly FigureSpec[] }[] = [
  { title: "Entradas", figures: [{ key: "platform_revenue", label: "Receita da plataforma" }] },
  {
    title: "Criadores",
    figures: [
      { key: "released_total", label: "Liberado (total)" },
      { key: "in_grace", label: "Em carência" },
      { key: "paid_pix_in_period", label: "PIX concluído no período" },
      { key: "paid_pix_total", label: "PIX concluído (total)" },
    ],
  },
  { title: "Pendências", figures: [{ key: "withdrawals_in_flight", label: "Saques em andamento" }] },
];

const PERIOD_PRESETS: readonly AdminPeriodPresetOption[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];

const isPreset = (id: string): id is PeriodPreset => PERIOD_PRESETS.some((preset) => preset.id === id);

const MOVEMENT_NOUN = { singular: "movimentação", plural: "movimentações", feminine: true } as const;

/** Copia o identificador da movimentação; o resultado sai num aviso (sucesso) ou, sem permissão do navegador, num erro. */
function CopyId({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      adminToast.success(`${label} copiado.`);
    } catch {
      adminToast.error(`Não foi possível copiar o ${label.toLowerCase()}.`);
    }
  };
  return (
    <span className="adm-workspaces-copy">
      <code className="adm-workspaces-code">{value}</code>
      <AdminIconButton label={`Copiar ${label.toLowerCase()}`} icon="copy" size="sm" onClick={() => void copy()} />
    </span>
  );
}

/** Detalhes recolhidos de uma movimentação: o registro que originou o valor e o identificador (copiável). */
function MovementDetails({ movement }: { movement: AdminFinancialMovement }) {
  const { origin } = movement;
  const items: AdminKeyValueItem[] = [
    { label: "Origem", value: MOVEMENT_ORIGIN_LABEL[origin.type] ?? origin.type },
    { label: "Identificador", value: <CopyId label="Identificador" value={origin.id} /> },
  ];
  if (origin.external_id) items.push({ label: "Identificador externo", value: <CopyId label="Identificador externo" value={origin.external_id} /> });
  return <AdminKeyValueList columns={2} items={items} />;
}

/**
 * Aba "Financeiro": os números do workspace no período e o extrato de movimentações, tudo com a origem. Oito
 * indicadores em destaque e o resto em "Ver detalhes". O período é do `AdminPeriodSelect` (só apresentação): as
 * regras (dias de São Paulo, até hoje, no máximo 366 dias) ficam aqui.
 */
export function WorkspaceFinancialTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const today = civilDateInSaoPaulo();
  const [period, setPeriod] = useState<AdminDateRange>(() => presetRange("30d", today));
  const [type, setType] = useState<AdminMovementType | "all">("all");
  const financial = useAdminWorkspaceFinancial(workspace.id, period);
  const movements = useAdminWorkspaceMovements(workspace.id, period, type);

  const figures = financial.data?.figures;
  const rows = movements.data?.pages.flatMap((page) => page.data);

  const changePeriod = (next: AdminPeriodChange) => {
    if (isPreset(next.preset)) setPeriod(presetRange(next.preset, civilDateInSaoPaulo()));
    // O seletor só devolve intervalo livre quando já é válido (datas completas, em ordem, até hoje, dentro do limite).
    else if (next.from && next.to) setPeriod({ from: next.from, to: next.to });
  };

  const refreshing = financial.isFetching || (movements.isFetching && !movements.isFetchingNextPage);
  const refresh = () => {
    void financial.refetch();
    void movements.refetch();
  };

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
      width: "minmax(0, 1.2fr)",
      hideBelow: "md",
      definition: <p>O tipo do registro que originou o valor. O identificador dele, para rastrear, fica nos detalhes da linha.</p>,
      cell: (movement) => MOVEMENT_ORIGIN_LABEL[movement.origin.type] ?? movement.origin.type,
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
              <AdminLink textLink to={{ to: "/admin/campaigns/$campaignId", params: { campaignId: movement.campaign.id } }}>
                {movement.campaign.title}
              </AdminLink>
            ) : null}
            {movement.user ? (
              <AdminLink textLink to={{ to: "/admin/users/$userId", params: { userId: movement.user.user_id } }}>
                {movement.user.name}
              </AdminLink>
            ) : null}
          </span>
        ) : (
          <span className="adm-muted">—</span>
        ),
    },
    {
      key: "amount",
      header: "Valor",
      width: "148px",
      align: "right",
      nowrap: true,
      definition: <p>O selo embaixo do valor diz o que ele é: realizado (fato), comprometido (reserva), posição atual, calculado ou aproximado.</p>,
      cell: (movement) => (
        <span className="adm-workspaces-amount" data-direction={movement.direction}>
          <span className="adm-num">
            {MOVEMENT_DIRECTION_SIGN[movement.direction] ?? ""}
            {formatBRLFromCents(movement.amount_cents)}
          </span>
          <span className="adm-kind" data-kind={movement.kind}>
            {FIGURE_KIND_LABEL[movement.kind] ?? movement.kind}
          </span>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="adm-workspaces-periodbar">
        <AdminPeriodSelect
          presets={PERIOD_PRESETS}
          value={{ preset: detectPreset(period, today), from: period.from, to: period.to }}
          onChange={changePeriod}
          custom={{ max: today, maxDays: MAX_PERIOD_DAYS }}
          summary={`Dias de São Paulo · ${formatDateRange(period)}`}
        />
        <AdminRefreshButton iconOnly onClick={refresh} loading={refreshing} />
      </div>

      {financial.isError ? (
        <AdminErrorState boxed error={financial.error} onRetry={() => void financial.refetch()} retrying={financial.isRefetching} />
      ) : (
        <>
          <AdminFigureGrid quiet>
            {HIGHLIGHTS.map((spec) => (
              <AdminFigureCard key={spec.key} label={spec.label} figure={figures?.[spec.key]} loading={financial.isLoading} />
            ))}
          </AdminFigureGrid>

          <details className="adm-workspaces-more">
            <summary className="adm-summary">Ver detalhes</summary>
            <div className="adm-workspaces-more-body">
              {DETAIL_GROUPS.map((group) => (
                <section className="adm-workspaces-group" key={group.title} aria-label={group.title}>
                  <h3>{group.title}</h3>
                  <AdminFigureGrid quiet>
                    {group.figures.map((spec) => (
                      <AdminFigureCard key={spec.key} label={spec.label} figure={figures?.[spec.key]} loading={financial.isLoading} />
                    ))}
                  </AdminFigureGrid>
                </section>
              ))}
            </div>
          </details>
        </>
      )}

      <section className="adm-workspaces-group" aria-labelledby={`${workspace.id}-movements`}>
        <h2 id={`${workspace.id}-movements`}>Movimentações</h2>
        <AdminFilterBar
          segment={{
            options: MOVEMENT_TYPE_OPTIONS,
            value: type,
            onChange: (value) => setType(value as AdminMovementType | "all"),
            ariaLabel: "Tipo de movimentação",
          }}
        />
        <AdminTable
          caption="Movimentações do workspace"
          columns={columns}
          rows={rows}
          rowKey={(movement) => movement.id}
          renderExpanded={(movement) => <MovementDetails movement={movement} />}
          expandLabel={(movement) => `Detalhes da movimentação ${MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type} de ${formatDateTime(movement.occurred_at)}`}
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
            <AdminLoadMore
              loaded={rows?.length ?? 0}
              hasMore={!!movements.hasNextPage}
              loading={movements.isFetchingNextPage}
              onLoadMore={() => void movements.fetchNextPage()}
              noun={MOVEMENT_NOUN}
            />
          }
        />
      </section>
    </>
  );
}
