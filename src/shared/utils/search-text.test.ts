import { describe, it, expect } from "vitest";
import { normalizeForSearch, parseSearchTerm } from "./search-text";

describe("normalizeForSearch", () => {
  it("remove acentos para que 'jose' encontre 'José'", () => {
    expect(normalizeForSearch("José")).toBe("jose");
    expect(normalizeForSearch("Conceição")).toBe("conceicao");
    expect(normalizeForSearch("MÜLLER")).toBe("muller");
  });

  it("remove o @ inicial do handle", () => {
    expect(normalizeForSearch("@joao")).toBe("joao");
    expect(normalizeForSearch("@@joao")).toBe("joao");
  });

  it("apara espaços nas pontas", () => {
    expect(normalizeForSearch("  maria  ")).toBe("maria");
  });
});

describe("parseSearchTerm", () => {
  it("devolve string vazia para entrada ausente ou só espaços", () => {
    expect(parseSearchTerm(undefined)).toBe("");
    expect(parseSearchTerm(null)).toBe("");
    expect(parseSearchTerm("   ")).toBe("");
  });

  it("limita o tamanho da entrada", () => {
    expect(parseSearchTerm("a".repeat(500))).toHaveLength(100);
  });

  it("busca com espaço nas pontas encontra o nome (regressão)", () => {
    const q = parseSearchTerm(" Maria ");
    expect(normalizeForSearch("Maria Silva").includes(q)).toBe(true);
  });
});
