import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminErrorState, AdminIsland, AdminKeyValueList, AdminListSkeleton, type AdminFilterOption } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { ALERT_SEVERITY_LABEL } from "@/lib/admin/labels";
import type { AdminAlertSeverity, AdminSystemHealth } from "@/shared/admin-platform.types";

import { ALERT_SEVERITIES } from "./health-search";
import { systemItems } from "./health-system";

import "@/styles/admin-health.css";

const SEVERITY_TONE: Record<AdminAlertSeverity, "bad" | "warn" | undefined> = { critical: "bad", warning: "warn", info: undefined };

const SEVERITY_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todas" },
  ...ALERT_SEVERITIES.map((severity) => ({ value: severity, label: ALERT_SEVERITY_LABEL[severity] })),
];

type ServiceStatus = AdminSystemHealth["database"]["status"] | AdminSystemHealth["redis"]["status"];

const SERVICE_TEXT: Record<ServiceStatus, string> = { ok: "operando", down: "fora do ar", disabled: "desativado" };

/** Um serviço na pílula: o nome e três bolinhas que pulsam em sequência (verde operando, vermelho fora do ar, cinza parado). */
function ServicePulse({ name, status }: { name: string; status: ServiceStatus | undefined }) {
  const text = status ? (SERVICE_TEXT[status] ?? status) : "verificando";
  return (
    <span className="isl-svc" data-state={status ?? "checking"} role="status" aria-label={`${name}: ${text}`}>
      <b>{name}</b>
      <span className="isl-svc-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

interface HealthIslandProps {
  system: UseQueryResult<AdminSystemHealth, unknown>;
  /** Gravidade escolhida (`""` = todas). */
  severity: string;
  onSeverityChange: (severity: string) => void;
  /** "Verificado há 1 minuto" (já com o `<time>`), ou nada enquanto não há verificação. */
  checked?: ReactNode;
  fetching: boolean;
  /** Anuncia "Atualizando…" só quando a pessoa clicou (a atualização automática é calada). */
  announce: boolean;
  onRefresh: () => void;
}

/**
 * "Ilha" (padrão Dynamic Island do Gerenciamento) do Monitoramento: no topo, uma pílula preta com
 * o filtro de gravidade à esquerda e, à direita, Banco e Redis com bolinhas animadas (verde operando, vermelho fora do ar), "verificado há…" e o botão de atualizar. Aberta (seta),
 * revela por baixo a folha branca com banco, Redis, snapshot de métricas e jobs agendados.
 */
export function HealthIsland({ system, severity, onSeverityChange, checked, fetching, announce, onRefresh }: HealthIslandProps) {
  const data = system.data;

  let sheet: ReactNode;
  if (system.error && !data) {
    sheet = <AdminErrorState compact error={system.error} onRetry={() => void system.refetch()} retrying={system.isFetching} />;
  } else if (!data) {
    sheet = <AdminListSkeleton variant="strip" ariaLabel="Carregando o estado do sistema…" />;
  } else {
    sheet = <AdminKeyValueList layout="strip" items={systemItems(data)} />;
  }

  return (
    <AdminIsland
      ariaLabel="Estado da plataforma"
      className="isl-h-w"
      sheetLabel="Estado do sistema"
      chevronLabel={{ open: "Abrir o estado do sistema", close: "Fechar o estado do sistema" }}
      start={
        <div className="isl-segs" role="group" aria-label="Gravidade">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className="isl-seg"
              data-tone={SEVERITY_TONE[option.value as AdminAlertSeverity]}
              aria-pressed={option.value === severity}
              onClick={() => onSeverityChange(option.value)}
            >
              <i aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      }
      end={
        <>
          <div className="isl-live" role="group" aria-label="Serviços">
            <ServicePulse name="Banco" status={data?.database.status} />
            <ServicePulse name="Redis" status={data?.redis.status} />
          </div>
          <span className="isl-meta">{checked}</span>
          <button type="button" className="isl-ib isl-refresh" data-busy={fetching ? "true" : undefined} aria-label="Atualizar" disabled={fetching} onClick={onRefresh}>
            <I n="refresh" cls="sm" />
          </button>
          <span className="adm-sr" role="status" aria-live="polite">
            {announce ? (fetching ? "Atualizando…" : "Atualizado") : ""}
          </span>
        </>
      }
      sheet={sheet}
    />
  );
}
