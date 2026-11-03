import { describe, expect, it } from "vitest";

import { civilDateInSaoPaulo } from "@/lib/admin/format";

import {
  addCivilDays,
  defaultPeriod,
  detectPreset,
  isCivilDate,
  isDefaultPeriod,
  PERIOD_MAX_DAYS,
  PERIOD_PRESETS,
  periodDays,
  resolvePeriod,
} from "./financial-period";

const TODAY = "2026-10-31";

describe("datas civis", () => {
  it("só aceita data real no formato YYYY-MM-DD", () => {
    expect(isCivilDate("2026-10-31")).toBe(true);
    expect(isCivilDate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "26-10-31", "2026-1-5", "", "abc", 20261031, null, undefined]) {
      expect(isCivilDate(bad)).toBe(false);
    }
  });

  it("soma dias atravessando mês, ano e fevereiro bissexto", () => {
    expect(addCivilDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCivilDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCivilDays("2026-10-31", -29)).toBe("2026-10-02");
    expect(() => addCivilDays("2026-02-30", 1)).toThrow(RangeError);
  });

  it("conta os dias do período com as duas pontas", () => {
    expect(periodDays({ from: "2026-10-01", to: "2026-10-01" })).toBe(1);
    expect(periodDays({ from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(periodDays({ from: "2026-01-01", to: "2026-12-31" })).toBe(365);
    expect(periodDays({ from: "2028-01-01", to: "2028-12-31" })).toBe(366);
    expect(periodDays({ from: "inválido", to: "2026-10-31" })).toBe(0);
  });

  it("'hoje' é o dia de São Paulo: 22h de 31/10 lá já é 01/11 em UTC", () => {
    expect(civilDateInSaoPaulo(new Date("2026-11-01T01:30:00.000Z"))).toBe("2026-10-31");
    expect(defaultPeriod(civilDateInSaoPaulo(new Date("2026-11-01T01:30:00.000Z")))).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(civilDateInSaoPaulo(new Date("2026-11-01T03:00:00.000Z"))).toBe("2026-11-01");
  });
});

describe("atalhos de período", () => {
  const range = (id: string, today = TODAY) => PERIOD_PRESETS.find((p) => p.id === id)!.range(today);

  it("7, 30 e 90 dias contam hoje (o padrão do servidor é hoje-29 até hoje)", () => {
    expect(range("7d")).toEqual({ from: "2026-10-25", to: TODAY });
    expect(range("30d")).toEqual({ from: "2026-10-02", to: TODAY });
    expect(range("90d")).toEqual({ from: "2026-08-03", to: TODAY });
    expect(periodDays(range("7d"))).toBe(7);
    expect(periodDays(range("30d"))).toBe(30);
    expect(periodDays(range("90d"))).toBe(90);
  });

  it("este mês vai do dia 1 até hoje; mês passado é o mês anterior inteiro", () => {
    expect(range("month")).toEqual({ from: "2026-10-01", to: TODAY });
    expect(range("last-month")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(range("month", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("mês passado em janeiro volta para dezembro do ano anterior, e em março bissexto termina em 29/02", () => {
    expect(range("last-month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(range("last-month", "2028-03-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("este ano vai de 1º de janeiro até hoje, e nenhum atalho passa de 366 dias (nem em 31/12 de ano bissexto)", () => {
    expect(range("year")).toEqual({ from: "2026-01-01", to: TODAY });
    for (const today of ["2026-12-31", "2028-12-31", "2026-01-01", "2028-02-29"]) {
      for (const preset of PERIOD_PRESETS) expect(periodDays(preset.range(today))).toBeLessThanOrEqual(PERIOD_MAX_DAYS);
    }
    expect(periodDays(range("year", "2028-12-31"))).toBe(366);
  });

  it("reconhece o atalho de um período, ou diz que é personalizado", () => {
    expect(detectPreset({ from: "2026-10-25", to: TODAY }, TODAY)).toBe("7d");
    expect(detectPreset({ from: "2026-10-02", to: TODAY }, TODAY)).toBe("30d");
    expect(detectPreset({ from: "2026-09-01", to: "2026-09-30" }, TODAY)).toBe("last-month");
    expect(detectPreset({ from: "2026-10-05", to: "2026-10-20" }, TODAY)).toBeNull();
  });

  it("o padrão é 30 dias terminando hoje", () => {
    expect(defaultPeriod(TODAY)).toEqual({ from: "2026-10-02", to: TODAY });
    expect(isDefaultPeriod({ from: "2026-10-02", to: TODAY }, TODAY)).toBe(true);
    expect(isDefaultPeriod({ from: "2026-10-01", to: TODAY }, TODAY)).toBe(false);
  });
});

describe("resolvePeriod (o que a URL traz vira um período válido)", () => {
  it("sem parâmetros, o padrão", () => {
    expect(resolvePeriod({}, TODAY)).toEqual({ from: "2026-10-02", to: TODAY });
  });

  it("from e to válidos valem como vieram", () => {
    expect(resolvePeriod({ from: "2026-10-05", to: "2026-10-20" }, TODAY)).toEqual({ from: "2026-10-05", to: "2026-10-20" });
  });

  it("só to: os 30 dias que terminam nele; só from: de from até hoje (as regras do servidor)", () => {
    expect(resolvePeriod({ to: "2026-09-30" }, TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod({ from: "2026-10-10" }, TODAY)).toEqual({ from: "2026-10-10", to: TODAY });
  });

  it("data inválida, invertida ou além de 366 dias volta ao padrão", () => {
    const fallback = defaultPeriod(TODAY);
    expect(resolvePeriod({ from: "lixo", to: "2026-02-30" }, TODAY)).toEqual(fallback);
    expect(resolvePeriod({ from: "2026-10-20", to: "2026-10-05" }, TODAY)).toEqual(fallback);
    expect(resolvePeriod({ from: "2024-01-01", to: TODAY }, TODAY)).toEqual(fallback);
    expect(resolvePeriod({ from: 20261001, to: {} }, TODAY)).toEqual(fallback);
  });

  it("aceita exatamente 366 dias, mas não 367", () => {
    expect(resolvePeriod({ from: "2025-10-31", to: TODAY }, TODAY)).toEqual({ from: "2025-10-31", to: TODAY });
    expect(periodDays({ from: "2025-10-31", to: TODAY })).toBe(366);
    expect(resolvePeriod({ from: "2025-10-30", to: TODAY }, TODAY)).toEqual(defaultPeriod(TODAY));
  });

  it("nunca passa de hoje: to no futuro vira hoje; from no futuro volta ao padrão", () => {
    expect(resolvePeriod({ from: "2026-10-20", to: "2026-12-31" }, TODAY)).toEqual({ from: "2026-10-20", to: TODAY });
    expect(resolvePeriod({ from: "2026-11-05" }, TODAY)).toEqual(defaultPeriod(TODAY));
  });
});
