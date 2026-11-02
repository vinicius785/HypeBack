import { describe, expect, it } from "vitest";

import type { AdminFigure } from "@/shared/admin-platform.types";

import {
  civilDateInSaoPaulo,
  figureText,
  formatBRLFromCents,
  formatCivilDate,
  formatDate,
  formatDateOrInstant,
  formatDateRange,
  formatDateTime,
  formatDays,
  formatInt,
  formatPercent,
  formatRelativeTime,
  isFigureAvailable,
} from "./format";

/** O Intl do pt-BR separa "R$" do número com um espaço sem quebra (U+00A0). */
const NBSP = "\u00a0";

function figure(partial: Partial<AdminFigure>): AdminFigure {
  return { value: 0, unit: "count", kind: "realized", definition: "regra", ...partial };
}

describe("formatBRLFromCents", () => {
  it("escreve o valor exato, com centavos e separador de milhar", () => {
    expect(formatBRLFromCents(123456)).toBe(`R$${NBSP}1.234,56`);
    expect(formatBRLFromCents(100)).toBe(`R$${NBSP}1,00`);
    expect(formatBRLFromCents(5)).toBe(`R$${NBSP}0,05`);
    expect(formatBRLFromCents(0)).toBe(`R$${NBSP}0,00`);
  });

  it("não usa forma compacta nem perde dinheiro em valores grandes", () => {
    expect(formatBRLFromCents(123456789012)).toBe(`R$${NBSP}1.234.567.890,12`);
    expect(formatBRLFromCents(100_000_000_00)).toBe(`R$${NBSP}100.000.000,00`);
    // 1 centavo a menos que 1 milhão continua mostrando todos os dígitos
    expect(formatBRLFromCents(99_999_999)).toBe(`R$${NBSP}999.999,99`);
  });

  it("trata negativos com o sinal antes do R$ (nunca perde o sinal nem os centavos)", () => {
    expect(formatBRLFromCents(-123456)).toBe(`-R$${NBSP}1.234,56`);
    expect(formatBRLFromCents(-5)).toBe(`-R$${NBSP}0,05`);
  });

  it("não mostra -0 para zero negativo", () => {
    expect(formatBRLFromCents(-0)).toBe(`R$${NBSP}0,00`);
  });

  it("valor ausente nunca vira R$ 0,00", () => {
    expect(formatBRLFromCents(null)).toBe("—");
    expect(formatBRLFromCents(undefined)).toBe("—");
    expect(formatBRLFromCents(Number.NaN)).toBe("—");
  });

  it("não depende de divisão em ponto flutuante (0,1 + 0,2 em centavos fecha certo)", () => {
    expect(formatBRLFromCents(10 + 20)).toBe(`R$${NBSP}0,30`);
    expect(formatBRLFromCents(115)).toBe(`R$${NBSP}1,15`);
    expect(formatBRLFromCents(1005)).toBe(`R$${NBSP}10,05`);
  });
});

