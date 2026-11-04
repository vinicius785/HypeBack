import type { CampaignBrand } from "@/components/campaign-card";

/**
 * Marca que o cartão de campanha mostra: em agência, a da própria campanha (nome e logo); sem marca na campanha (ou
 * fora de agência), o workspace. Sem isso, todos os cartões levavam a foto da agência.
 */
export function campaignBrand(
  campaign: { brand?: { name: string; photo?: string | null } | null },
  workspace?: CampaignBrand,
): CampaignBrand | undefined {
  const b = campaign.brand;
  return b?.name ? { name: b.name, photo: b.photo ?? undefined } : workspace;
}

type ListedBrand = { id: string; name: string; photo?: string | null } | null | undefined;

/**
 * Marca de cada campanha da lista (id da campanha → marca). O Início monta as linhas a partir do endpoint de métricas,
 * que não traz a marca; ela é buscada aqui, na lista de campanhas, que a traz.
 */
export function brandsByCampaignId(campaigns: Array<{ id: string; brand?: ListedBrand }>): Map<string, NonNullable<ListedBrand>> {
  const map = new Map<string, NonNullable<ListedBrand>>();
  for (const c of campaigns) if (c.brand?.name) map.set(c.id, c.brand);
  return map;
}
