import { describe, expect, it } from "vitest";

import type { AgencyBrand } from "@/shared/services/agency-brands";

import {
  DEFAULT_BRAND_FILTERS,
  brandStats,
  countActiveBrandFilters,
  filterBrands,
  hasBrandCriteria,
  sortBrands,
} from "./brand-list";

const mk = (id: string, name: string, status: "active" | "archived", n: number, created = "2026-11-01T00:00:00Z", description: string | null = null): AgencyBrand => ({
  id, name, photo: null, description, niche_id: null, legal_name: null, tax_id: null, postal_code: null, street: null, street_number: null, unit: null, neighborhood: null, city: null, state: null, status, campaigns_count: n, created_at: created,
});

const brands = [
  mk("1", "Acme", "active", 3, "2026-11-03T00:00:00Z", "Cosméticos"),
  mk("2", "Árvore Verde", "active", 0, "2026-10-01T00:00:00Z"),
  mk("3", "Beta Moda", "active", 1, "2026-11-02T00:00:00Z", "Roupas e acessórios"),
  mk("4", "Velha", "archived", 2),
];

describe("filtros de marcas", () => {
  it("padrão: só as ativas, em ordem alfabética (com acento)", () => {
    const out = sortBrands(filterBrands(brands, "", DEFAULT_BRAND_FILTERS), "name_asc");
    expect(out.map((b) => b.name)).toEqual(["Acme", "Árvore Verde", "Beta Moda"]);
  });

  it("status: arquivadas e todas", () => {
    expect(filterBrands(brands, "", { ...DEFAULT_BRAND_FILTERS, status: "archived" }).map((b) => b.id)).toEqual(["4"]);
    expect(filterBrands(brands, "", { ...DEFAULT_BRAND_FILTERS, status: "all" })).toHaveLength(4);
  });

  it("campanhas: com e sem", () => {
    expect(filterBrands(brands, "", { ...DEFAULT_BRAND_FILTERS, campaigns: "with" }).map((b) => b.id)).toEqual(["1", "3"]);
    expect(filterBrands(brands, "", { ...DEFAULT_BRAND_FILTERS, campaigns: "without" }).map((b) => b.id)).toEqual(["2"]);
  });

  it("busca ignora acento e caixa, e olha nome e descrição", () => {
    expect(filterBrands(brands, "arvore", DEFAULT_BRAND_FILTERS).map((b) => b.id)).toEqual(["2"]);
    expect(filterBrands(brands, "ROUPAS", DEFAULT_BRAND_FILTERS).map((b) => b.id)).toEqual(["3"]);
    expect(filterBrands(brands, "zzz", DEFAULT_BRAND_FILTERS)).toEqual([]);
  });

  it("filtros combinados", () => {
    const f = { ...DEFAULT_BRAND_FILTERS, status: "all" as const, campaigns: "with" as const };
    expect(filterBrands(brands, "", f).map((b) => b.id)).toEqual(["1", "3", "4"]);
  });
});

describe("ordenação", () => {
  it("Z–A, mais campanhas e mais recentes", () => {
    expect(sortBrands(brands, "name_desc").map((b) => b.id)).toEqual(["4", "3", "2", "1"]);
    expect(sortBrands(brands, "campaigns").map((b) => b.id)).toEqual(["1", "4", "3", "2"]);
    expect(sortBrands(brands, "recent").map((b) => b.id)).toEqual(["1", "3", "4", "2"]);
  });

  it("não altera a lista original", () => {
    const copy = [...brands];
    sortBrands(brands, "name_desc");
    expect(brands).toEqual(copy);
  });
});

describe("indicadores e critérios", () => {
  it("contam dos dados reais; campanhas só entre as ativas", () => {
    expect(brandStats(brands)).toEqual({ active: 3, archived: 1, withCampaigns: 2, withoutCampaigns: 1 });
    expect(brandStats([])).toEqual({ active: 0, archived: 0, withCampaigns: 0, withoutCampaigns: 0 });
  });

  it("conta filtros fora do padrão (ordenação não conta)", () => {
    expect(countActiveBrandFilters(DEFAULT_BRAND_FILTERS)).toBe(0);
    expect(countActiveBrandFilters({ status: "archived", campaigns: "with", sort: "recent" })).toBe(2);
    expect(countActiveBrandFilters({ ...DEFAULT_BRAND_FILTERS, sort: "recent" })).toBe(0);
  });

  it("há critério com busca ou filtro", () => {
    expect(hasBrandCriteria("", DEFAULT_BRAND_FILTERS)).toBe(false);
    expect(hasBrandCriteria(" a ", DEFAULT_BRAND_FILTERS)).toBe(true);
    expect(hasBrandCriteria("", { ...DEFAULT_BRAND_FILTERS, status: "all" })).toBe(true);
  });
});
