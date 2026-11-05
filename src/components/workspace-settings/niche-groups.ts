import type { Niche } from "@/shared/types";

export interface NicheGroup {
  /** Nicho "pai" (ou null no grupo dos que não têm filhos nem pai). */
  parent: Niche | null;
  label: string;
  /** Itens selecionáveis do grupo, na ordem da API (o próprio pai vem primeiro quando tem filhos). */
  items: Niche[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Agrupa os nichos pela hierarquia da API (`parent_id`). Todo nicho continua selecionável, inclusive os "pais".
 * Quem não tem pai nem filhos entra no grupo "Outros nichos"; filho cujo pai não veio na lista também.
 */
export function groupNiches(niches: Niche[]): NicheGroup[] {
  const ids = new Set(niches.map((n) => String(n.id)));
  const kids = new Map<string, Niche[]>();
  for (const n of niches) {
    if (n.parent_id == null) continue;
    const key = String(n.parent_id);
    if (!ids.has(key)) continue;
    kids.set(key, [...(kids.get(key) ?? []), n]);
  }
  const groups: NicheGroup[] = [];
  const loose: Niche[] = [];
  for (const n of niches) {
    const children = kids.get(String(n.id));
    if (n.parent_id == null && children?.length) groups.push({ parent: n, label: n.name, items: [n, ...children] });
    else if (n.parent_id == null || !ids.has(String(n.parent_id))) loose.push(n);
  }
  if (loose.length) groups.push({ parent: null, label: "Outros nichos", items: loose });
  return groups;
}

/** Filtra os grupos pela busca (sem acento/caixa): fica o grupo se o nome dele ou algum item combina. */
export function filterNicheGroups(groups: NicheGroup[], query: string): NicheGroup[] {
  const q = norm(query);
  if (!q) return groups;
  return groups
    .map((g) => {
      const groupHit = norm(g.label).includes(q);
      const items = groupHit ? g.items : g.items.filter((n) => norm(n.name).includes(q));
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
}
