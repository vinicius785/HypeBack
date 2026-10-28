import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import {
  AdminPeriodFilter,
  AdminSeg,
  computePeriodFromPreset,
  type AdminPeriodPreset,
} from "@/components/admin/admin-period-filter";
import { AdminNicheChart } from "@/components/admin/admin-niche-chart";
import { AdminSizeChart } from "@/components/admin/admin-size-chart";
import { campaignPoints } from "@/components/admin/admin-campaigns-evolution-chart";
import {
  AdminBarChart,
  formatAdminMoney,
  volumePoints,
} from "@/components/admin/admin-financial-volume-chart";
import { AdminWorkspacesRanking } from "@/components/admin/admin-workspaces-ranking";
import { AdminSaasCard } from "@/components/admin/admin-saas-card";
import {
  useAdminCampaignsStats,
  useAdminCreatorsStats,
  useAdminDashboardSummary,
  useAdminFinancialStats,
  useAdminNicheDistribution,
  useAdminSaasMetrics,
  useAdminSizeDistribution,
  useAdminWorkspaceRanking,
} from "@/hooks/use-admin-dashboard";
import type { AdminGranularity } from "@/shared/types";
import type { AdminWorkspaceRankingSort } from "@/shared/services/admin-dashboard";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/dashboard" as "/(private)/(admin)/admin/dashboard",
)({
  component: SuperAdminDashboard,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");
const PERCENT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return NUMBER_FORMATTER.format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${PERCENT_FORMATTER.format(value)}%`;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatAdminMoney(value);
}

/** Granularidade das séries conforme o tamanho do período. */
function granularityFor(preset: AdminPeriodPreset, from: string, to: string): AdminGranularity {
  if (preset === "7d") return "day";
  if (preset === "30d" || preset === "90d") return "week";
  if (preset === "custom") {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    return days <= 10 ? "day" : days <= 100 ? "week" : "month";
  }
  return "month";
}

type ChartKey = "vol" | "camp";
const CHARTS: { id: ChartKey; label: string }[] = [
  { id: "vol", label: "Volume" },
  { id: "camp", label: "Campanhas" },
];

function SuperAdminDashboard() {
  const [preset, setPreset] = useState<AdminPeriodPreset>("30d");
  const [period, setPeriod] = useState(
    () => computePeriodFromPreset("30d") ?? { from: "", to: "" },
  );
  const [rankingSort, setRankingSort] =
    useState<AdminWorkspaceRankingSort>("campaigns");
  const [chart, setChart] = useState<ChartKey>("vol");

  const granularity = granularityFor(preset, period.from, period.to);

  const summary = useAdminDashboardSummary(period);
  const creatorsStats = useAdminCreatorsStats(period, granularity);
  const nicheDist = useAdminNicheDistribution(period, 8);
  const sizeDist = useAdminSizeDistribution(period);
  const campaignsStats = useAdminCampaignsStats(period, granularity);
  const financialStats = useAdminFinancialStats(period, granularity);
  const saasMetrics = useAdminSaasMetrics(period);
  const ranking = useAdminWorkspaceRanking(period, rankingSort, 10);

  const handlePeriodChange = (
    nextPeriod: typeof period,
    nextPreset: AdminPeriodPreset,
  ) => {
    setPeriod(nextPeriod);
    setPreset(nextPreset);
  };

  const creators = summary.data?.creators ?? creatorsStats.data;
  const campaigns = summary.data?.campaigns ?? campaignsStats.data;
  const financial = summary.data?.financial ?? financialStats.data;

  const loadC = summary.isLoading && creatorsStats.isLoading;
  const loadK = summary.isLoading && campaignsStats.isLoading;
  const loadF = summary.isLoading && financialStats.isLoading;

  const volPts = volumePoints(financialStats.data?.volume_series);
  const campPts = campaignPoints(campaignsStats.data?.evolution);
  const chartTotal =
    chart === "vol"
      ? formatBRL(volPts.reduce((a, p) => a + p.value, 0))
      : formatNumber(campPts.reduce((a, p) => a + p.value, 0));

  const saas = saasMetrics.data;
  const nrr = saas?.nrr;
  const health = [
    {
      name: "Retenção líquida (NRR)",
      value: formatPercent(nrr),
      description: "Acima de 100% indica crescimento sem novos clientes.",
      tone: nrr == null ? "" : nrr >= 100 ? "ok" : "mid",
    },
    {
      name: "Churn de workspaces",
      value: formatPercent(saas?.churn_rate),
      description: "Deixaram de ter campanhas ativas nos últimos 30 dias.",
      tone: "",
    },
    {
      name: "Ativação de novos clientes",
      value: formatPercent(saas?.activation_rate_new_clients),
      description:
        "Publicaram ao menos 1 campanha em até 30 dias do cadastro.",
      tone: "",
    },
    {
      name: "Receita média por cliente",
      value: formatBRL(saas?.arpu),
      description: "Taxas e comissões por workspace ativo no período.",
      tone: "",
    },
    {
      name: "Ticket médio por campanha",
      value: formatBRL(saas?.avg_ticket_per_campaign),
      description: "Volume médio por campanha finalizada.",
      tone: "",
    },
    {
      name: "Valor de vida (LTV)",
      value: formatBRL(saas?.ltv_estimate),
      description: "Estimativa baseada no histórico de aportes.",
      tone: "",
    },
    {
      name: "Tempo de vida médio do cliente",
      value:
        saas?.avg_customer_lifetime_days != null
          ? `${formatNumber(saas.avg_customer_lifetime_days)} dias`
          : "—",
      description:
        "Tempo médio entre a criação e a última atividade de um workspace.",
      tone: "",
    },
  ] as const;

  const extra: {
    label: string;
    value: string;
    icon: string;
    hint?: string;
    loading: boolean;
  }[] = [
    { label: "Criadores ativos", value: formatNumber(creators?.active_in_period), icon: "users", hint: "Participaram de ≥1 campanha", loading: loadC },
    { label: "Taxa de ativação", value: formatPercent(creators?.activation_rate), icon: "trend", hint: "Ativos / total", loading: loadC },
    { label: "Redes sociais cadastradas", value: formatNumber(creators?.total_social_networks), icon: "share", loading: loadC },
    { label: "Média de redes por criador", value: creators?.avg_networks_per_creator != null ? creators.avg_networks_per_creator.toFixed(2) : "—", icon: "link", loading: loadC },
    { label: "Total de campanhas", value: formatNumber(campaigns?.total), icon: "mega", loading: loadK },
    { label: "Finalizadas", value: formatNumber(campaigns?.finished), icon: "verified", loading: loadK },
    { label: "Rascunhos", value: formatNumber(campaigns?.draft), icon: "file", loading: loadK },
    { label: "Média de criadores por campanha", value: campaigns?.avg_influencers_per_campaign != null ? campaigns.avg_influencers_per_campaign.toFixed(1) : "—", icon: "users", loading: loadK },
    { label: "Workspaces ativos", value: formatNumber(campaigns?.workspaces_with_active_campaigns), icon: "grid", hint: "Com campanhas ativas agora", loading: loadK },
    { label: "Rascunho → ativo", value: formatPercent(campaigns?.draft_to_active_rate), icon: "refresh", loading: loadK },
    { label: "Pago a criadores", value: formatBRL(financial?.paid_to_creators), icon: "banknote", loading: loadF },
    { label: "Aportado por clientes", value: formatBRL(financial?.total_deposits), icon: "wallet", loading: loadF },
    { label: "Receita de taxas", value: formatBRL(financial?.platform_fees), icon: "chart", loading: loadF },
    { label: "Pagamentos pendentes", value: formatBRL(financial?.pending_payments), icon: "clock", hint: "Obrigação financeira aberta", loading: loadF },
  ];

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        <div className="head fade">
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <h1>Dashboard</h1>
            <p>
              Visão geral da plataforma: criadores, campanhas e dinheiro em
              movimento.
            </p>
          </div>
          <div style={{ flex: "0 0 auto", maxWidth: "100%" }}>
            <AdminPeriodFilter
              period={period}
              preset={preset}
              onChange={handlePeriodChange}
            />
          </div>
        </div>

        <div className="adx-bd fade">
          <div className="adx-kg">
            <AdminKpiCard index={0} icon="lock" label="Saldo em custódia" value={formatBRL(financial?.custody_balance)} hint="Em tempo real" isLoading={loadF} />
            <AdminKpiCard index={1} icon="trend" label="Volume movimentado" value={formatBRL(financial?.total_volume_in_period)} hint="No período" isLoading={loadF} />
            <AdminKpiCard index={2} icon="users" label="Criadores" value={formatNumber(creators?.total)} hint={`+${formatNumber(creators?.new_in_period ?? 0)} no período`} isLoading={loadC} />
            <AdminKpiCard index={3} icon="mega" label="Campanhas ativas" value={formatNumber(campaigns?.active)} hint={`${formatNumber(campaigns?.created_in_period ?? 0)} criadas`} isLoading={loadK} />
          </div>

          <div className="adx-cd adx-big">
            <div className="adx-ch-h">
              <div>
                <h3>{chart === "vol" ? "Volume movimentado" : "Campanhas criadas"}</h3>
                <small>{chartTotal} no período</small>
              </div>
              <AdminSeg className="adx-sg" items={CHARTS} value={chart} onChange={setChart} />
            </div>
            {chart === "vol" ? (
              <AdminBarChart points={volPts} money isLoading={financialStats.isLoading} isError={financialStats.isError} />
            ) : (
              <AdminBarChart points={campPts} isLoading={campaignsStats.isLoading} isError={campaignsStats.isError} />
            )}
          </div>

          <div className="adx-g2">
            <div className="adx-cd">
              <div className="adx-ch-h">
                <div>
                  <h3>Nichos dos criadores</h3>
                  <small>Onde está a sua base</small>
                </div>
              </div>
              <AdminNicheChart data={nicheDist.data} isLoading={nicheDist.isLoading} isError={nicheDist.isError} />
            </div>
            <div className="adx-cd">
              <div className="adx-ch-h">
                <div>
                  <h3>Tamanho dos criadores</h3>
                  <small>Por número de seguidores</small>
                </div>
              </div>
              <AdminSizeChart data={sizeDist.data} isLoading={sizeDist.isLoading} isError={sizeDist.isError} />
            </div>
          </div>

          <div className="adx-g2 r">
            <AdminWorkspacesRanking
              data={ranking.data}
              isLoading={ranking.isLoading}
              isError={ranking.isError}
              sortBy={rankingSort}
              onSortChange={setRankingSort}
            />
            <div className="adx-cd">
              <div className="adx-ch-h">
                <div>
                  <h3>Saúde do negócio</h3>
                  <small>Indicadores de retenção e receita</small>
                </div>
              </div>
              <div className="adx-hl">
                {health.map((h, i) => (
                  <AdminSaasCard
                    key={h.name}
                    index={i}
                    name={h.name}
                    value={h.value}
                    description={h.description}
                    tone={h.tone}
                    isLoading={saasMetrics.isLoading}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="adx-kg">
            {extra.map((k, i) => (
              <AdminKpiCard key={k.label} index={i} icon={k.icon} label={k.label} value={k.value} hint={k.hint} isLoading={k.loading} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
