import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_HEALTH_RESOURCE, useAdminHealthAlerts, useHealthClock } from "@/hooks/admin/use-admin-health";
import { useAdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { ALERT_SEVERITY_LABEL } from "@/lib/admin/labels";

import { HealthAlertGroups, HealthSkeleton, HealthSuggestionList } from "./health-alerts";
import { ALERT_SEVERITIES, HEALTH_FILTER_CONFIG, isAlertKind, isAlertSeverity } from "./health-search";
import { HealthSystem } from "./health-system";

import "@/styles/admin-health.css";

const FILTERS: readonly AdminFilterDef[] = [
  {
    kind: "pills",
    key: "kind",
    label: "Tipo",
    options: [
      { value: "", label: "Todos" },
      { value: "alert", label: "Alertas" },
      { value: "suggestion", label: "Sugestões" },
    ],
  },
  {
    kind: "pills",
    key: "severity",
    label: "Gravidade",
    options: [{ value: "", label: "Todas" }, ...ALERT_SEVERITIES.map((severity) => ({ value: severity, label: ALERT_SEVERITY_LABEL[severity] }))],
  },
];

function SectionTitle({ title, count }: { title: string; count: number | null }) {
  return (
    <>
      {title}
      {count !== null ? <span className="adm-health-total">{formatInt(count)}</span> : null}
    </>
  );
}

/**
 * Saúde da plataforma (`/admin/health`): alertas (fatos objetivos, com a regra exata), sugestões (heurísticas,
 * com o limite à vista e visualmente mais discretas) e o estado do sistema. Tipo e gravidade vão para a API e
 * ficam na URL; a tela se atualiza sozinha a cada minuto e pelo botão "Atualizar".
 */
export function HealthPage() {
  const state = useAdminListQueryState(HEALTH_FILTER_CONFIG);
  const kind = isAlertKind(state.filters.kind) ? state.filters.kind : "";
  const severity = isAlertSeverity(state.filters.severity) ? state.filters.severity : "";

  const query = useAdminHealthAlerts({ kind, severity });
  const now = useHealthClock();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: adminKeys.resource(ADMIN_HEALTH_RESOURCE) }) > 0;

  const loaded = query.data;
  const alerts = (loaded?.alerts ?? []).filter((item) => item.kind === "alert");
  const suggestions = (loaded?.alerts ?? []).filter((item) => item.kind === "suggestion");
  const severityLabel = severity ? ALERT_SEVERITY_LABEL[severity].toLowerCase() : "";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Saúde da plataforma"
        subtitle="Alertas e sugestões de atenção, e o estado dos sistemas que sustentam a plataforma."
        actions={
          <>
            {loaded?.computedAt ? (
              <span className="adm-health-checked" role="status">
                <time dateTime={loaded.computedAt} title={`${formatDateTime(loaded.computedAt)}, horário de São Paulo`}>
                  Verificado {formatRelativeTime(loaded.computedAt, now)}
                </time>
              </span>
            ) : null}
            <button
              type="button"
              className="btn out adm-btn-sm adm-health-refresh"
              disabled={fetching}
              aria-busy={fetching ? true : undefined}
              onClick={() => void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_HEALTH_RESOURCE) })}
            >
              <I n="refresh" cls="sm" />
              {fetching ? "Atualizando…" : "Atualizar"}
            </button>
          </>
        }
      />

      <AdminFilterBar
        filters={FILTERS}
        values={{ kind, severity }}
        onChange={(patch) => state.setFilters(patch as { kind?: string; severity?: string })}
        onClear={() => state.setFilters({ kind: "", severity: "" })}
      />

      {query.error && !loaded ? (
        <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : (
        <>
          {query.error ? <AdminErrorState boxed compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}

          <AdminSection
            title={<SectionTitle title="Alertas" count={loaded ? alerts.length : null} />}
            description="Fatos objetivos guardados no banco que pedem ação. Cada alerta mostra a regra exata usada para encontrá-lo."
            className="adm-health-card"
          >
            {!loaded ? (
              <HealthSkeleton />
            ) : alerts.length > 0 ? (
              <HealthAlertGroups alerts={alerts} />
            ) : kind === "suggestion" ? (
              <AdminEmptyState compact title="Alertas ocultos pelo filtro" description="O filtro de tipo está em “Sugestões”." />
            ) : severity ? (
              <AdminEmptyState compact title={`Nenhum alerta de gravidade ${severityLabel}`} description="Tente outra gravidade ou limpe o filtro." />
            ) : (
              <AdminEmptyState compact title="Nenhum alerta ativo" description="As regras de alerta não encontraram nenhuma ocorrência na última verificação." />
            )}
          </AdminSection>

          <AdminSection
            title={<SectionTitle title="Sugestões" count={loaded ? suggestions.length : null} />}
            description="Heurísticas com limite escolhido pelo produto (por exemplo, 30 dias sem atividade). Não são falhas confirmadas: servem para priorizar um contato ou uma revisão."
            className="adm-health-card adm-health-card-quiet"
          >
            {!loaded ? (
              <HealthSkeleton rows={2} />
            ) : suggestions.length > 0 ? (
              <HealthSuggestionList suggestions={suggestions} />
            ) : kind === "alert" ? (
              <AdminEmptyState compact title="Sugestões ocultas pelo filtro" description="O filtro de tipo está em “Alertas”." />
            ) : severity ? (
              <AdminEmptyState compact title={`Nenhuma sugestão de gravidade ${severityLabel}`} description="Tente outra gravidade ou limpe o filtro." />
            ) : (
              <AdminEmptyState compact title="Nenhuma sugestão agora" description="Nenhum dos limites de sugestão foi atingido na última verificação." />
            )}
          </AdminSection>
        </>
      )}

      <HealthSystem now={now} />
    </AdminPage>
  );
}
