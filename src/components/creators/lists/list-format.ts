import type { InfluencerProfile } from "@/shared/services/influencer";
import { isSocialNetworkType } from "@/shared/utils/group-creators";

/** "04/11/2026". Datas inválidas viram null (o texto some em vez de mostrar "Invalid Date"). */
export function fmtListDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Última atualização quando a API informa; senão a criação (nunca inventa data). */
export function listDateLabel(list: { created_at: string; updated_at?: string | null }): string | null {
  const updated = fmtListDate(list.updated_at);
  if (updated) return `Atualizada em ${updated}`;
  const created = fmtListDate(list.created_at);
  return created ? `Criada em ${created}` : null;
}

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const countLabel = (n: number) => `${n} ${n === 1 ? "criador" : "criadores"}`;

export interface MemberStats {
  /** Conta com mais seguidores (redes sociais; UGC não conta). */
  primary: InfluencerProfile | null;
  /** Soma dos seguidores das redes sociais. */
  followers: number;
  /** Tipos de rede distintos do criador. */
  networks: string[];
}

export function memberStats(profiles: InfluencerProfile[] | undefined): MemberStats {
  const social = (profiles ?? []).filter((p) => isSocialNetworkType(p.type));
  const sorted = [...social].sort((a, b) => (b.members || 0) - (a.members || 0));
  return {
    primary: sorted[0] ?? null,
    followers: social.reduce((sum, p) => sum + (p.members || 0), 0),
    networks: [...new Set(social.map((p) => p.type.toLowerCase()))],
  };
}

export type MemberSort = "added" | "name" | "followers";

export const MEMBER_SORTS: Array<[MemberSort, string]> = [
  ["added", "Adicionados recentemente"],
  ["name", "Nome (A–Z)"],
  ["followers", "Seguidores (maior)"],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface Row {
  id: number;
  name: string;
  email?: string;
}

/** Busca por nome, e-mail e @ de qualquer rede; ordenação estável (empate mantém a ordem original). */
export function filterAndSortMembers<T extends Row>(
  members: T[],
  stats: Map<number, MemberStats>,
  query: string,
  sort: MemberSort,
  handles: (m: T) => string[] = () => [],
): T[] {
  const q = norm(query).replace(/^@/, "");
  const filtered = q
    ? members.filter((m) => [m.name, m.email ?? "", ...handles(m)].some((t) => norm(t).includes(q)))
    : members;
  if (sort === "added") return filtered;
  const idx = new Map(filtered.map((m, i) => [m.id, i]));
  return [...filtered].sort((a, b) => {
    const c =
      sort === "name"
        ? norm(a.name).localeCompare(norm(b.name), "pt-BR")
        : (stats.get(b.id)?.followers ?? 0) - (stats.get(a.id)?.followers ?? 0);
    return c || (idx.get(a.id)! - idx.get(b.id)!);
  });
}
