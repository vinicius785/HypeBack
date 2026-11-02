import { AdminPage, AdminPageHeader } from "@/components/admin/platform";
import {
  useAdminDashboardAlerts,
  useAdminOverview,
  useAdminRecentActivity,
} from "@/hooks/admin/use-admin-overview";
import { formatDateTime } from "@/lib/admin/format";

import { DashboardActivity } from "./dashboard-activity";
import { DashboardAttention } from "./dashboard-attention";
import { DashboardPeriodSelector } from "./dashboard-period-selector";
import { DashboardStatAreas } from "./dashboard-stat-areas";
import { useDashboardPeriod } from "./use-dashboard-period";

import "@/styles/admin-dashboard.css";

/**
 * Dashboard do Admin da plataforma ("Visão geral"): quantos clientes, quais estão ativos ou parados, quantos
 * usuários, quanto dinheiro se move, quais campanhas rodam e o que precisa de atenção.
 *
 * Três consultas independentes (números, alertas, atividade): uma que falha mostra o seu próprio erro sem derrubar as
 * outras. Só os números seguem o período escolhido (em dias de São Paulo, na URL); alertas e atividade são o "agora".
 */
export function AdminDashboardPage() {
  const { period, today, selectPreset, setCustomRange } = useDashboardPeriod();
  const overview = useAdminOverview(period);
  const alerts = useAdminDashboardAlerts();
  const activity = useAdminRecentActivity();

  const generatedAt = overview.data?.generated_at;

  return (
    <AdminPage className="adm-dash">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Saúde da plataforma em um relance."
        meta={generatedAt ? <span>Atualizado em {formatDateTime(generatedAt)}</span> : undefined}
        actions={
          <DashboardPeriodSelector
            period={period}
            today={today}
            onSelectPreset={selectPreset}
            onChangeRange={setCustomRange}
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
