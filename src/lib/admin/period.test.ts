import { describe, expect, it } from "vitest";

import {
  addCivilDays,
  addCivilMonths,
  countCivilDays,
  createdInPeriodFilter,
  DEFAULT_PERIOD_PRESET,
  formatPeriodRange,
  isCivilDate,
  isPeriodPreset,
  MAX_PERIOD_DAYS,
  normalizeCustomRange,
  PERIOD_PRESETS,
  periodLabel,
  periodQuery,
  periodQueryString,
  periodToSearch,
  readPeriodSearch,
  resolvePeriod,
  resolvePeriodForDay,
  resolvePreset,
  todayInSaoPaulo,
  type AdminPeriod,
  type AdminPeriodPreset,
} from "./period";

/** Instante a partir de um horário de São Paulo (UTC-3 o ano todo desde que o horário de verão acabou, em 2019). */
const sp = (local: string) => new Date(`${local}-03:00`);

describe("isCivilDate", () => {
  it.each(["2026-10-31", "2028-02-29", "2026-01-01", "2026-12-31"])("aceita %s", (value) => {
    expect(isCivilDate(value)).toBe(true);
  });

  it.each([
    ["dia que não existe", "2026-02-29"],
    ["30 de fevereiro", "2026-02-30"],
    ["mês 13", "2026-13-01"],
    ["sem zero à esquerda", "2026-1-5"],
    ["com hora", "2026-10-31T00:00:00Z"],
    ["vazio", ""],
  ])("rejeita %s", (_name, value) => {
    expect(isCivilDate(value)).toBe(false);
  });

  it("rejeita o que não é texto", () => {
    expect(isCivilDate(null)).toBe(false);
    expect(isCivilDate(undefined)).toBe(false);
    expect(isCivilDate(20261031)).toBe(false);
  });
});

describe("conta com dias civis", () => {
  it("soma e subtrai dias atravessando mês, ano e fevereiro bissexto", () => {
    expect(addCivilDays("2026-10-31", 0)).toBe("2026-10-31");
    expect(addCivilDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCivilDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCivilDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addCivilDays("2026-10-31", -366)).toBe("2025-10-30");
  });

  it("soma meses e, onde o dia não existe, usa o último dia do mês", () => {
    expect(addCivilMonths("2026-10-31", -6)).toBe("2026-04-30");
    expect(addCivilMonths("2026-08-31", -6)).toBe("2026-02-28");
    expect(addCivilMonths("2024-08-31", -6)).toBe("2024-02-29");
    expect(addCivilMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCivilMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addCivilMonths("2026-03-31", -13)).toBe("2025-02-28");
    expect(addCivilMonths("2026-05-15", 12)).toBe("2027-05-15");
  });

  it("conta os dias do intervalo com as duas pontas", () => {
    expect(countCivilDays("2026-10-31", "2026-10-31")).toBe(1);
    expect(countCivilDays("2026-10-01", "2026-10-31")).toBe(31);
    expect(countCivilDays("2026-02-01", "2026-03-01")).toBe(29);
    expect(countCivilDays("2028-02-01", "2028-03-01")).toBe(30);
    expect(countCivilDays("2026-10-31", "2026-10-30")).toBe(0);
  });

  it("data inválida é erro de programação, não um dia qualquer", () => {
    expect(() => addCivilDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addCivilMonths("31/10/2026", 1)).toThrow(RangeError);
    expect(() => countCivilDays("2026-10-31", "")).toThrow(RangeError);
  });
});

describe("todayInSaoPaulo (o dia vira à meia-noite de São Paulo, não à da máquina)", () => {
  it("às 23:59:59 de São Paulo ainda é o mesmo dia; à meia-noite vira", () => {
    expect(todayInSaoPaulo(sp("2026-10-31T23:59:59"))).toBe("2026-10-31");
    expect(todayInSaoPaulo(sp("2026-11-01T00:00:00"))).toBe("2026-11-01");
  });

  it("os mesmos instantes em UTC: 02:59:59Z ainda é o dia anterior, 03:00:00Z já é o novo", () => {
    expect(todayInSaoPaulo(Date.UTC(2026, 10, 1, 2, 59, 59))).toBe("2026-10-31");
    expect(todayInSaoPaulo(Date.UTC(2026, 10, 1, 3, 0, 0))).toBe("2026-11-01");
  });

  it("à noite em São Paulo o UTC já virou o dia, mas o dia de São Paulo não", () => {
    // 01:00 UTC de 01/11 = 22:00 de 31/10 em São Paulo.
    expect(todayInSaoPaulo(Date.UTC(2026, 10, 1, 1, 0, 0))).toBe("2026-10-31");
    expect(todayInSaoPaulo(Date.UTC(2026, 9, 31, 23, 0, 0))).toBe("2026-10-31");
  });

  it("na virada do ano", () => {
    expect(todayInSaoPaulo(Date.UTC(2027, 0, 1, 2, 59, 59))).toBe("2026-12-31");
    expect(todayInSaoPaulo(Date.UTC(2027, 0, 1, 3, 0, 0))).toBe("2027-01-01");
  });

  it("aceita Date e número", () => {
    expect(todayInSaoPaulo(new Date(Date.UTC(2026, 9, 31, 15, 0, 0)))).toBe("2026-10-31");
    expect(todayInSaoPaulo(Date.UTC(2026, 9, 31, 15, 0, 0))).toBe("2026-10-31");
  });
});

