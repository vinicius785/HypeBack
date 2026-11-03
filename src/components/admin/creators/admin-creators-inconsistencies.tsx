import { useMemo } from "react";

import {
  AdminAlertItem,
  AdminEmptyState,
  AdminErrorState,
  AdminListSkeleton,
  AdminRefreshButton,
  AdminSection,
  type AdminAlertLike,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { useAdminCreatorInconsistencies } from "@/hooks/admin/use-admin-creators";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminInconsistency } from "@/shared/admin-platform.types";

import { campaignTarget, workspaceTarget } from "./admin-creators-cells";

import "@/styles/admin-creators.css";

type Sample = NonNullable<AdminAlertLike["samples"]>[number];

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

/**
 * O item do contrato como o `AdminAlertItem` do kit o entende. Inconsistência não tem gravidade, regra nem origem
 * (o servidor não manda), então só tipo, título, descrição, contagem e exemplos aparecem. Quando há mais ocorrências
 * que exemplos, a descrição diz quantos exemplos estão à mostra (o kit ainda não tem esse aviso).
 */
function toAlert(item: AdminInconsistency): AdminAlertLike {
  const hidden = item.count - item.samples.length;
  const shown =
    hidden > 0 && item.samples.length > 0
      ? ` Mostrando ${formatInt(item.samples.length)} de ${formatInt(item.count)} exemplos.`
      : "";
  return {
    title: item.title,
    kind: item.kind,
    description: `${item.description}${shown}`,
    count: item.count,
    samples: item.samples,
  };
}

/**
 * Aba "Inconsistências": o que o servidor achou de estranho na base (cadastros, e-mails repetidos, dinheiro sem
 * campanha…). Cada item diz se é um alerta (fato guardado no banco) ou uma sugestão (heurística) e mostra alguns
 * exemplos. Só leitura; o botão de atualizar (ícone, no canto da seção) apenas refaz a consulta.
 */
export function AdminCreatorsInconsistencies() {
  const query = useAdminCreatorInconsistencies();
  const items = useMemo(() => alertsFirst(query.data?.items ?? []), [query.data]);
  const computedAt = query.data?.computedAt;
  const hasItems = items.length > 0;

  return (
    <AdminSection
      title="Alertas e sugestões"
      description={
        <>
          Alerta é um fato objetivo guardado no banco; sugestão é uma heurística e pode não ser um problema.
          {computedAt ? <> Calculado em {formatDateTime(computedAt)}.</> : null}
        </>
      }
      actions={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
    >
      {query.isLoading ? (
        <AdminListSkeleton variant="alerts" rows={3} ariaLabel="Carregando inconsistências…" />
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
          {query.error ? <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}
          <div className="adm-alerts">
            {items.map((item) => (
              <AdminAlertItem key={item.code} alert={toAlert(item)} sampleLink={sampleTarget} />
            ))}
          </div>
        </>
      )}
    </AdminSection>
  );
}
