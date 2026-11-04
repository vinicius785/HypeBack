/**
 * Busca de cidades brasileiras (nome → ponto central + raio) para o filtro "Cidade" dos criadores.
 * Usa o Nominatim (OpenStreetMap); só o texto digitado sai do navegador.
 */
export interface CityPlace {
  /** "Ribeirão Preto, São Paulo" */
  label: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Raio sugerido (km), um dos valores de `RADIUS_CHOICES`, cobrindo a cidade. */
  radiusKm: number;
}

export const RADIUS_CHOICES = [10, 25, 50, 100, 200];

const EARTH_KM = 6371;

/** Raio (km) do centro até o canto do retângulo da cidade, arredondado para a opção de raio seguinte. */
export function radiusForBoundingBox(box: [number, number, number, number]): number {
  const [south, north, west, east] = box;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const dLat = ((north - south) * Math.PI) / 180;
  const dLng = ((east - west) * Math.PI) / 180;
  const halfH = (dLat * EARTH_KM) / 2;
  const halfW = (dLng * EARTH_KM * Math.cos(midLat)) / 2;
  const half = Math.hypot(halfH, halfW);
  return RADIUS_CHOICES.find((r) => r >= half) ?? RADIUS_CHOICES[RADIUS_CHOICES.length - 1];
}

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
  addresstype?: string;
  boundingbox?: string[];
  address?: { city?: string; town?: string; municipality?: string; village?: string; state?: string };
}

const CITY_TYPES = new Set(["city", "town", "municipality", "village", "city_district"]);

export function parseCityResults(items: NominatimItem[]): CityPlace[] {
  const seen = new Set<string>();
  const out: CityPlace[] = [];
  for (const it of items) {
    if (it.addresstype && !CITY_TYPES.has(it.addresstype)) continue;
    const lat = Number(it.lat);
    const lng = Number(it.lon);
    const name = it.name || it.address?.city || it.address?.town || it.address?.municipality || it.address?.village;
    const state = it.address?.state;
    if (!name || !state || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label = `${name}, ${state}`;
    if (seen.has(label)) continue;
    seen.add(label);
    const bb = it.boundingbox?.map(Number);
    const radiusKm =
      bb && bb.length === 4 && bb.every(Number.isFinite)
        ? radiusForBoundingBox([bb[0], bb[1], bb[2], bb[3]])
        : 25;
    out.push({ label, name, state, lat, lng, radiusKm });
  }
  return out;
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<CityPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Não foi possível buscar cidades agora.");
  return parseCityResults((await res.json()) as NominatimItem[]).slice(0, 5);
}
