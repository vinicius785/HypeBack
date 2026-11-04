import { describe, expect, it } from "vitest";

import { parseCityResults, radiusForBoundingBox } from "./city-search";

describe("busca de cidades", () => {
  it("Ribeirão Preto cabe em 25 km e uma metrópole sobe para a opção maior", () => {
    expect(radiusForBoundingBox([-21.3692461, -21.0593676, -47.9879926, -47.6460937])).toBe(25);
    expect(radiusForBoundingBox([-23.8, -23.35, -46.85, -46.35])).toBe(50);
    expect(radiusForBoundingBox([-21.0, -21.01, -47.0, -47.01])).toBe(10);
  });

  it("aceita só cidades, tira repetidas e ignora resultados sem estado ou ponto", () => {
    const base = { lat: "-21.17", lon: "-47.81", boundingbox: ["-21.36", "-21.05", "-47.98", "-47.64"] };
    const r = parseCityResults([
      { ...base, name: "Ribeirão Preto", addresstype: "city", address: { state: "São Paulo" } },
      { ...base, name: "Ribeirão Preto", addresstype: "city", address: { state: "São Paulo" } },
      { ...base, name: "Rua X", addresstype: "road", address: { state: "São Paulo" } },
      { ...base, name: "Sem estado", addresstype: "city", address: {} },
      { lat: "x", lon: "y", name: "Ruim", addresstype: "city", address: { state: "SP" } },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ label: "Ribeirão Preto, São Paulo", radiusKm: 25 });
  });
});
