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
