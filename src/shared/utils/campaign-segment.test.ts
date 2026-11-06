import { describe, expect, it } from "vitest";

import { MAX_POTENTIAL_QUERIES, catalogFilterSets, gendersOf, gendersToForm, splitCsv } from "./campaign-segment";

describe("listas do formulário", () => {
  it("splitCsv ignora vazios e espaços", () => {
    expect(splitCsv("SP, RJ,,")).toEqual(["SP", "RJ"]);
    expect(splitCsv("")).toEqual([]);
    expect(splitCsv(undefined)).toEqual([]);
  });

  it("gêneros: 'all' e vazio significam sem filtro; vários ficam separados por vírgula", () => {
    expect(gendersOf("all")).toEqual([]);
    expect(gendersOf("")).toEqual([]);
    expect(gendersOf("male")).toEqual(["male"]);
    expect(gendersOf("male,female")).toEqual(["male", "female"]);
    expect(gendersToForm([])).toBe("all");
    expect(gendersToForm(["male", "female"])).toBe("male,female");
    expect(gendersOf(gendersToForm(["female", "outros"]))).toEqual(["female", "outros"]);
  });
});

describe("catalogFilterSets (potencial com vários estados, cidades e gêneros)", () => {
  const none = { genders: [], states: [], cities: [] };

  it("sem filtro de lugar nem gênero: uma consulta só, com os seguidores mínimos", () => {
    expect(catalogFilterSets({ ...none, minFollowers: 10000 })).toEqual([{ followers_min: 10000 }]);
    expect(catalogFilterSets(none)).toEqual([{}]);
  });

  it("vários estados: uma consulta por estado (somam, porque cada criador mora em um só)", () => {
    expect(catalogFilterSets({ ...none, states: ["SP", "RJ"] })).toEqual([{ state: "SP" }, { state: "RJ" }]);
  });

  it("estado com cidades escolhidas conta só essas cidades; estado sem cidade conta inteiro", () => {
    const sets = catalogFilterSets({ ...none, states: ["SP", "RJ"], cities: ["Campinas-SP", "Santos-SP"] });
    expect(sets).toEqual([
      { state: "SP", city: "Campinas" },
      { state: "SP", city: "Santos" },
      { state: "RJ" },
    ]);
  });

  it("cidade com hífen no nome usa a UF depois do último hífen", () => {
    expect(catalogFilterSets({ ...none, states: ["SP"], cities: ["Biritiba-Mirim-SP"] })).toEqual([{ state: "SP", city: "Biritiba-Mirim" }]);
  });

  it("vários gêneros multiplicam as consultas", () => {
    expect(catalogFilterSets({ ...none, states: ["SP"], genders: ["male", "female"] })).toEqual([
      { state: "SP", gender: "male" },
      { state: "SP", gender: "female" },
    ]);
  });

  it("combinações demais devolvem null (a tela usa a estimativa)", () => {
    const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF"];
    expect(catalogFilterSets({ ...none, states, genders: ["male", "female"] })).toBeNull();
    const twelve = [...states, "ES", "GO", "MA", "MT", "MS"];
    expect(twelve).toHaveLength(MAX_POTENTIAL_QUERIES);
    expect(catalogFilterSets({ ...none, states: twelve })?.length).toBe(MAX_POTENTIAL_QUERIES);
  });
});