describe("formatInt, formatPercent e formatDays", () => {
  it("formata inteiros em pt-BR", () => {
    expect(formatInt(1234567)).toBe("1.234.567");
    expect(formatInt(0)).toBe("0");
    expect(formatInt(null)).toBe("—");
  });

  it("formata percentual com no máximo uma casa", () => {
    expect(formatPercent(12.5)).toBe("12,5%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(33.333)).toBe("33,3%");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("singular e plural de dias", () => {
    expect(formatDays(1)).toBe("1 dia");
    expect(formatDays(30)).toBe("30 dias");
    expect(formatDays(null)).toBe("—");
  });
});

describe("figureText", () => {
  it("unavailable nunca vira 0: é 'Não apurado'", () => {
    expect(figureText(figure({ kind: "unavailable", value: null, unit: "brl_cents" }))).toBe("Não apurado");
    expect(figureText(figure({ kind: "unavailable", value: null }))).toBe("Não apurado");
  });

  it("mesmo com value numérico, kind unavailable é 'Não apurado' (a regra é do tipo)", () => {
    expect(figureText(figure({ kind: "unavailable", value: 0 }))).toBe("Não apurado");
  });

  it("value null de qualquer tipo é 'Não apurado', não 0", () => {
    expect(figureText(figure({ kind: "proxy", value: null }))).toBe("Não apurado");
    expect(figureText(figure({ kind: "derived", value: null, unit: "percent" }))).toBe("Não apurado");
  });

  it("formata pela unidade", () => {
    expect(figureText(figure({ unit: "brl_cents", value: 250000 }))).toBe(`R$${NBSP}2.500,00`);
    expect(figureText(figure({ unit: "count", value: 1234 }))).toBe("1.234");
    expect(figureText(figure({ unit: "percent", value: 12.5 }))).toBe("12,5%");
    expect(figureText(figure({ unit: "days", value: 30 }))).toBe("30 dias");
  });

  it("zero real é zero (existe no banco)", () => {
    expect(figureText(figure({ unit: "count", value: 0, kind: "realized" }))).toBe("0");
    expect(figureText(figure({ unit: "brl_cents", value: 0, kind: "stock" }))).toBe(`R$${NBSP}0,00`);
  });

  it("ausente (ainda carregando) é '—'", () => {
    expect(figureText(undefined)).toBe("—");
    expect(figureText(null)).toBe("—");
  });

  it("isFigureAvailable separa número real de não apurado", () => {
    expect(isFigureAvailable(figure({ value: 0 }))).toBe(true);
    expect(isFigureAvailable(figure({ value: null, kind: "unavailable" }))).toBe(false);
    expect(isFigureAvailable(figure({ value: 5, kind: "unavailable" }))).toBe(false);
    expect(isFigureAvailable(undefined)).toBe(false);
  });
});

describe("datas em America/Sao_Paulo", () => {
  it("mostra o dia no fuso do negócio, não em UTC (02:30Z ainda é o dia anterior em São Paulo)", () => {
    expect(formatDate("2026-10-31T02:30:00Z")).toBe("30/10/2026");
    expect(formatDate("2026-10-31T03:00:00Z")).toBe("31/10/2026");
    expect(formatDateTime("2026-10-31T02:30:00Z")).toBe("30/10/2026 23:30");
    expect(formatDateTime("2026-01-15T15:05:00Z")).toBe("15/01/2026 12:05");
  });

  it("meia-noite local é 00:00 (não 24:00)", () => {
    expect(formatDateTime("2026-10-31T03:00:00Z")).toBe("31/10/2026 00:00");
  });

  it("valor inválido ou ausente vira '—'", () => {
    expect(formatDate("não é data")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("data civil (YYYY-MM-DD) não desloca o dia", () => {
    expect(formatCivilDate("2026-10-01")).toBe("01/10/2026");
    expect(formatCivilDate("2026-12-31")).toBe("31/12/2026");
    expect(formatCivilDate(null)).toBe("—");
    expect(formatCivilDate("2026-02-31")).toBe("—");
  });

  it("formatDateOrInstant aceita os dois formatos", () => {
    expect(formatDateOrInstant("2026-10-01")).toBe("01/10/2026");
    expect(formatDateOrInstant("2026-10-31T02:30:00Z")).toBe("30/10/2026");
  });

  it("período do contrato", () => {
    expect(formatDateRange({ from: "2026-10-01", to: "2026-10-31" })).toBe("01/10/2026 – 31/10/2026");
    expect(formatDateRange({ from: "2026-10-31", to: "2026-10-31" })).toBe("31/10/2026");
  });

  it("dia civil de um instante, no fuso de São Paulo", () => {
    expect(civilDateInSaoPaulo(new Date("2026-10-31T02:30:00Z"))).toBe("2026-10-30");
    expect(civilDateInSaoPaulo(new Date("2026-10-31T12:00:00Z"))).toBe("2026-10-31");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-31T15:00:00Z").getTime();

  it("agora, minutos, horas, ontem e dias", () => {
    expect(formatRelativeTime("2026-10-31T14:59:50Z", now)).toBe("agora");
    expect(formatRelativeTime("2026-10-31T14:55:00Z", now)).toBe("há 5 minutos");
    expect(formatRelativeTime("2026-10-31T12:00:00Z", now)).toBe("há 3 horas");
    expect(formatRelativeTime("2026-10-30T15:00:00Z", now)).toBe("ontem");
    expect(formatRelativeTime("2026-10-19T15:00:00Z", now)).toBe("há 12 dias");
  });

  it("passados 30 dias mostra a data", () => {
    expect(formatRelativeTime("2026-08-01T15:00:00Z", now)).toBe("01/08/2026");
  });

  it("ausente vira '—'", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
  });
});
