import type { CSSProperties } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminErrorState, AdminFigureCard, AdminInfoPopover, AdminSection } from "@/components/admin/platform";
import type { AdminDateRange, AdminOverview } from "@/shared/admin-platform.types";

import { buildDashboardAreas, type DashboardArea, type DashboardHint } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

interface DashboardStatAreasProps {
  overview: UseQueryResult<AdminOverview, unknown>;
  period: AdminDateRange;
}

function HintText({ hint }: { hint: DashboardHint }) {
  return (
    <span className="adm-dash-hint">
      {hint.text}
      {hint.label && hint.definition ? <AdminInfoPopover label={hint.label}>{hint.definition}</AdminInfoPopover> : null}
    </span>
  );
}

interface StatAreaProps {
  area: DashboardArea;
  /** Primeira carga: todo número é esqueleto. */
  loading: boolean;
  /** Período novo carregando (os números do anterior seguem na tela): só os que dependem do período viram esqueleto. */
  periodLoading: boolean;
}

/** Um painel (cartão branco) com a faixa de números do assunto. Cada número é um `AdminFigureCard` que leva à sua lista. */
function StatArea({ area, loading, periodLoading }: StatAreaProps) {
  const style = {
    "--c-lg": area.columns.lg,
    "--c-md": area.columns.md,
    "--c-sm": area.columns.sm,
  } as CSSProperties;

  return (
    <AdminSection title={area.title} description={area.description}>
      <div className="adm-dash-strip" style={style}>
        {area.stats.map((stat) => {
          const hint = stat.hint && !(stat.hint.periodic && periodLoading) ? <HintText hint={stat.hint} /> : undefined;
          return (
            <AdminFigureCard
              key={stat.id}
              variant="plain"
              label={stat.label}
              figure={stat.figure}
              to={stat.to}
              hint={hint}
              loading={loading || (periodLoading && stat.periodic === true)}
            />
          );
        })}
      </div>
    </AdminSection>
  );
}

/**
 * Os painéis de números do Dashboard (clientes, usuários, criadores, campanhas, dinheiro), todos de UMA consulta
 * (`/admin/overview`): carregando mostra os mesmos painéis em esqueleto (a tela não pula de tamanho), falha mostra um
 * só estado de erro com "Tentar de novo" (ou "recurso indisponível" se o servidor ainda não tem a rota).
 */
export function DashboardStatAreas({ overview, period }: DashboardStatAreasProps) {
  const { data, isPending, isError, isPlaceholderData, isFetching, error, refetch } = overview;

  if (isError && !data) {
    return (
      <AdminSection title="Números da plataforma">
        <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </AdminSection>
    );
  }

  const areas = buildDashboardAreas(data, period);
  const loading = isPending && !data;
  const periodLoading = isPlaceholderData;

  return (
    <>
      <StatArea area={areas.workspaces} loading={loading} periodLoading={periodLoading} />
      <div className="adm-dash-row">
        <StatArea area={areas.users} loading={loading} periodLoading={periodLoading} />
        <StatArea area={areas.creators} loading={loading} periodLoading={periodLoading} />
      </div>
      <StatArea area={areas.campaigns} loading={loading} periodLoading={periodLoading} />
      <StatArea area={areas.financial} loading={loading} periodLoading={periodLoading} />
    </>
  );
}
