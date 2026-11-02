import { useMemo } from "react";

import { I } from "@/components/prototype/ui";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { useAdminCreatorInconsistencies } from "@/hooks/admin/use-admin-creators";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminInconsistency } from "@/shared/admin-platform.types";

import { campaignTarget, workspaceTarget } from "./admin-creators-cells";
import { INCONSISTENCY_KIND_HELP, INCONSISTENCY_KIND_LABEL } from "./creator-labels";

import "@/styles/admin-creators.css";

type Sample = AdminInconsistency["samples"][number];

/** Só leva a uma tela quem tem uma: workspace e campanha. O resto (lançamento, grupo, usuário) é texto. */
function sampleTarget(sample: Sample): AdminLinkTarget | undefined {
  const id = String(sample.id);
  if (sample.type === "workspace") return workspaceTarget(id);
  if (sample.type === "campaign") return campaignTarget(id);
  return undefined;
}

/** Alertas objetivos primeiro, sugestões depois; dentro de cada grupo vale a ordem do servidor. */
function alertsFirst(items: readonly AdminInconsistency[]): AdminInconsistency[] {
  return [...items.filter((item) => item.kind === "alert"), ...items.filter((item) => item.kind !== "alert")];
}

function InconsistencyItem({ item }: { item: AdminInconsistency }) {
  const hidden = item.count - item.samples.length;
  return (
    <article className="adm-creators-inc" aria-label={item.title}>
      <div className="adm-creators-inc-main">
        <AdminStatusBadge
          kind="alert-kind"
          value={item.kind}
          size="sm"
          label={INCONSISTENCY_KIND_LABEL[item.kind]}
          title={INCONSISTENCY_KIND_HELP[item.kind]}
        />
        <h3>{item.title}</h3>
        <p className="adm-creators-inc-desc">{item.description}</p>
      </div>
      <div className="adm-creators-inc-count">
        <b>{formatInt(item.count)}</b>
        <small>{item.count === 1 ? "ocorrência" : "ocorrências"}</small>
      </div>
      {item.samples.length > 0 ? (
        <div className="adm-creators-inc-samples">
          <span>Exemplos:</span>
          <ul>
            {item.samples.map((sample) => {
              const target = sampleTarget(sample);
              return (
                <li key={`${sample.type}:${sample.id}`}>
                  {target ? (
                    <AdminLink to={target} className="adm-creators-inc-sample">
                      {sample.label}
                    </AdminLink>
                  ) : (
                    <span className="adm-creators-inc-sample">{sample.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {hidden > 0 ? (
            <small>
              Mostrando {formatInt(item.samples.length)} de {formatInt(item.count)}
            </small>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function InconsistenciesSkeleton() {
  return (
    <div className="adm-creators-incs" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="adm-creators-inc">
          <div className="adm-creators-inc-main">
            <AdminSkeleton width={104} height={22} radius={999} />
            <div className="adm-creators-inc-sk">
              <AdminSkeleton width="52%" height={16} />
              <AdminSkeletonLines lines={2} lastWidth="70%" />
            </div>
          </div>
          <AdminSkeleton width={40} height={28} />
        </div>
      ))}
    </div>
  );
}

/**
 * Aba "Inconsistências": o que o servidor achou de estranho na base (cadastros, e-mails repetidos, dinheiro sem
 * campanha…). Cada item diz se é um alerta objetivo (fato guardado no banco) ou uma sugestão (heurística) e mostra
 * alguns exemplos. Só leitura; "Atualizar" apenas refaz a consulta.
 */
export function AdminCreatorsInconsistencies() {
  const query = useAdminCreatorInconsistencies();
  const items = useMemo(() => alertsFirst(query.data?.items ?? []), [query.data]);
  const computedAt = query.data?.computedAt;
  const hasItems = items.length > 0;

  return (
    <div className="adm-creators-panel">
      <AdminSection
        title="Inconsistências"
        description={
          <>
            Alerta objetivo é um fato guardado no banco; sugestão é uma heurística e pode não ser um problema.
            {computedAt ? <> Calculado em {formatDateTime(computedAt)}.</> : null}
          </>
        }
        actions={
          <button
            type="button"
            className="btn out adm-btn-sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <I n="refresh" cls="sm" />
            {query.isFetching ? "Atualizando…" : "Atualizar"}
          </button>
        }
      >
        {query.isLoading ? (
          <>
            <span className="adm-sr" role="status">
              Carregando…
            </span>
            <InconsistenciesSkeleton />
          </>
        ) : query.error && !hasItems ? (
          <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !hasItems ? (
          <AdminEmptyState
            compact
            title="Nenhuma inconsistência encontrada"
            description="O servidor não encontrou nenhuma inconsistência agora."
          />
        ) : (
          <>
            {query.error ? <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} /> : null}
            <div className="adm-creators-incs">
              {items.map((item) => (
                <InconsistencyItem key={item.code} item={item} />
              ))}
            </div>
          </>
        )}
      </AdminSection>
    </div>
  );
}
