import { describe, expect, it } from "vitest";

import { formatCep, formatCnpj } from "./format";

describe("formatCnpj", () => {
  it("pontua os 14 dígitos", () => {
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("pontua só o que já foi digitado, sem sobras no fim", () => {
    expect(formatCnpj("")).toBe("");
    expect(formatCnpj("1")).toBe("1");
    expect(formatCnpj("12")).toBe("12");
    expect(formatCnpj("123")).toBe("12.3");
    expect(formatCnpj("12345")).toBe("12.345");
    expect(formatCnpj("123456")).toBe("12.345.6");
    expect(formatCnpj("12345678")).toBe("12.345.678");
    expect(formatCnpj("123456780")).toBe("12.345.678/0");
    expect(formatCnpj("123456780001")).toBe("12.345.678/0001");
    expect(formatCnpj("1234567800019")).toBe("12.345.678/0001-9");
  });

  it("aceita o que já veio formatado (colar, preencher do navegador) e ignora letras e o excesso", () => {
    expect(formatCnpj("12.345.678/0001-95")).toBe("12.345.678/0001-95");
    expect(formatCnpj("12a345b678")).toBe("12.345.678");
    expect(formatCnpj("123456780001959999")).toBe("12.345.678/0001-95");
  });
});

describe("formatCep", () => {
  it("coloca o hífen depois do quinto dígito", () => {
    expect(formatCep("01310100")).toBe("01310-100");
    expect(formatCep("01310")).toBe("01310");
    expect(formatCep("013101")).toBe("01310-1");
  });

  it("aceita o que já veio formatado e ignora letras e o excesso", () => {
    expect(formatCep("01310-100")).toBe("01310-100");
    expect(formatCep("01a310b100")).toBe("01310-100");
    expect(formatCep("0131010099")).toBe("01310-100");
    expect(formatCep("")).toBe("");
  });
});
