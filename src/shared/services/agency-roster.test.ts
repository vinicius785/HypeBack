import { describe, expect, it } from "vitest";

import { commissionError, formatCommission, parseCommission } from "./agency-roster";

describe("comissão da agência", () => {
  it("vale de 0 a 100 com no máximo uma casa decimal (ponto ou vírgula)", () => {
    for (const ok of ["0", "15", "12,5", "12.5", "100", " 7 "]) expect(commissionError(ok)).toBeNull();
    for (const bad of ["", "abc", "101", "12,55", "-1", "1e2", "100,1"]) expect(commissionError(bad)).not.toBeNull();
    expect(commissionError("")).toBe("Informe a comissão.");
  });

  it("converte e mostra no formato do Brasil", () => {
    expect(parseCommission("12,5")).toBe(12.5);
    expect(formatCommission(15)).toBe("15%");
    expect(formatCommission(12.5)).toBe("12,5%");
    expect(formatCommission(null)).toBe("—");
  });
});

describe("criadores querendo agência", () => {
  it("monta a busca com página e limite, e a rota ausente (404) vira 'indisponível' sem quebrar", async () => {
    const { vi } = await import("vitest");
    const http = await import("@/lib/http-client");
    const spy = vi.spyOn(http, "apiGet").mockResolvedValueOnce({ data: [], meta: { page: 2, per_page: 20, total: 0, has_more: false } });
    const { getAvailableCreators } = await import("./agency-roster");
    await getAvailableCreators({ q: " ana ", page: 2 });
    expect(spy).toHaveBeenCalledWith("/agency/roster/available?page=2&per_page=20&q=ana");
    spy.mockRejectedValueOnce(Object.assign(new Error("nf"), { status: 404 }));
    expect((await getAvailableCreators({})).unavailable).toBe(true);
    spy.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    await expect(getAvailableCreators({})).rejects.toThrow("boom");
    spy.mockRestore();
  });
});
