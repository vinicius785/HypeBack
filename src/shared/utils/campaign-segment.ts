import { parseCityKey } from "@/shared/data/brazilian-states-cities";
import type { CatalogFilters } from "@/shared/services/catalog";

/** Lista guardada no formulário como texto separado por vírgula ("SP,RJ"). Vazio vira lista vazia. */
export const splitCsv = (s: string | undefined | null): string[] =>
  s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];

/** Gêneros do público-alvo: o formulário guarda "all" (ou vazio) para "sem filtro" e "male,female" para mais de um. */
export const gendersOf = (g: string | undefined | null): string[] => splitCsv(g).filter((x) => x !== "all");
export const gendersToForm = (list: readonly string[]): string => (list.length > 0 ? list.join(",") : "all");

/** Teto de consultas para somar o potencial de várias combinações (acima disso, cai na estimativa). */
export const MAX_POTENTIAL_QUERIES = 12;

/**
 * Filtros do catálogo para calcular o potencial com VÁRIOS estados, cidades e gêneros: o catálogo só filtra um valor de
 * cada vez, então uma consulta por combinação e o chamador soma (um criador mora em um único lugar e tem um gênero,
 * então as combinações não se sobrepõem). Estado com cidades escolhidas conta só essas cidades; estado sem cidade conta inteiro.
 * `null` quando passa de `MAX_POTENTIAL_QUERIES` (o chamador usa a estimativa).
 */
export function catalogFilterSets(input: {
  genders: readonly string[];
  minFollowers?: number;
  states: readonly string[];
  cities: readonly string[];
}): CatalogFilters[] | null {
  const base: CatalogFilters = {};
  if (input.minFollowers && input.minFollowers > 0) base.followers_min = input.minFollowers;

  const places: Array<{ state?: string; city?: string }> = [];
  const parsedCities = input.cities.map((k) => parseCityKey(k)).filter((c): c is { name: string; state: string } => !!c);
  for (const uf of input.states) {
    const own = parsedCities.filter((c) => c.state === uf);
    if (own.length > 0) for (const c of own) places.push({ state: uf, city: c.name });
    else places.push({ state: uf });
  }
  if (places.length === 0) places.push({});

  const genders: Array<string | undefined> = input.genders.length > 0 ? [...input.genders] : [undefined];
  if (places.length * genders.length > MAX_POTENTIAL_QUERIES) return null;

  const sets: CatalogFilters[] = [];
  for (const p of places) {
    for (const g of genders) {
      sets.push({ ...base, ...(p.state ? { state: p.state } : {}), ...(p.city ? { city: p.city } : {}), ...(g ? { gender: g } : {}) });
    }
  }
  return sets;
}
