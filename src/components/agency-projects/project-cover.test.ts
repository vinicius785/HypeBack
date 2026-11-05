import { describe, expect, it } from "vitest";

import { fitWithin } from "./project-cover";

describe("capa: tamanho final", () => {
  it("imagem grande cabe em 1600x900 mantendo a proporção", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3200, 1800)).toEqual({ width: 1600, height: 900 });
    expect(fitWithin(6000, 1000)).toEqual({ width: 1600, height: 267 });
  });

  it("imagem pequena não é ampliada", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
  });

  it("nunca devolve zero", () => {
    expect(fitWithin(100000, 1)).toEqual({ width: 1600, height: 1 });
  });
});
