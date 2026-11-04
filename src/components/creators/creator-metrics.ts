/**
 * Formatação das métricas do catálogo de criadores. Regra única para cartões e lista: número sempre formatado, e nada
 * de inventar valor — sem dado confiável, a métrica não aparece.
 */

const trim1 = (v: number) => v.toFixed(1).replace(/\.0$/, "").replace(".", ",");

/** Seguidores: `268`, `1,2 mil`, `22 mil`, `150 mil`, `1,3 mi`. Arredonda sem virar `1000 mil`. */
export function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${trim1(n / 1_000_000)} mi`;
  if (n >= 1_000) {
    const k = n / 1_000;
    if (k >= 999.5) return "1 mi";
    return `${k >= 100 ? Math.round(k) : trim1(k)} mil`;
  }
  return String(Math.round(n));
}

/** `null` quando a rede não tem audiência registrada (0 ou ausente): o cartão mostra "sem dados", não "0". */
export function followersLabel(members: number | null | undefined): string | null {
  return typeof members === "number" && Number.isFinite(members) && members > 0 ? fmtFollowers(members) : null;
}

/**
 * Engajamento só é mostrado quando é confiável: há audiência, o valor existe, é maior que zero e cabe em 0–100%.
 * `0,0%` costuma ser "ainda não medido" e valores acima de 100% (ex.: `5814,3%` em conta de 14 seguidores) são ruído de
 * cálculo; nos dois casos o certo é não exibir.
 */
export function engagementLabel(members: number | null | undefined, engagement: number | null | undefined): string | null {
  if (typeof engagement !== "number" || !Number.isFinite(engagement)) return null;
  if (!members || members <= 0) return null;
  if (engagement <= 0 || engagement > 100) return null;
  return `${trim1(engagement)}%`;
}

export function fmtDistance(km: number): string {
  return `${km >= 10 ? Math.round(km) : km.toFixed(1).replace(".", ",")} km`;
}

/** Até `max` categorias visíveis e o resto como `+N`. */
export function splitCategories(labels: string[], max = 2): { shown: string[]; extra: number } {
  return { shown: labels.slice(0, max), extra: Math.max(0, labels.length - max) };
}
