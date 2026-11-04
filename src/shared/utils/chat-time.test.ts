import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clockTime, dayLabel, fmtTime } from "./chat-time";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 3, 15, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe("chat-time", () => {
  it("fmtTime: hora hoje, 'ontem' ou dia/mês; data inválida vira vazio", () => {
    expect(fmtTime(new Date(2026, 10, 3, 9, 5).toISOString())).toBe("09:05");
    expect(fmtTime(new Date(2026, 10, 2, 23, 0).toISOString())).toBe("ontem");
    expect(fmtTime(new Date(2026, 9, 30, 12, 0).toISOString())).toBe("30/10");
    expect(fmtTime("nada")).toBe("");
  });
  it("dayLabel: Hoje, Ontem ou dia e mês por extenso", () => {
    expect(dayLabel(new Date(2026, 10, 3, 1, 0).toISOString())).toBe("Hoje");
    expect(dayLabel(new Date(2026, 10, 2, 1, 0).toISOString())).toBe("Ontem");
    expect(dayLabel(new Date(2026, 9, 30, 1, 0).toISOString())).toMatch(/30 de outubro/);
  });
  it("clockTime: HH:mm", () => {
    expect(clockTime(new Date(2026, 10, 3, 7, 8).toISOString())).toBe("07:08");
    expect(clockTime("x")).toBe("");
  });
});
