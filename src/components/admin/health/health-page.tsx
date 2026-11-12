import { Fragment, useCallback, useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminListSkeleton,
  AdminPage,
  AdminPageHeader,
  AdminRefreshButton,
  AdminSection,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import {
  ADMIN_HEALTH_RESOURCE,
  useAdminHealthAlerts,
  useAdminSystemHealth,
  useHealthClock,
} from "@/hooks/admin/use-admin-health";
import { useAdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { ALERT_SEVERITY_LABEL } from "@/lib/admin/labels";

import { HealthAlertGroups, HealthSuggestionList } from "./health-alerts";
import { ALERT_SEVERITIES, HEALTH_FILTER_CONFIG, isAlertSeverity } from "./health-search";
import { HealthIsland } from "./health-island";
import { HealthSystem } from "./health-system";

import "@/styles/admin-health.css";

/** Só a gravidade: as seções "Alertas" e "Sugestões" já separam os tipos, então não há filtro de tipo. */
const FILTERS: readonly AdminFilterDef[] = [
  {
    kind: "pills",
    key: "severity",
    label: "Gravidade",
    inline: true,
    options: [{ value: "", label: "Todas" }, ...ALERT_SEVERITIES.map((severity) => ({ value: severity, label: ALERT_SEVERITY_LABEL[severity] }))],
  },
];

/**
 * O botão "Atualizar" só anuncia ("Atualizando…", "Atualizado") quando a pessoa clicou; a atualização automática de cada
 * minuto roda calada (`announce` do botão). O clique vale por um ciclo de consulta:
 * `waiting` (clicou, a consulta ainda não começou) → `running` → `ended` (terminou; o "Atualizado" ainda precisa ser
 * lido) → `idle` quando a próxima consulta começar (essa, sem clique, é a automática).
 */
type RefreshCycle = "idle" | "waiting" | "running" | "ended";

function useRequestedRefresh(fetching: boolean): { announce: boolean; request: () => void } {
  const [cycle, setCycle] = useState<RefreshCycle>("idle");
  useEffect(() => {
    setCycle((current) => {
      if (fetching) return current === "waiting" ? "running" : current === "ended" ? "idle" : current;
      return current === "running" ? "ended" : current;
    });
  }, [fetching]);
  const request = useCallback(() => setCycle("waiting"), []);
  return { announce: cycle === "waiting" || cycle === "running" || (cycle === "ended" && !fetching), request };
}

/** "Alertas · 3": título e contagem em texto simples (sem selo). Sem a primeira resposta, só o título. */
function sectionTitle(title: string, count: number | null): string {
  return count === null ? title : `${title} · ${formatInt(count)}`;
}

/**
 * Saúde da plataforma (`/admin/health`): o estado do sistema em faixa no topo, depois os alertas (fatos objetivos) e as
 * sugestões (heurísticas, visualmente mais discretas). A gravidade vai para a API e fica na URL; a regra exata, a origem
 * e os exemplos de cada um ficam recolhidos em "Como é calculado". A tela se atualiza sozinha a cada minuto (sem
 * anunciar nada a leitor de tela) e pelo botão de atualizar no fim da barra de filtros (esse sim anuncia o clique);
 * "Verificado há…" aparece uma vez, no cabeçalho.
 */
export function HealthPage({ embedded = false }: { embedded?: boolean } = {}) {
  const state = useAdminListQueryState(HEALTH_FILTER_CONFIG);
  const severity = isAlertSeverity(state.filters.severity) ? state.filters.severity : "";

  // `kind: ""`: sem filtro de tipo (a API devolve alertas e sugestões; a tela as separa em duas seções).
  const query = useAdminHealthAlerts({ kind: "", severity });
  const system = useAdminSystemHealth();
  const now = useHealthClock();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: adminKeys.resource(ADMIN_HEALTH_RESOURCE) }) > 0;
  const refresh = useRequestedRefresh(fetching);

  const loaded = query.data;
  const alerts = (loaded?.alerts ?? []).filter((item) => item.kind === "alert");
  const suggestions = (loaded?.alerts ?? []).filter((item) => item.kind === "suggestion");
  const severityLabel = severity ? ALERT_SEVERITY_LABEL[severity].toLowerCase() : "";
  // Quando o servidor calculou os alertas; se eles falharam, o instante da verificação do sistema.
  const checkedAt = loaded?.computedAt ?? system.data?.checked_at;

  const clearSeverity = () => state.setFilters({ severity: "" });
  const refreshNow = () => {
    refresh.request();
    void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_HEALTH_RESOURCE) });
  };
  const clearAction = (
    <button type="button" className="btn out adm-btn-sm" onClick={clearSeverity}>
      Limpar filtros
    </button>
  );

  const checked = checkedAt ? (
    <time dateTime={checkedAt} title={`${formatDateTime(checkedAt)}, horário de São Paulo`}>
      Verificado {formatRelativeTime(checkedAt, now)}
    </time>
  ) : undefined;
  // Dentro do Monitoramento o título e o cabeçalho são os da página que a hospeda.
  const Frame = embedded ? Fragment : AdminPage;

  return (
    <Frame>
      {embedded ? null : (
        <AdminPageHeader
          title="Saúde da plataforma"
          subtitle="Alertas e sugestões de atenção, e o estado dos sistemas que sustentam a plataforma."
          meta={checked}
        />
      )}

      {embedded ? (
        // No Monitoramento: a "ilha" no topo (estado do sistema, gravidade, verificado há…, atualizar) e a folha com o detalhe.
        <HealthIsland
          system={system}
          severity={severity}
          onSeverityChange={(value) => state.setFilters({ severity: value })}
          checked={checked}
          fetching={fetching}
          announce={refresh.announce}
          onRefresh={refreshNow}
        />
      ) : (
        <>
          <HealthSystem query={system} />

          <AdminFilterBar
            filters={FILTERS}
            values={{ severity }}
            onChange={(patch) => state.setFilters(patch as { severity?: string })}
            onClear={clearSeverity}
            trailing={<AdminRefreshButton iconOnly loading={fetching} announce={refresh.announce} onClick={refreshNow} />}
          />
        </>
      )}

      {query.error && !loaded ? (
        <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : (
        <>
          {query.error ? <AdminErrorState boxed compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}

          <AdminSection
            title={sectionTitle("Alertas", loaded ? alerts.length : null)}
            description="Fatos registrados no banco que pedem ação."
          >
            {!loaded ? (
              <AdminListSkeleton variant="alerts" rows={3} ariaLabel="Carregando alertas…" />
            ) : alerts.length > 0 ? (
              <HealthAlertGroups alerts={alerts} />
            ) : severity ? (
              <AdminEmptyState compact title={`Nenhum alerta de gravidade ${severityLabel}`} description="Tente outra gravidade." action={clearAction} />
            ) : (
              <AdminEmptyState compact title="Nenhum alerta ativo" description="As regras de alerta não encontraram nenhuma ocorrência na última verificação." />
            )}
          </AdminSection>

          <AdminSection
            title={sectionTitle("Sugestões", loaded ? suggestions.length : null)}
            description="Heurísticas com limite escolhido pelo produto; não são falhas confirmadas."
          >
            {!loaded ? (
              <AdminListSkeleton variant="alerts" rows={2} ariaLabel="Carregando sugestões…" />
            ) : suggestions.length > 0 ? (
              <HealthSuggestionList suggestions={suggestions} />
            ) : severity ? (
              <AdminEmptyState compact title={`Nenhuma sugestão de gravidade ${severityLabel}`} description="Tente outra gravidade." action={clearAction} />
            ) : (
              <AdminEmptyState compact title="Nenhuma sugestão agora" description="Nenhum dos limites de sugestão foi atingido na última verificação." />
            )}
          </AdminSection>
        </>
      )}
    </Frame>
  );
}
