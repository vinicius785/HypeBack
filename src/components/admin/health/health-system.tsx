import type { ReactNode } from "react";

import {
  AdminBadge,
  AdminErrorState,
  AdminKeyValueList,
  AdminSection,
  AdminSkeleton,
  type AdminBadgeTone,
  type AdminKeyValueItem,
} from "@/components/admin/platform";
import { useAdminSystemHealth } from "@/hooks/admin/use-admin-health";
import { figureText, formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import type { AdminSystemHealth } from "@/shared/admin-platform.types";

import "@/styles/admin-health.css";

type ServiceStatus = AdminSystemHealth["database"]["status"] | AdminSystemHealth["redis"]["status"];

const SERVICE_LABEL: Record<ServiceStatus, string> = {
  ok: "Operando",
  down: "Fora do ar",
  disabled: "Desativado neste ambiente",
};

const SERVICE_TONE: Record<ServiceStatus, AdminBadgeTone> = { ok: "ok", down: "bad", disabled: "muted" };

function ServiceValue({ status }: { status: ServiceStatus }) {
  return <AdminBadge tone={SERVICE_TONE[status] ?? "muted"}>{SERVICE_LABEL[status] ?? status}</AdminBadge>;
}

function latencyHint(latencyMs: number | null): string {
  return latencyMs === null ? "Sem medição de latência" : `Latência de ${formatInt(latencyMs)} ms`;
}

/** "há 12,4 horas", "há 30 minutos": a idade do snapshot (o contrato manda em horas, com decimais). */
export function formatSnapshotAge(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `há ${formatInt(minutes)} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `há ${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${rounded === 1 ? "hora" : "horas"}`;
}

function systemItems(system: AdminSystemHealth): AdminKeyValueItem[] {
  const snapshot = system.metrics_snapshot;
  const age = formatSnapshotAge(snapshot.age_hours);
  return [
    { label: "Banco de dados", value: <ServiceValue status={system.database.status} />, hint: latencyHint(system.database.latency_ms) },
    {
      label: "Redis",
      value: <ServiceValue status={system.redis.status} />,
      hint: system.redis.status === "disabled" ? "Não é usado neste ambiente" : latencyHint(system.redis.latency_ms),
    },
    {
      label: "Snapshot de métricas",
      value: snapshot.last_computed_at ? formatDateTime(snapshot.last_computed_at) : "Nunca calculado",
      hint: age ? `Calculado ${age}` : undefined,
      definition: "Quando as métricas diárias do painel foram calculadas pela última vez. A idade é contada até agora.",
    },
    {
      label: "Jobs agendados",
      // O contrato manda `kind: 'unavailable'`: a tela diz "Não apurado" e explica; nunca inventa um estado.
      value: figureText(system.scheduled_jobs),
      definition: system.scheduled_jobs.definition,
    },
  ];
}

interface HealthSystemProps {
  /** "Agora" do relógio da tela (renova sozinho): faz o "verificado há…" andar. */
  now: number;
}

/** Sistema: banco, Redis, snapshot de métricas e jobs agendados (não apurado), com a hora da última verificação. */
export function HealthSystem({ now }: HealthSystemProps) {
  const query = useAdminSystemHealth();
  const system = query.data;

  let body: ReactNode;
  if (query.error && !system) {
    body = <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  } else if (!system) {
    body = (
      <div role="status">
        <span className="adm-sr">Carregando…</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="adm-health-sys-skeleton" key={index} aria-hidden="true">
            <AdminSkeleton height={13} width={120} />
            <AdminSkeleton height={20} width={`${28 + index * 6}%`} />
          </div>
        ))}
      </div>
    );
  } else {
    body = <AdminKeyValueList items={systemItems(system)} />;
  }

  return (
    <AdminSection
      title="Sistema"
      description={
        system ? (
          <>
            Verificado{" "}
            <time dateTime={system.checked_at} title={`${formatDateTime(system.checked_at)}, horário de São Paulo`}>
              {formatRelativeTime(system.checked_at, now)}
            </time>
            .
          </>
        ) : (
          "Banco de dados, Redis e o processo diário de métricas."
        )
      }
      className="adm-health-card"
    >
      {query.error && system ? <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}
      {body}
    </AdminSection>
  );
}
