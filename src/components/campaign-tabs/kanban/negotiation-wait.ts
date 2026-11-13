import type { ExtendedInfluencer } from "../management-kanban-config";

/** Colunas de negociação de valor: o tempo de espera por resposta fica à vista. */
export const NEGOTIATION_COLUMNS = ["price_countered", "price_proposed"];

/** A partir de quantos dias sem resposta o cartão ganha a etiqueta âmbar e a vermelha. */
export const WAIT_WARN_DAYS = 7;
export const WAIT_ALERT_DAYS = 21;

const DAY_MS = 86_400_000;

export const isNegotiationColumn = (columnId: string) => NEGOTIATION_COLUMNS.includes(columnId);

/**
 * Dias desde a última mudança de status, do `statusHistory` que já vem da API (o histórico entra em ordem cronológica). Sem
 * histórico, ou com data inválida, não há como saber: devolve `undefined` e a tela não mostra nada.
 */
export function waitDays(inf: Pick<ExtendedInfluencer, "statusHistory">, now: number = Date.now()): number | undefined {
  const history = inf.statusHistory;
  if (!history?.length) return undefined;
  const last = history
    .map((h) => new Date(h.timestamp).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  if (last === undefined) return undefined;
  return Math.max(0, Math.floor((now - last) / DAY_MS));
}

/** `none` até 6 dias, `warn` (âmbar) a partir de 7, `alert` (vermelha) a partir de 21. */
export function waitTone(days: number | undefined): "none" | "warn" | "alert" {
  if (days === undefined || days < WAIT_WARN_DAYS) return "none";
  return days >= WAIT_ALERT_DAYS ? "alert" : "warn";
}

export const waitText = (days: number) => `há ${days} ${days === 1 ? "dia" : "dias"}`;
export const waitBadgeText = (days: number) => `Aguardando há ${days} ${days === 1 ? "dia" : "dias"}`;

/** Do mais antigo para o mais novo (quem espera há mais tempo no topo); sem histórico vai para o fim, na ordem em que veio. */
export function sortByWait<T extends Pick<ExtendedInfluencer, "statusHistory">>(list: readonly T[], now: number = Date.now()): T[] {
  return list
    .map((inf, index) => ({ inf, index, days: waitDays(inf, now) }))
    .sort((a, b) => {
      if (a.days === undefined && b.days === undefined) return a.index - b.index;
      if (a.days === undefined) return 1;
      if (b.days === undefined) return -1;
      return b.days - a.days || a.index - b.index;
    })
    .map((entry) => entry.inf);
}

/** Resumo do cabeçalho da coluna: total e quantos esperam há 7 dias ou mais. */
export function waitSummary(list: readonly Pick<ExtendedInfluencer, "statusHistory">[], now: number = Date.now()): { total: number; overdue: number } {
  return { total: list.length, overdue: list.filter((inf) => (waitDays(inf, now) ?? 0) >= WAIT_WARN_DAYS).length };
}
