import { describe, expect, it } from "vitest";

import { buildCpaDescription, cpaHasAmount, cpaPublicView, cpaSummary, formatPercent, isCpaIncomplete, parseCpaDescription, sanitizePercent } from "./cpa-payment";

describe("sanitizePercent", () => {
  it("aceita só números e vírgula, até 2 casas, e trava em 100", () => {
    expect(sanitizePercent("12abc")).toBe("12");
    expect(sanitizePercent("7,555")).toBe("7,55");
    expect(sanitizePercent("150")).toBe("100");
    expect(sanitizePercent("007")).toBe("7");
    expect(sanitizePercent("10,")).toBe("10,");
    expect(sanitizePercent("")).toBe("");
  });
});

describe("buildCpaDescription / parseCpaDescription", () => {
  it("valor: mantém o formato antigo, com R$ quando pedido", () => {
    const d = buildCpaDescription({ actions: "compra", mode: "value", value: "10,00" }, "R$ ");
    expect(d).toBe("Ações que geram CPA: compra - Valor: R$ 10,00");
    expect(parseCpaDescription(d)).toMatchObject({ actions: "compra", mode: "value" });
  });

  it("percentual: vai na descrição e volta igual", () => {
    const d = buildCpaDescription({ actions: "venda", mode: "percent", percent: "7,5" });
    expect(d).toBe("Ações que geram CPA: venda - Percentual: 7,5%");
    expect(parseCpaDescription(d)).toEqual({ actions: "venda", mode: "percent", percent: "7,5", note: "" });
  });

  it("variável: a explicação da pessoa vai na descrição e volta igual", () => {
    const d = buildCpaDescription({ actions: "cadastro", mode: "variable", note: "R$ 5 até 100 cadastros; depois R$ 8" });
    expect(parseCpaDescription(d)).toEqual({ actions: "cadastro", mode: "variable", percent: "", note: "R$ 5 até 100 cadastros; depois R$ 8" });
  });

  it("campanhas antigas (só valor) continuam sendo lidas como valor", () => {
    expect(parseCpaDescription("Ações que geram CPA: clique no link - Valor: R$ 3,00")).toMatchObject({ actions: "clique no link", mode: "value" });
    expect(parseCpaDescription("Ações que geram CPA: clique")).toMatchObject({ actions: "clique", mode: "value" });
    expect(parseCpaDescription(null)).toMatchObject({ actions: "", mode: "value" });
  });
});

describe("regras da modalidade", () => {
  it("só o valor tem amount em reais", () => {
    expect(cpaHasAmount(undefined)).toBe(true);
    expect(cpaHasAmount("value")).toBe(true);
    expect(cpaHasAmount("percent")).toBe(false);
    expect(cpaHasAmount("variable")).toBe(false);
  });

  it("percentual e variável exigem o campo da modalidade", () => {
    expect(isCpaIncomplete({ mode: "percent", percent: "" })).toBe(true);
    expect(isCpaIncomplete({ mode: "percent", percent: "10" })).toBe(false);
    expect(isCpaIncomplete({ mode: "variable", note: "  " })).toBe(true);
    expect(isCpaIncomplete({ mode: "variable", note: "depende do volume" })).toBe(false);
    expect(isCpaIncomplete({ mode: "value" })).toBe(false);
  });

  it("resumo e formatação do percentual", () => {
    expect(formatPercent("10,")).toBe("10%");
    expect(cpaSummary({ mode: "percent", percent: "10" })).toBe("10% por ação");
    expect(cpaSummary({ mode: "variable", note: "Combinado caso a caso" })).toBe("Combinado caso a caso");
    expect(cpaSummary({ mode: "value", value: "2,50" })).toBe("R$ 2,50 por ação");
    expect(cpaSummary({ mode: "value" })).toBe("");
  });
});

describe("cpaPublicView (o que o criador vê no convite)", () => {
  const money = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

  it("valor: destaca o valor por ação", () => {
    const v = cpaPublicView("Ações que geram CPA: compra - Valor: R$ 10,00", 10, money);
    expect(v).toMatchObject({ headline: "R$ 10,00", caption: "por ação" });
    expect(v.detail).toContain("compra");
  });

  it("percentual: destaca o percentual, sem o formato interno", () => {
    const v = cpaPublicView("Ações que geram CPA: venda - Percentual: 7,5%", null, money);
    expect(v.headline).toBe("7,5%");
    expect(v.detail).not.toContain("Ações que geram CPA");
    expect(v.detail).toContain("venda");
  });

  it("variável: mostra a explicação da marca", () => {
    const v = cpaPublicView("Ações que geram CPA: cadastro - Remuneração variável: R$ 5 até 100; depois R$ 8", null, money);
    expect(v.headline).toBe("Variável");
    expect(v.detail).toContain("R$ 5 até 100; depois R$ 8");
  });

  it("campanha antiga sem valor não quebra", () => {
    expect(cpaPublicView(null, null, money)).toMatchObject({ headline: "CPA" });
  });
});
