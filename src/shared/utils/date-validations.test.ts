import { describe, it, expect } from "vitest";
import {
  getSubsequentPhaseMinDate,
  validateSubsequentPhaseDate,
  MIN_DAYS_BETWEEN_PHASES,
} from "./date-validations";

describe("getSubsequentPhaseMinDate", () => {
  it("a regra é 3 dias entre fases", () => {
    expect(MIN_DAYS_BETWEEN_PHASES).toBe(3);
  });

  it("retorna 3 dias após a fase anterior (independe da data atual)", () => {
    // A fase anterior é 2026-08-10 → mínimo da próxima é 2026-08-13.
    expect(getSubsequentPhaseMinDate("2026-08-10")).toBe("2026-08-13");
  });

  it("atravessa a virada de mês", () => {
    expect(getSubsequentPhaseMinDate("2026-08-30")).toBe("2026-09-02");
  });

  it("sem fase anterior retorna undefined (não há como calcular o mínimo)", () => {
    expect(getSubsequentPhaseMinDate("")).toBeUndefined();
  });

  it("data anterior malformada retorna undefined", () => {
    expect(getSubsequentPhaseMinDate("abc")).toBeUndefined();
  });
});

describe("validateSubsequentPhaseDate", () => {
  const prev = "2026-08-10"; // min da próxima = 2026-08-13

  it("bloqueia data anterior ao mínimo (menos de 3 dias)", () => {
    const r = validateSubsequentPhaseDate("2026-08-12", prev);
    expect(r.valid).toBe(false);
    expect(r.minDate).toBe("2026-08-13");
    expect(r.error).toContain("13/08/2026");
  });

  it("aceita exatamente no mínimo (3 dias depois)", () => {
    expect(validateSubsequentPhaseDate("2026-08-13", prev).valid).toBe(true);
  });

  it("aceita data posterior ao mínimo", () => {
    expect(validateSubsequentPhaseDate("2026-08-20", prev).valid).toBe(true);
  });

  it("campo vazio é válido (não trava o preenchimento)", () => {
    expect(validateSubsequentPhaseDate("", prev).valid).toBe(true);
  });

  it("sem fase anterior é válido", () => {
    expect(validateSubsequentPhaseDate("2026-08-01", "").valid).toBe(true);
  });
});
