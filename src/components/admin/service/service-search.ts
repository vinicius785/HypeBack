/** As quatro filas do Atendimento (a ilha escolhe uma): `?fila=requests`. Suporte ativos é o padrão e não vai para a URL. */
export const SERVICE_QUEUES = ["support", "support-done", "requests", "requests-done"] as const;
export type ServiceQueue = (typeof SERVICE_QUEUES)[number];
export const DEFAULT_SERVICE_QUEUE: ServiceQueue = "support";

/** `validateSearch` da rota: só uma fila conhecida passa (a barra de endereço é entrada de usuário). */
export function validateServiceSearch(raw: Record<string, unknown>): { fila?: ServiceQueue } {
  const fila = raw.fila;
  return typeof fila === "string" && (SERVICE_QUEUES as readonly string[]).includes(fila) ? { fila: fila as ServiceQueue } : {};
}
