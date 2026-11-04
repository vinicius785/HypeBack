import type { AgencyBrand } from "@/shared/services/agency-brands";

/**
 * Busca, filtros, ordenação e indicadores da página Marcas. Tudo sobre a lista que a página já carregou (sem chamada
 * nova), no mesmo desenho da página Clientes: o padrão mostra só o que está em operação.
 */

export type BrandStatusFilter = "active" | "archived" | "all";
export type BrandCampaignFilter = "all" | "with" | "without";
export type BrandSort = "name_asc" | "name_desc" | "campaigns" | "recent";

export interface BrandFilters {
  status: BrandStatusFilter;
  campaigns: BrandCampaignFilter;
  sort: BrandSort;
}

export const DEFAULT_BRAND_FILTERS: BrandFilters = { status: "active", campaigns: "all", sort: "name_asc" };

export const BRAND_STATUS_LABEL: Record<BrandStatusFilter, string> = { active: "Ativas", archived: "Arquivadas", all: "Todas" };
export const BRAND_CAMPAIGN_LABEL: Record<BrandCampaignFilter, string> = { all: "Todas", with: "Com campanhas", without: "Sem campanhas" };
export const BRAND_SORT_LABEL: Record<BrandSort, string> = {
  name_asc: "Nome (A–Z)",
  name_desc: "Nome (Z–A)",
  campaigns: "Mais campanhas",
  recent: "Mais recentes",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Quantos filtros (fora a ordenação) estão fora do padrão. */
export function countActiveBrandFilters(f: BrandFilters): number {
  return (f.status !== DEFAULT_BRAND_FILTERS.status ? 1 : 0) + (f.campaigns !== DEFAULT_BRAND_FILTERS.campaigns ? 1 : 0);
}

export function hasBrandCriteria(query: string, f: BrandFilters): boolean {
  return query.trim().length > 0 || countActiveBrandFilters(f) > 0;
}

export function filterBrands(brands: AgencyBrand[], query: string, f: BrandFilters): AgencyBrand[] {
  const needle = norm(query);
  return brands.filter((b) => {
    if (f.status !== "all" && b.status !== f.status) return false;
    if (f.campaigns === "with" && b.campaigns_count <= 0) return false;
    if (f.campaigns === "without" && b.campaigns_count > 0) return false;
    if (needle && !norm(b.name).includes(needle) && !norm(b.description ?? "").includes(needle)) return false;
    return true;
  });
}

export function sortBrands(brands: AgencyBrand[], sort: BrandSort): AgencyBrand[] {
  const byName = (a: AgencyBrand, b: AgencyBrand) => a.name.localeCompare(b.name, "pt-BR");
  const out = [...brands];
  switch (sort) {
    case "name_desc":
      return out.sort((a, b) => byName(b, a));
    case "campaigns":
      return out.sort((a, b) => b.campaigns_count - a.campaigns_count || byName(a, b));
    case "recent":
      return out.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || byName(a, b));
    default:
      return out.sort(byName);
  }
}

export interface BrandStats {
  active: number;
  archived: number;
  /** Entre as ativas. */
  withCampaigns: number;
  /** Entre as ativas. */
  withoutCampaigns: number;
}

/** Números da faixa de indicadores, calculados só dos dados reais. Campanhas contam entre as marcas ativas. */
export function brandStats(brands: AgencyBrand[]): BrandStats {
  const active = brands.filter((b) => b.status === "active");
  const withCampaigns = active.filter((b) => b.campaigns_count > 0).length;
  return {
    active: active.length,
    archived: brands.length - active.length,
    withCampaigns,
    withoutCampaigns: active.length - withCampaigns,
  };
}
