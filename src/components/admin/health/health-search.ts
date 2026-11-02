/**
 * Filtros da Saúde da plataforma na URL (`/admin/health?kind=suggestion&severity=warning`): o tipo (alerta ou
 * sugestão) e a gravidade, os mesmos nomes do contrato (`GET /admin/health/alerts?kind=&severity=`).
 */
import type { AdminListStateConfig } from "@/lib/admin/list-query";
import type { AdminAlertKind, AdminAlertSeverity } from "@/shared/admin-platform.types";

export const ALERT_KINDS = ["alert", "suggestion"] as const satisfies readonly AdminAlertKind[];
/** Da mais grave para a menos grave: é a ordem dos grupos na tela. */
export const ALERT_SEVERITIES = ["critical", "warning", "info"] as const satisfies readonly AdminAlertSeverity[];

export const HEALTH_FILTER_CONFIG = {
  filterKeys: ["kind", "severity"],
} as const satisfies AdminListStateConfig<"kind" | "severity">;

export function isAlertKind(value: unknown): value is AdminAlertKind {
  return typeof value === "string" && (ALERT_KINDS as readonly string[]).includes(value);
}

export function isAlertSeverity(value: unknown): value is AdminAlertSeverity {
  return typeof value === "string" && (ALERT_SEVERITIES as readonly string[]).includes(value);
}

export type HealthSearch = {
  kind?: AdminAlertKind;
  severity?: AdminAlertSeverity;
};

/** `validateSearch` da rota: só os filtros válidos. */
export function validateHealthSearch(raw: Record<string, unknown>): HealthSearch {
  const out: HealthSearch = {};
  if (isAlertKind(raw.kind)) out.kind = raw.kind;
  if (isAlertSeverity(raw.severity)) out.severity = raw.severity;
  return out;
}
