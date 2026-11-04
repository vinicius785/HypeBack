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
