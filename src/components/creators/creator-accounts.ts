import { useMemo } from "react";

import { useInfluencerAccounts } from "@/hooks/use-influencer-accounts";
import type { CatalogSocialNetwork } from "@/shared/services/creators-catalog";
import { isSocialNetworkType, type CreatorGroup } from "@/shared/utils/group-creators";

export const NET_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  ugc: "UGC",
};

export const netLabel = (sn: CatalogSocialNetwork) => NET_LABEL[sn.type] ?? (sn.name || sn.type || "Rede");

/** Foto do criador: a do usuário, ou a da primeira conta de rede que tiver uma. */
export const groupPhoto = (g: CreatorGroup) =>
  g.user.photo ?? g.accounts.find((a) => a.social_network.photo)?.social_network.photo ?? undefined;

export const NET_ICON: Record<string, string> = {
  instagram: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
};

export interface AccountRow {
  id: string;
  type: string;
  label: string;
  username: string;
  members: number;
  engagement: number | null;
}

/**
 * Contas do criador para o cartão. Começa com as que o catálogo já trouxe e,
 * assim que a lista completa chega (endpoint de perfis, com cache), passa a
 * mostrar todas — a paginação do catálogo é por conta, não por pessoa.
 */
export function useAccountRows(group: CreatorGroup): { networks: AccountRow[]; ugc: boolean } {
  const { data } = useInfluencerAccounts(group.user.id);
  return useMemo(() => {
    let rows: AccountRow[];
    if (data && data.length > 0) {
      rows = [...data]
        .sort((a, b) => b.members - a.members)
        .map((p) => {
          const fromCatalog = group.accounts.find((a) => String(a.social_network.id) === p.id)?.social_network;
          return {
            id: p.id,
            type: p.type.toLowerCase(),
            label: NET_LABEL[p.type.toLowerCase()] ?? (p.type_label || p.type),
            username: p.username,
            members: p.members || fromCatalog?.members || 0,
            engagement: p.engagement_percent ?? fromCatalog?.engagement_percent ?? null,
          };
        });
    } else {
      rows = group.accounts.map(({ social_network: sn }) => ({
        id: String(sn.id),
        type: sn.type,
        label: netLabel(sn),
        username: sn.username,
        members: sn.members,
        engagement: sn.engagement_percent,
      }));
    }
    // UGC é tipo de conteúdo: vira uma etiqueta, não uma linha de rede social.
    return { networks: rows.filter((r) => isSocialNetworkType(r.type)), ugc: rows.some((r) => !isSocialNetworkType(r.type)) };
  }, [data, group.accounts]);
}

