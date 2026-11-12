import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminBadge,
  AdminErrorState,
  AdminInfoPopover,
  AdminKeyValueList,
  AdminListSkeleton,
  AdminSection,
  type AdminBadgeTone,
  type AdminKeyValueItem,
} from "@/components/admin/platform";
import { figureText, formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminSystemHealth } from "@/shared/admin-platform.types";

import "@/styles/admin-health.css";

type ServiceStatus = AdminSystemHealth["database"]["status"] | AdminSystemHealth["redis"]["status"];

const SERVICE_LABEL: Record<ServiceStatus, string> = {
  ok: "Operando",
  down: "Fora do ar",
  // Curto de propósito: a faixa tem colunas de ~160 px e o selo não quebra linha; o "neste ambiente" fica na linha de apoio.
  disabled: "Desativado",
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

export function systemItems(system: AdminSystemHealth): AdminKeyValueItem[] {
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
      // O "i" explica POR QUE não é apurado (não um cálculo): fica ao lado do valor, com nome acessível próprio.
      value: (
        <>
          {figureText(system.scheduled_jobs)}
          {system.scheduled_jobs.definition ? (
            <AdminInfoPopover triggerLabel="Por que os jobs agendados não são apurados">{system.scheduled_jobs.definition}</AdminInfoPopover>
          ) : null}
        </>
      ),
    },
  ];
}

/**
 * O resumo da faixa: vermelho dizendo quem caiu; senão verde, dizendo QUEM foi verificado. O selo só olha banco e Redis
 * (não os jobs nem o snapshot), então o texto nomeia os dois: "Banco e Redis operando". Redis desativado não é falha e
 * não é "operando": nesse caso o texto diz só "Banco de dados operando".
 */
export function overallStatus(system: AdminSystemHealth): { tone: AdminBadgeTone; text: string } {
  const down = [
    system.database.status === "down" ? "Banco de dados" : null,
    system.redis.status === "down" ? "Redis" : null,
  ].filter((name): name is string => name !== null);
  if (down.length > 0) return { tone: "bad", text: `Fora do ar: ${down.join(" e ")}` };

  const databaseOk = system.database.status === "ok";
  const redisOk = system.redis.status === "ok";
  if (databaseOk && redisOk) return { tone: "ok", text: "Banco e Redis operando" };
  if (databaseOk) return { tone: "ok", text: "Banco de dados operando" };
  if (redisOk) return { tone: "ok", text: "Redis operando" };
  return { tone: "ok", text: "Banco e Redis sem falhas" };
}

interface HealthSystemProps {
  /** A consulta do estado do sistema (a página a faz, porque o "verificado há…" do cabeçalho também a usa). */
  query: UseQueryResult<AdminSystemHealth, unknown>;
}

/**
 * Sistema, em faixa no TOPO da página (um banco fora do ar não pode ficar abaixo de listas longas): selo verde ou
 * vermelho com o resumo (só banco e Redis) e, embaixo, banco, Redis, snapshot de métricas e jobs agendados (não
 * apurado) numa `AdminKeyValueList` em faixa, um ao lado do outro. A hora da verificação NÃO se repete aqui: ela é
 * uma só, no cabeçalho.
 */
export function HealthSystem({ query }: HealthSystemProps) {
  const system = query.data;

  let body: ReactNode;
  if (query.error && !system) {
    body = <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  } else if (!system) {
    body = <AdminListSkeleton variant="strip" ariaLabel="Carregando o estado do sistema…" />;
  } else {
    body = <AdminKeyValueList layout="strip" items={systemItems(system)} />;
  }

  const status = system ? overallStatus(system) : null;
  return (
    <AdminSection
      title="Sistema"
      actions={status ? <AdminBadge tone={status.tone}>{status.text}</AdminBadge> : undefined}
    >
      {query.error && system ? <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}
      {body}
    </AdminSection>
  );
}
