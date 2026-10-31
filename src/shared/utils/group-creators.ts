import type { CatalogItem, CatalogNiche, CatalogUser } from "@/shared/services/creators-catalog";

/**
 * Uma pessoa (criador) e as contas de rede social dela que vieram no catálogo.
 *
 * O catálogo (`GET /influencers`) devolve uma linha por CONTA de rede social,
 * cada uma já com o `user` dono dela. O vínculo conta → pessoa é o `user.id`
 * que a própria API entrega; é o único critério usado. Nome, foto, @ ou
 * qualquer semelhança NUNCA agrupam: sem `user.id` igual, as contas ficam em
 * cartões separados.
 */
export interface CreatorGroup {
  /** `user.id` como texto: chave de seleção e de lista. */
  key: string;
  user: CatalogUser;
  /** Contas carregadas deste criador, da maior para a menor audiência. */
  accounts: CatalogItem[];
  /** União (sem repetir) dos nichos de todas as contas. */
  niches: CatalogNiche[];
  /** Menor distância entre as contas (só existe no filtro "perto de mim"). */
  distance_km: number | null;
}

/** UGC é um tipo de conteúdo (conta "UGC" no cadastro), não uma rede social. */
export const isSocialNetworkType = (type: string) => type.trim().toLowerCase() !== "ugc";

export const hasUgcAccount = (group: CreatorGroup) =>
  group.accounts.some((a) => !isSocialNetworkType(a.social_network.type));

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/**
 * O backend devolve contas de quem excluiu o cadastro com este nome no lugar do
 * nome real (não há campo próprio). Elas não devem aparecer para convite.
 */
export const isDeletedUser = (user: CatalogUser) => normalizeName(user.name) === "usuario excluido";

export function groupCreators(items: CatalogItem[]): CreatorGroup[] {
  const groups = new Map<number, CreatorGroup>();

  for (const item of items) {
    if (isDeletedUser(item.user)) continue;
    const id = item.user.id;
    let group = groups.get(id);
    if (!group) {
      group = { key: String(id), user: item.user, accounts: [], niches: [], distance_km: null };
      groups.set(id, group);
    }

    if (!group.accounts.some((a) => a.social_network.id === item.social_network.id)) {
      group.accounts.push(item);
    }
    if (!group.user.photo && item.user.photo) group.user = item.user;

    for (const niche of item.niches) {
      if (!group.niches.some((n) => n.id === niche.id)) group.niches.push(niche);
    }

    if (item.distance_km != null) {
      group.distance_km =
        group.distance_km == null ? item.distance_km : Math.min(group.distance_km, item.distance_km);
    }
  }

  const list = [...groups.values()];
  for (const g of list) {
    g.accounts.sort((a, b) => b.social_network.members - a.social_network.members);
  }
  // A ordem dos grupos é a da primeira aparição: preserva a ordenação do servidor.
  return list;
}
