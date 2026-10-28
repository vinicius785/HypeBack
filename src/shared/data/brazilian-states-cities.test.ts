/**
 * Segmentação por localização — chave de cidade e retenção ao trocar estados.
 *
 * Regra: mexer na lista de estados NÃO pode zerar as cidades já escolhidas.
 * Só saem as cidades de um estado que foi removido.
 */
import { describe, it, expect } from "vitest";

import {
  buildCityKey,
  getCitiesByState,
  parseCityKey,
  retainCitiesForStates,
} from "./brazilian-states-cities";

describe("parseCityKey", () => {
  it("separa nome e UF pela última ocorrência do hífen", () => {
    expect(parseCityKey("São Paulo-SP")).toEqual({
      name: "São Paulo",
      state: "SP",
    });
  });

  it("preserva o hífen do nome da cidade", () => {
    // `split("-")[0]` devolveria "Biritiba" e filtraria a cidade errada.
    expect(parseCityKey("Biritiba-Mirim-SP")).toEqual({
      name: "Biritiba-Mirim",
      state: "SP",
    });
  });

  it("faz round-trip com buildCityKey", () => {
    const key = buildCityKey("Passa-Vinte", "MG");
    expect(key).toBe("Passa-Vinte-MG");
    expect(parseCityKey(key)).toEqual({ name: "Passa-Vinte", state: "MG" });
  });

  it("retorna null para chave malformada", () => {
    expect(parseCityKey("SemHifen")).toBeNull();
    expect(parseCityKey("-SP")).toBeNull();
    expect(parseCityKey("Cidade-")).toBeNull();
    expect(parseCityKey("")).toBeNull();
  });
});

describe("retainCitiesForStates", () => {
  const saoPaulo = buildCityKey("São Paulo", "SP");
  const campinas = buildCityKey("Campinas", "SP");
  const rio = buildCityKey("Rio de Janeiro", "RJ");

  it("mantém as cidades já escolhidas ao adicionar um segundo estado", () => {
    expect(retainCitiesForStates([saoPaulo, campinas], ["SP", "RJ"])).toEqual([
      saoPaulo,
      campinas,
    ]);
  });

  it("remove apenas as cidades do estado que saiu da seleção", () => {
    expect(retainCitiesForStates([saoPaulo, rio], ["SP"])).toEqual([saoPaulo]);
  });

  it("esvazia quando nenhum estado está selecionado", () => {
    expect(retainCitiesForStates([saoPaulo, rio], [])).toEqual([]);
  });

  it("descarta chaves malformadas", () => {
    expect(retainCitiesForStates([saoPaulo, "invalida"], ["SP"])).toEqual([
      saoPaulo,
    ]);
  });

  it("preserva a ordem original das cidades", () => {
    expect(
      retainCitiesForStates([rio, saoPaulo, campinas], ["SP", "RJ"]),
    ).toEqual([rio, saoPaulo, campinas]);
  });

  it("aceita as chaves geradas a partir do catálogo real de cidades", () => {
    const cities = getCitiesByState("SP").slice(0, 3);
    expect(cities.length).toBeGreaterThan(0);
    const keys = cities.map((c) => buildCityKey(c.name, c.state));

    expect(retainCitiesForStates(keys, ["SP", "MG"])).toEqual(keys);
    expect(retainCitiesForStates(keys, ["MG"])).toEqual([]);
  });
});
