import { describe, it, expect } from "vitest";
import {
  splitNicheNames,
  resolveNicheDisplayName,
  extractNicheFromApiRow,
} from "./niche-display";

describe("splitNicheNames", () => {
  it("retorna vazio para rótulo ausente", () => {
    expect(splitNicheNames(null)).toEqual([]);
    expect(splitNicheNames(undefined)).toEqual([]);
    expect(splitNicheNames("")).toEqual([]);
    expect(splitNicheNames("  ,  , ")).toEqual([]);
  });

  it("separa nicho principal e sub-nichos preservando a ordem da API", () => {
    expect(splitNicheNames("Moda, Beleza, Skincare")).toEqual([
      "Moda",
      "Beleza",
      "Skincare",
    ]);
  });

  it("remove espaços e entradas vazias", () => {
    expect(splitNicheNames("  Moda ,, Beleza  ")).toEqual(["Moda", "Beleza"]);
  });

  it("deduplica ignorando caixa, mantendo a primeira grafia", () => {
    expect(splitNicheNames("Moda, moda, MODA, Beleza")).toEqual([
      "Moda",
      "Beleza",
    ]);
  });

  it("aceita um único nicho sem vírgula", () => {
    expect(splitNicheNames("Games")).toEqual(["Games"]);
  });
});

describe("splitNicheNames + resolveNicheDisplayName (caminho das abas)", () => {
  // O backend manda `niche` como rótulo único já legível
  // (applyNicheDisplayLabelsToInfluencers): principal primeiro, sub-nichos depois.
  const niches = [
    { id: 1, name: "Moda" },
    { id: 2, name: "Beleza" },
  ];

  it("divide o rótulo vindo da API em nicho + sub-nichos", () => {
    const label = resolveNicheDisplayName("Moda, Beleza, Skincare", niches);
    expect(splitNicheNames(label)).toEqual(["Moda", "Beleza", "Skincare"]);
  });

  it("resolve id numérico contra GET /niches antes de dividir", () => {
    const label = resolveNicheDisplayName("2", niches);
    expect(splitNicheNames(label)).toEqual(["Beleza"]);
  });

  it("prioriza o nome explícito quando a API envia niche_name", () => {
    const label = resolveNicheDisplayName("1", niches, "Fitness, Corrida");
    expect(splitNicheNames(label)).toEqual(["Fitness", "Corrida"]);
  });

  it("sem nicho nenhum, não produz chips", () => {
    const label = resolveNicheDisplayName("", niches);
    expect(splitNicheNames(label)).toEqual([]);
  });
});

describe("extractNicheFromApiRow", () => {
  it("lê o rótulo de nichos enviado em `niche` como string", () => {
    expect(extractNicheFromApiRow({ niche: "Moda, Beleza" })).toEqual({
      niche: "Moda, Beleza",
      nicheName: undefined,
    });
  });

  it("lê objeto aninhado {id, name}", () => {
    expect(extractNicheFromApiRow({ niche: { id: 7, name: "Games" } })).toEqual({
      niche: "7",
      nicheName: "Games",
    });
  });

  it("niche_id tem precedência sobre niche na identificação", () => {
    const out = extractNicheFromApiRow({ niche: "Moda", niche_id: 3 });
    expect(out.niche).toBe("3");
  });
});
