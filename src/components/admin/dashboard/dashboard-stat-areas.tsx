import type { CSSProperties } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminErrorState, AdminFigureCard, AdminSection } from "@/components/admin/platform";
import type { AdminDateRange, AdminOverview } from "@/shared/admin-platform.types";

import { buildDashboardAreas, type DashboardArea, type DashboardHint } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

interface DashboardStatAreasProps {
  overview: UseQueryResult<AdminOverview, unknown>;
  period: AdminDateRange;
}

/**
 * A definição do número que o texto de apoio cita ("Novos clientes no período"): entra no "i" do rótulo, como mais um
 * parágrafo (`hintInfo`), em vez de o apoio ter um segundo "i". O nome do número vai na frente, porque o "i" é de outro.
 */
function hintDefinition(hint: DashboardHint) {
  if (!hint.label || !hint.definition) return undefined;
  return (
    <>
      <strong>{hint.label}:</strong> {hint.definition}
    </>
  );
}

interface StatAreaProps {
  area: DashboardArea;
  /** Primeira carga: todo número é esqueleto. */
  loading: boolean;
  /** Período novo carregando (os números do anterior seguem na tela): só os que dependem do período viram esqueleto. */
  periodLoading: boolean;
}

/**
 * Um painel (cartão branco) com a faixa de números do assunto, só com o título. Cada número é um `AdminFigureCard` que
 * leva à sua lista; o tipo (Realizado, Posição atual…) e a regra vivem no "i" do rótulo, não no corpo.
 */
function StatArea({ area, loading, periodLoading }: StatAreaProps) {
  const style = {
    "--c-lg": area.columns.lg,
    "--c-md": area.columns.md,
    "--c-sm": area.columns.sm,
  } as CSSProperties;

  return (
    <AdminSection title={area.title}>
      <div className="adm-dash-strip" style={style}>
        {area.stats.map((stat) => {
          const hint = stat.hint && !(stat.hint.periodic && periodLoading) ? stat.hint : undefined;
          return (
            <AdminFigureCard
              key={stat.id}
              variant="plain"
              label={stat.label}
              figure={stat.figure}
              to={stat.to}
              showKind={false}
              hint={hint?.text}
              hintInfo={hint ? hintDefinition(hint) : undefined}
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
