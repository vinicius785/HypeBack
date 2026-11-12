import {
  ADMIN_PERIOD_CUSTOM,
  AdminInfoPopover,
  AdminPage,
  AdminPageHeader,
  AdminPeriodSelect,
  type AdminPeriodChange,
  type AdminPeriodPresetOption,
} from "@/components/admin/platform";
import {
  useAdminDashboardAlerts,
  useAdminOverview,
  useAdminRecentActivity,
} from "@/hooks/admin/use-admin-overview";
import { formatDateTime } from "@/lib/admin/format";
import { formatPeriodRange, MAX_PERIOD_DAYS, PERIOD_LABEL, PERIOD_PRESETS, type AdminPeriodChoice } from "@/lib/admin/period";

import { DashboardActivity } from "./dashboard-activity";
import { DashboardAttention } from "./dashboard-attention";
import { DashboardNewsIsland } from "./dashboard-news-island";
import { dashboardPeriodRule } from "./dashboard-model";
import { DashboardStatAreas } from "./dashboard-stat-areas";
import { useDashboardPeriod } from "./use-dashboard-period";

import "@/styles/admin-dashboard.css";

const PERIOD_PRESET_OPTIONS: readonly AdminPeriodPresetOption[] = PERIOD_PRESETS.map((id) => ({ id, label: PERIOD_LABEL[id] }));

/**
 * Dashboard do Admin da plataforma ("Visão geral"): quantos clientes, quais estão ativos ou parados, quantos
 * usuários, quanto dinheiro se move, quais campanhas rodam e o que precisa de atenção.
 *
 * Três consultas independentes (números, alertas, atividade): uma que falha mostra o seu próprio erro sem derrubar as
 * outras. Só os números seguem o período escolhido (em dias de São Paulo, na URL); alertas e atividade são o "agora".
 *
 * O seletor é o `AdminPeriodSelect` do kit, só apresentação: as regras do período (dias de São Paulo, até hoje, no
 * máximo 366 dias) ficam em `useDashboardPeriod`. A linha de apoio sob o seletor junta o intervalo, o fuso e quando os
 * números foram calculados; o "i" dela diz quais números seguem o período e quais são a posição de agora.
 */
export function AdminDashboardPage() {
  const { period, today, selectPreset, setCustomRange } = useDashboardPeriod();
  const overview = useAdminOverview(period);
  const alerts = useAdminDashboardAlerts();
  const activity = useAdminRecentActivity();

  const generatedAt = overview.data?.generated_at;

  const custom = period.preset === ADMIN_PERIOD_CUSTOM;

  // Adaptador fino: o seletor só emite intervalos válidos; quem aplica (e grava na URL) é o hook.
  const changePeriod = (next: AdminPeriodChange) => {
    if (next.preset !== ADMIN_PERIOD_CUSTOM) {
      selectPreset(next.preset as AdminPeriodChoice);
    } else if (!custom) {
      // Abrir o "Personalizado": começa pelos dias que a pessoa já via.
      selectPreset("custom");
    } else if (next.from && next.to) {
      setCustomRange({ from: next.from, to: next.to });
    }
  };

  return (
    <AdminPage className="adm-dash">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Saúde da plataforma em um relance."
      />

      {/* A ilha vai de ponta a ponta: anuncia a última novidade e leva o controle de período. */}
      <DashboardNewsIsland
        activity={activity.data?.data}
        controls={
          <AdminPeriodSelect
            compact
            presets={PERIOD_PRESET_OPTIONS}
            value={{ preset: period.preset, from: period.from, to: period.to }}
            onChange={changePeriod}
            custom={{ max: today, maxDays: MAX_PERIOD_DAYS }}
            summary={
              <>
                {custom ? `Dias de São Paulo · até ${MAX_PERIOD_DAYS} dias` : `${formatPeriodRange(period)} · Dias de São Paulo`}
                {generatedAt ? ` · Atualizado em ${formatDateTime(generatedAt)}` : null}
                <AdminInfoPopover triggerLabel="Como ler o período">
                  {dashboardPeriodRule(overview.data?.activity_window_days).map((line) => (
                    <AdminInfoPopover.Paragraph key={line}>{line}</AdminInfoPopover.Paragraph>
                  ))}
                </AdminInfoPopover>
              </>
            }
          />
        }
      />

      <DashboardStatAreas overview={overview} period={period} />

      <div className="adm-dash-split">
        <DashboardAttention query={alerts} />
        <DashboardActivity query={activity} />
      </div>
    </AdminPage>
  );
}
