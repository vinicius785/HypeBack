/**
 * Filtro da Saúde da plataforma na URL (`/admin/health?severity=warning`): a gravidade, o mesmo nome do contrato
 * (`GET /admin/health/alerts?severity=`). Não há filtro de tipo: as seções "Alertas" e "Sugestões" já separam os dois,
 * e um `?kind=` antigo que ainda esteja num link é ignorado (a consulta sai sem ele).
 */
import type { AdminListStateConfig } from "@/lib/admin/list-query";
import type { AdminAlertSeverity } from "@/shared/admin-platform.types";

/** Da mais grave para a menos grave: é a ordem dos grupos na tela. */
export const ALERT_SEVERITIES = ["critical", "warning", "info"] as const satisfies readonly AdminAlertSeverity[];

export const HEALTH_FILTER_CONFIG = {
  filterKeys: ["severity"],
} as const satisfies AdminListStateConfig<"severity">;

export function isAlertSeverity(value: unknown): value is AdminAlertSeverity {
  return typeof value === "string" && (ALERT_SEVERITIES as readonly string[]).includes(value);
}

export type HealthSearch = {
  severity?: AdminAlertSeverity;
};

/** `validateSearch` da rota: só a gravidade, e só se for válida (o resto não vira filtro). */
export function validateHealthSearch(raw: Record<string, unknown>): HealthSearch {
  const out: HealthSearch = {};
  if (isAlertSeverity(raw.severity)) out.severity = raw.severity;
  return out;
}
