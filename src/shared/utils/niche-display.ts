/** Entrada mínima da lista de nichos (GET /niches ou equivalente). */
export type NicheForDisplay = { id: number | string; name: string };

function findNicheNameInList(
  idStr: string,
  niches: NicheForDisplay[],
): string | undefined {
  const trimmed = idStr.trim();
  if (!trimmed) return undefined;
  const byStr = niches.find((n) => String(n.id) === trimmed);
  if (byStr?.name) return byStr.name;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    const byNum = niches.find((n) => Number(n.id) === num);
    if (byNum?.name) return byNum.name;
  }
  return undefined;
}

/**
 * Resolve rótulo para exibição: nome explícito (API), depois GET /niches para o id principal
 * e ids alternativos, senão o id bruto.
 */
export function resolveNicheDisplayName(
  nicheId: string,
  niches: NicheForDisplay[],
  explicitName?: string | null,
  alternateIds?: readonly number[],
): string | null {
  const label = explicitName?.trim();
  if (label) return label;

  const tryOrder = [
    nicheId?.trim() ?? "",
    ...((alternateIds ?? []).map((n) => String(n)) as string[]),
  ].filter(Boolean);

  for (const id of tryOrder) {
    const name = findNicheNameInList(id, niches);
    if (name) return name;
  }

  const fallback = tryOrder[0];
  return fallback || null;
}

/**
 * Para payloads só com `niche_ids` (seleção de influenciadores): tenta cada id na lista GET /niches.
 */
export function resolveNicheDisplayNameFromIds(
  nicheIds: readonly number[],
  niches: NicheForDisplay[],
  explicitName?: string | null,
): string | null {
  if (explicitName?.trim()) return explicitName.trim();
  for (const id of nicheIds) {
    if (!Number.isFinite(id)) continue;
    const name = findNicheNameInList(String(id), niches);
    if (name) return name;
  }
  if (nicheIds.length > 0) return String(nicheIds[0]);
  return null;
}

/**
 * A API manda os nichos do criador como um rótulo único ("Moda, Beleza, Skincare"
 * — principal primeiro, depois os sub-nichos). Divide em nomes limpos e únicos,
 * preservando a ordem original.
 */
export function splitNicheNames(
  label: string | null | undefined,
): string[] {
  if (!label) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of label.split(",")) {
    const v = part.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Interpreta campos comuns da API (`niche`, `niche_id`, `niche_name`, objeto aninhado). */
export function extractNicheFromApiRow(raw: Record<string, unknown>): {
  niche: string;
  nicheName?: string;
} {
  let niche = "";
  let nicheName: string | undefined;

  const nn = raw.niche_name ?? raw.nicheName;
  if (typeof nn === "string" && nn.trim()) nicheName = nn.trim();

  const n = raw.niche;
  if (n != null && typeof n === "object" && !Array.isArray(n)) {
    const o = n as Record<string, unknown>;
    if (o.id != null) niche = String(o.id);
    const on = o.name;
    if (typeof on === "string" && on.trim()) {
      nicheName = nicheName ?? on.trim();
    }
  } else if (n != null && String(n).trim() !== "") {
    niche = String(n);
  }

  const nid = raw.niche_id ?? raw.nicheId;
  if (nid != null && String(nid).trim() !== "") {
    niche = String(nid);
  }

  return { niche, nicheName };
}
