import { describe, expect, it } from "vitest";

import { filterNicheGroups, groupNiches } from "./niche-groups";

const niches = [
  { id: 1, parent_id: null, name: "Moda" },
  { id: 2, parent_id: 1, name: "Streetwear" },
  { id: 3, parent_id: 1, name: "Acessórios" },
  { id: 4, parent_id: null, name: "Games" },
  { id: 5, parent_id: 99, name: "Órfão" },
];

describe("groupNiches", () => {
  it("agrupa filhos sob o pai (que continua selecionável) e junta o resto em Outros nichos", () => {
    const g = groupNiches(niches);
    expect(g.map((x) => x.label)).toEqual(["Moda", "Outros nichos"]);
    expect(g[0].items.map((n) => n.name)).toEqual(["Moda", "Streetwear", "Acessórios"]);
    expect(g[1].items.map((n) => n.name)).toEqual(["Games", "Órfão"]);
  });
  it("não perde nenhum nicho", () => {
    expect(groupNiches(niches).flatMap((g) => g.items)).toHaveLength(niches.length);
  });
});

describe("filterNicheGroups", () => {
  it("busca sem acento e mostra só o que combina", () => {
    const f = filterNicheGroups(groupNiches(niches), "acessorios");
    expect(f).toHaveLength(1);
    expect(f[0].items.map((n) => n.name)).toEqual(["Acessórios"]);
  });
  it("o nome do grupo traz o grupo inteiro", () => {
    expect(filterNicheGroups(groupNiches(niches), "moda")[0].items).toHaveLength(3);
  });
  it("busca vazia devolve tudo", () => {
    expect(filterNicheGroups(groupNiches(niches), " ")).toHaveLength(2);
  });
});
