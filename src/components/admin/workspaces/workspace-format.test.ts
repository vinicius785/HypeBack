import { describe, expect, it } from "vitest";

import {
  addressLines,
  detectPreset,
  digitsOnly,
  formatCep,
  formatCnpj,
  isValidCivilDate,
  presetRange,
  shiftCivilDate,
  shortPublicId,
} from "./workspace-format";

describe("formatCnpj / formatCep", () => {
  it("põe a máscara só quando há os dígitos certos", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(formatCep("01310100")).toBe("01310-100");
  });

  it("não inventa máscara para valor fora do padrão: devolve como veio", () => {
    expect(formatCnpj("123")).toBe("123");
    expect(formatCnpj(null)).toBe("");
    expect(formatCep("0131")).toBe("0131");
    expect(formatCep(undefined)).toBe("");
  });

  it("digitsOnly tira tudo que não é dígito", () => {
    expect(digitsOnly("11.222.333/0001-81")).toBe("11222333000181");
    expect(digitsOnly(null)).toBe("");
  });
});

describe("shortPublicId", () => {
  it("usa os 8 últimos caracteres do uuid (trecho que a busca por public_id encontra)", () => {
    expect(shortPublicId("7a1e0000-0000-4000-8000-0000000000ab")).toBe("000000ab");
    expect(shortPublicId("7a1e0000-0000-4000-8000-000000000002")).toBe("00000002");
  });
});

describe("addressLines", () => {
  it("monta as linhas só com o que existe", () => {
    expect(
      addressLines({
        postal_code: "01310100",
        street: "Avenida Paulista",
        street_number: "1578",
        unit: "Sala 4",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
      }),
    ).toEqual(["Avenida Paulista, 1578 · Sala 4", "Bela Vista", "São Paulo/SP", "CEP 01310-100"]);
  });

  it("endereço parcial e endereço vazio", () => {
    expect(
      addressLines({ postal_code: "01310100", street: null, street_number: null, unit: null, neighborhood: null, city: "Santos", state: "SP" }),
    ).toEqual(["Santos/SP", "CEP 01310-100"]);
    expect(
      addressLines({ postal_code: null, street: null, street_number: null, unit: null, neighborhood: null, city: null, state: null }),
    ).toEqual([]);
  });
});

describe("dias civis", () => {
  it("soma e subtrai dias sem passar por fuso (virada de mês, ano e bissexto)", () => {
    expect(shiftCivilDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftCivilDate("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftCivilDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCivilDate("2026-10-31", -29)).toBe("2026-10-02");
  });

  it("valida a data civil (dia que não existe não vale)", () => {
    expect(isValidCivilDate("2026-02-28")).toBe(true);
    expect(isValidCivilDate("2026-02-30")).toBe(false);
    expect(isValidCivilDate("31/10/2026")).toBe(false);
    expect(isValidCivilDate(undefined)).toBe(false);
  });

  it("atalhos contam hoje: 30 dias = de hoje-29 até hoje (o padrão do servidor)", () => {
    expect(presetRange("30d", "2026-10-31")).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(presetRange("7d", "2026-10-31")).toEqual({ from: "2026-10-25", to: "2026-10-31" });
    expect(presetRange("90d", "2026-10-31")).toEqual({ from: "2026-08-03", to: "2026-10-31" });
  });

  it("reconhece o atalho de um período, ou nenhum", () => {
    expect(detectPreset({ from: "2026-10-02", to: "2026-10-31" }, "2026-10-31")).toBe("30d");
    expect(detectPreset({ from: "2026-10-01", to: "2026-10-31" }, "2026-10-31")).toBeNull();
  });
});