describe("resolvePreset", () => {
  const TODAY = "2026-10-31"; // sábado

  it("Hoje é só o dia de hoje", () => {
    expect(resolvePreset("today", TODAY)).toEqual({ from: TODAY, to: TODAY });
  });

  it("Esta semana começa na segunda-feira e vai até hoje", () => {
    expect(resolvePreset("week", "2026-10-31")).toEqual({ from: "2026-10-26", to: "2026-10-31" }); // sábado
    expect(resolvePreset("week", "2026-11-01")).toEqual({ from: "2026-10-26", to: "2026-11-01" }); // domingo: ainda a mesma semana
    expect(resolvePreset("week", "2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-02" }); // segunda: só hoje
    expect(resolvePreset("week", "2026-10-28")).toEqual({ from: "2026-10-26", to: "2026-10-28" }); // quarta
  });

  it("a semana atravessa a virada de mês e de ano", () => {
    expect(resolvePreset("week", "2026-03-01")).toEqual({ from: "2026-02-23", to: "2026-03-01" });
    expect(resolvePreset("week", "2026-01-02")).toEqual({ from: "2025-12-29", to: "2026-01-02" });
    expect(resolvePreset("week", "2028-03-01")).toEqual({ from: "2028-02-28", to: "2028-03-01" }); // bissexto
  });

  it("Este mês vai do dia 1º até hoje (e é o padrão)", () => {
    expect(resolvePreset("month", "2026-10-31")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePreset("month", "2026-11-01")).toEqual({ from: "2026-11-01", to: "2026-11-01" });
    expect(resolvePreset("month", "2028-02-29")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(DEFAULT_PERIOD_PRESET).toBe("month");
  });

  it("nenhum predefinido passa do limite do contrato em nenhum dia de três anos, bissexto incluído", () => {
    for (let day = "2027-01-01"; day <= "2029-12-31"; day = addCivilDays(day, 1)) {
      for (const preset of PERIOD_PRESETS) {
        const range = resolvePreset(preset, day);
        expect(range.to).toBe(day);
        expect(range.from <= range.to).toBe(true);
        expect(countCivilDays(range.from, range.to)).toBeLessThanOrEqual(MAX_PERIOD_DAYS);
      }
    }
  });
});

describe("normalizeCustomRange", () => {
  const TODAY = "2026-10-31";

  it("um intervalo válido passa como está", () => {
    expect(normalizeCustomRange({ from: "2026-10-01", to: "2026-10-15" }, TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(normalizeCustomRange({ from: "2026-10-15", to: "2026-10-15" }, TODAY)).toEqual({ from: "2026-10-15", to: "2026-10-15" });
  });

  it("data que não é data civil: null", () => {
    expect(normalizeCustomRange({ from: "2026-02-30", to: "2026-10-15" }, TODAY)).toBeNull();
    expect(normalizeCustomRange({ from: "2026-10-01", to: "" }, TODAY)).toBeNull();
    expect(normalizeCustomRange({ from: null, to: undefined }, TODAY)).toBeNull();
  });

  it("não passa de hoje: período futuro não existe", () => {
    expect(normalizeCustomRange({ from: "2026-10-01", to: "2026-12-31" }, TODAY)).toEqual({ from: "2026-10-01", to: TODAY });
    expect(normalizeCustomRange({ from: "2026-11-15", to: "2026-12-31" }, TODAY, "from")).toEqual({ from: TODAY, to: TODAY });
  });

  it("invertido: a ponta que a pessoa NÃO mexeu acompanha", () => {
    const inverted = { from: "2026-10-20", to: "2026-10-10" };
    expect(normalizeCustomRange(inverted, TODAY, "from")).toEqual({ from: "2026-10-20", to: "2026-10-20" });
    expect(normalizeCustomRange(inverted, TODAY, "to")).toEqual({ from: "2026-10-10", to: "2026-10-10" });
  });

  it("até 366 dias (as duas pontas contam) passa; 367 não", () => {
    expect(normalizeCustomRange({ from: "2025-10-31", to: "2026-10-31" }, TODAY)).toEqual({ from: "2025-10-31", to: "2026-10-31" });
    expect(normalizeCustomRange({ from: "2025-10-30", to: "2026-10-31" }, TODAY, "to")).toEqual({ from: "2025-10-31", to: "2026-10-31" });
  });

  it("ao estourar o limite mexendo no início, o fim encolhe; mexendo no fim, o início avança", () => {
    const tooLong = { from: "2025-01-01", to: "2026-10-31" };
    const fromEdited = normalizeCustomRange(tooLong, TODAY, "from")!;
    expect(fromEdited).toEqual({ from: "2025-01-01", to: "2026-01-01" });
    expect(countCivilDays(fromEdited.from, fromEdited.to)).toBe(MAX_PERIOD_DAYS);

    const toEdited = normalizeCustomRange(tooLong, TODAY, "to")!;
    expect(toEdited).toEqual({ from: "2025-10-31", to: "2026-10-31" });
    expect(countCivilDays(toEdited.from, toEdited.to)).toBe(MAX_PERIOD_DAYS);
  });

  it("um ano bissexto inteiro cabe (366 dias); um dia a mais não", () => {
    expect(normalizeCustomRange({ from: "2028-01-01", to: "2028-12-31" }, "2029-06-01")).toEqual({ from: "2028-01-01", to: "2028-12-31" });
    expect(normalizeCustomRange({ from: "2027-12-31", to: "2028-12-31" }, "2029-06-01", "to")).toEqual({
      from: "2028-01-01",
      to: "2028-12-31",
    });
  });
});

describe("resolvePeriod", () => {
  const MONTH = { preset: "month", from: "2026-10-01", to: "2026-10-31" };

  it("sem escolha é o padrão: este mês", () => {
    expect(resolvePeriod({}, sp("2026-10-31T15:00:00"))).toEqual(MONTH);
    expect(resolvePeriod(undefined, sp("2026-10-31T15:00:00")).preset).toBe("month");
  });

  it.each<[AdminPeriodPreset, string, string]>([
    ["today", "2026-10-31", "2026-10-31"],
    ["week", "2026-10-26", "2026-10-31"],
    ["month", "2026-10-01", "2026-10-31"],
  ])("%s resolve para %s a %s", (preset, from, to) => {
    expect(resolvePeriod({ preset }, sp("2026-10-31T09:30:00"))).toEqual({ preset, from, to });
  });

  it("à meia-noite de São Paulo o período anda um dia (e o mês recomeça)", () => {
    expect(resolvePeriod({ preset: "today" }, sp("2026-10-31T23:59:59"))).toMatchObject({ from: "2026-10-31", to: "2026-10-31" });
    expect(resolvePeriod({ preset: "today" }, sp("2026-11-01T00:00:00"))).toMatchObject({ from: "2026-11-01", to: "2026-11-01" });
    expect(resolvePeriod({ preset: "month" }, sp("2026-11-01T00:00:00"))).toMatchObject({ from: "2026-11-01", to: "2026-11-01" });
  });

  it("personalizado válido é usado (limitado a hoje)", () => {
    const now = sp("2026-10-31T12:00:00");
    expect(resolvePeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }, now)).toEqual({
      preset: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(resolvePeriod({ preset: "custom", from: "2026-10-01", to: "2026-12-31" }, now)).toEqual({
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("personalizado inválido ou incompleto volta ao padrão", () => {
    const now = sp("2026-10-31T12:00:00");
    expect(resolvePeriod({ preset: "custom" }, now)).toEqual(MONTH);
    expect(resolvePeriod({ preset: "custom", from: "ontem", to: "hoje" }, now).preset).toBe("month");
  });

  it("escolha desconhecida volta ao padrão", () => {
    expect(resolvePeriod({ preset: "decada" as never }, sp("2026-10-31T12:00:00")).preset).toBe("month");
  });
});

describe("resolvePeriodForDay (o mesmo, a partir do dia de hoje)", () => {
  it("resolve pelo dia informado, sem relógio", () => {
    expect(resolvePeriodForDay({ preset: "week" }, "2026-03-05")).toEqual({ preset: "week", from: "2026-03-02", to: "2026-03-05" });
    expect(resolvePeriodForDay({ preset: "today" }, "2028-12-31")).toEqual({ preset: "today", from: "2028-12-31", to: "2028-12-31" });
    expect(resolvePeriodForDay({}, "2026-10-31")).toEqual({ preset: "month", from: "2026-10-01", to: "2026-10-31" });
  });

  it("personalizado vale até o dia informado, e o inválido volta ao padrão", () => {
    expect(resolvePeriodForDay({ preset: "custom", from: "2026-10-01", to: "2026-12-31" }, "2026-10-31")).toEqual({
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(resolvePeriodForDay({ preset: "custom", from: "x", to: "y" }, "2026-10-31").preset).toBe("month");
  });

  it("virar o dia muda o período: é por isso que a tela refaz a conta quando o dia de São Paulo vira", () => {
    expect(resolvePeriodForDay({ preset: "today" }, "2026-10-31")).not.toEqual(resolvePeriodForDay({ preset: "today" }, "2026-11-01"));
  });
});

describe("período na URL", () => {
  it("lê um predefinido e esconde o padrão (URL curta)", () => {
    expect(readPeriodSearch({ period: "today" })).toEqual({ period: "today" });
    expect(readPeriodSearch({ period: "week" })).toEqual({ period: "week" });
    expect(readPeriodSearch({ period: "month" })).toEqual({});
    expect(readPeriodSearch({})).toEqual({});
  });

  it("personalizado só vale com as duas datas válidas", () => {
    expect(readPeriodSearch({ period: "custom", from: "2026-10-01", to: "2026-10-15" })).toEqual({
      period: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(readPeriodSearch({ period: "custom", from: "2026-10-01" })).toEqual({});
    expect(readPeriodSearch({ period: "custom", from: "2026-02-30", to: "2026-10-15" })).toEqual({});
  });

  it("ignora o que não é válido: escolha desconhecida (inclusive os atalhos antigos), número, datas soltas", () => {
    expect(readPeriodSearch({ period: "decada" })).toEqual({});
    expect(readPeriodSearch({ period: "90d" })).toEqual({});
    expect(readPeriodSearch({ period: 30 })).toEqual({});
    expect(readPeriodSearch({ from: "2026-10-01", to: "2026-10-15" })).toEqual({});
    expect(readPeriodSearch({ period: "week", from: "2026-10-01", to: "2026-10-15" })).toEqual({ period: "week" });
  });

  it("periodToSearch é o inverso: o padrão sai da URL", () => {
    expect(periodToSearch({ preset: "month", from: "2026-10-01", to: "2026-10-31" })).toEqual({});
    expect(periodToSearch({ preset: "today", from: "2026-10-31", to: "2026-10-31" })).toEqual({ period: "today" });
    expect(periodToSearch({ preset: "custom", from: "2026-10-01", to: "2026-10-15" })).toEqual({
      period: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(periodToSearch({ preset: "custom", from: "x", to: "y" })).toEqual({});
  });

  it("ida e volta preserva a escolha", () => {
    for (const preset of [...PERIOD_PRESETS, "custom"] as const) {
      const search = periodToSearch({ preset, from: "2026-10-01", to: "2026-10-15" });
      expect(readPeriodSearch(search as Record<string, unknown>)).toEqual(search);
    }
  });
});
describe("consultas e textos", () => {
  const PERIOD: AdminPeriod = { preset: "month", from: "2026-10-01", to: "2026-10-31" };

  it("monta os parâmetros from/to da API e a mesma coisa como texto de URL", () => {
    expect(periodQuery(PERIOD)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodQueryString(PERIOD)).toBe("from=2026-10-01&to=2026-10-31");
  });

  it("o filtro 'criado no período' das listas usa os nomes do contrato", () => {
    expect(createdInPeriodFilter(PERIOD)).toEqual({ created_from: "2026-10-01", created_to: "2026-10-31" });
  });

  it("formata os dias como o resto do Admin (um dia só aparece uma vez)", () => {
    expect(formatPeriodRange(PERIOD)).toBe("01/10/2026 – 31/10/2026");
    expect(formatPeriodRange({ from: "2026-10-31", to: "2026-10-31" })).toBe("31/10/2026");
  });

  it("rótulo de cada escolha", () => {
    const at = (preset: AdminPeriod["preset"]): AdminPeriod => ({ preset, from: "2026-01-01", to: "2026-10-31" });
    expect(periodLabel(at("today"))).toBe("Hoje");
    expect(periodLabel(at("week"))).toBe("Esta semana");
    expect(periodLabel(at("month"))).toBe("Este mês");
    expect(periodLabel(at("custom"))).toBe("Período personalizado");
  });

  it("isPeriodPreset reconhece só os predefinidos", () => {
    expect(isPeriodPreset("week")).toBe(true);
    expect(isPeriodPreset("custom")).toBe(false);
    expect(isPeriodPreset(30)).toBe(false);
  });
});
