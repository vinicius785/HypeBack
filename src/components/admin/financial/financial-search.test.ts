import { describe, expect, it } from "vitest";

import { CAFE_ID } from "./financial-fixtures";
import { isMovementType, readFinancialTab, validateFinancialSearch } from "./financial-search";

describe("readFinancialTab", () => {
  it("sem aba, a visão geral", () => {
    expect(readFinancialTab({})).toBe("overview");
  });

  it("lê a aba da URL e ignora o que não existe", () => {
    expect(readFinancialTab({ tab: "movements" })).toBe("movements");
    expect(readFinancialTab({ tab: "by-workspace" })).toBe("by-workspace");
    expect(readFinancialTab({ tab: "overview" })).toBe("overview");
    expect(readFinancialTab({ tab: "invoices" })).toBe("overview");
  });

  it("um filtro de movimentação sem aba abre as Movimentações (o 'Ver todos' dos alertas da Saúde)", () => {
    expect(readFinancialTab({ type: "withdrawal" })).toBe("movements");
    expect(readFinancialTab({ workspace_id: CAFE_ID })).toBe("movements");
    // valor solto não conta como filtro
    expect(readFinancialTab({ type: "tudo" })).toBe("overview");
    expect(readFinancialTab({ workspace_id: "abc" })).toBe("overview");
  });

  it("a aba escolhida vale mesmo com filtro na URL", () => {
    expect(readFinancialTab({ tab: "by-workspace", type: "withdrawal" })).toBe("by-workspace");
    expect(readFinancialTab({ tab: "overview", type: "withdrawal" })).toBe("overview");
  });
});

describe("validateFinancialSearch", () => {
  it("devolve só o que é válido e diferente do padrão", () => {
    expect(validateFinancialSearch({})).toEqual({});
    expect(
      validateFinancialSearch({
        tab: "movements",
        from: "2026-10-01",
        to: "2026-10-31",
        type: "ledger_entry",
        workspace_id: CAFE_ID,
      }),
    ).toEqual({ tab: "movements", from: "2026-10-01", to: "2026-10-31", type: "ledger_entry", workspace_id: CAFE_ID });
  });

  it("descarta datas, tipo e workspace inválidos", () => {
    expect(validateFinancialSearch({ from: "01/10/2026", to: "2026-02-30", type: "boleto", workspace_id: "não é uuid" })).toEqual({});
  });

  it("normaliza o link sem aba (type vira a aba Movimentações)", () => {
    expect(validateFinancialSearch({ type: "withdrawal" })).toEqual({ tab: "movements", type: "withdrawal" });
  });

  it("mantém a lista de Por workspace (página, busca, ordenação) validada pelo kit", () => {
    expect(validateFinancialSearch({ tab: "by-workspace", page: "3", search: "  cafe ", sort_by: "custody", order: "asc" })).toEqual({
      tab: "by-workspace",
      page: 3,
      search: "cafe",
      sort_by: "custody",
      order: "asc",
    });
    // ordenação fora da lista branca (o contrato não ordena por PIX) volta ao padrão
    expect(validateFinancialSearch({ tab: "by-workspace", sort_by: "paid_pix" })).toEqual({ tab: "by-workspace" });
  });

  it("os tipos aceitos são só os quatro do contrato", () => {
    expect(["charge", "ledger_entry", "withdrawal", "transfer"].every(isMovementType)).toBe(true);
    expect(isMovementType("all")).toBe(false);
    expect(isMovementType(undefined)).toBe(false);
  });
});
