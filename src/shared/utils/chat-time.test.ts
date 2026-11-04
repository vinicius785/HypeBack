import { describe, expect, it } from "vitest";

import { clockTime, dayKey, dayLabel, fmtTime, fullStamp } from "./chat-time";

// 3 de novembro de 2026, 15:00 em São Paulo (UTC-3).
const NOW = new Date("2026-11-03T18:00:00Z");

describe("chat-time (America/Sao_Paulo)", () => {
  it("fmtTime: hora hoje, 'ontem' ou dia/mês; data inválida vira vazio", () => {
    expect(fmtTime("2026-11-03T12:05:00Z", NOW)).toBe("09:05");
    expect(fmtTime("2026-11-03T02:00:00Z", NOW)).toBe("ontem"); // 23:00 de 02/11 em SP
    expect(fmtTime("2026-10-30T15:00:00Z", NOW)).toBe("30/10");
    expect(fmtTime("nada", NOW)).toBe("");
  });
  it("dayLabel: Hoje, Ontem ou data completa, pelo dia de São Paulo", () => {
    expect(dayLabel("2026-11-03T04:00:00Z", NOW)).toBe("Hoje"); // 01:00 em SP
    expect(dayLabel("2026-11-03T02:59:00Z", NOW)).toBe("Ontem"); // 23:59 de 02/11 em SP
    expect(dayLabel("2026-10-30T15:00:00Z", NOW)).toBe("30 de outubro de 2026");
    expect(dayLabel("x", NOW)).toBe("");
  });
  it("clockTime: HH:mm em 24 horas", () => {
    expect(clockTime("2026-11-03T10:08:00Z")).toBe("07:08");
    expect(clockTime("2026-11-03T21:30:00Z")).toBe("18:30");
    expect(clockTime("x")).toBe("");
  });
  it("fullStamp e dayKey", () => {
    expect(fullStamp("2026-11-03T17:32:00Z")).toBe("3 de novembro de 2026 às 14:32");
    expect(dayKey("2026-11-03T02:00:00Z")).toBe("2026-11-02");
  });
});
