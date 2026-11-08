import { describe, it, expect } from "vitest";

import {
  NO_ADVANCED,
  advancedCount,
  followersFor,
  formatCompact,
  matchesAdvanced,
  parseCompact,
} from "./board-filters";
import type { ExtendedInfluencer } from "../management-kanban-config";

const inf = (over: Partial<ExtendedInfluencer> = {}) =>
  ({
    id: "1",
    name: "Ana",
    followers: 80_000,
    engagement: 4.2,
    nicheName: "Moda",
    social_networks: [
      { id: 1, type: "instagram", name: "Instagram", members: 80_000 },
      { id: 2, type: "tiktok", name: "TikTok", members: 20_000 },
    ],
    statusHistory: [{ id: "h", status: "applications", timestamp: "2026-11-05T12:00:00Z" }],
    ...over,
  }) as ExtendedInfluencer;

describe("parseCompact", () => {
  it.each([
    ["50k", 50_000],
    ["50 mil", 50_000],
    ["1,5m", 1_500_000],
    ["1.2 milhão", 1_200_000],
    ["120000", 120_000],
    ["1.500", 1_500],
    ["  ", null],
    ["abc", null],
    ["", null],
  ])("%s → %s", (input, out) => expect(parseCompact(input)).toBe(out));
});

describe("formatCompact", () => {
  it("abrevia em mil e mi", () => {
    expect(formatCompact(500)).toBe("500");
    expect(formatCompact(50_000)).toBe("50 mil");
    expect(formatCompact(1_500_000)).toBe("1,5 mi");
  });
});

describe("matchesAdvanced", () => {
  const now = new Date("2026-11-07T15:00:00");

  it("sem filtros, todo mundo passa", () => {
    expect(matchesAdvanced(inf(), NO_ADVANCED, "all", now)).toBe(true);
    expect(advancedCount(NO_ADVANCED)).toBe(0);
  });

  it("seguidores mínimo e máximo (inclusivos)", () => {
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMin: 80_000 }, "all", now)).toBe(true);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMin: 80_001 }, "all", now)).toBe(false);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMax: 79_999 }, "all", now)).toBe(false);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMin: 10_000, folMax: 100_000 }, "all", now)).toBe(true);
  });

  it("com uma rede escolhida, conta os seguidores daquela rede", () => {
    expect(followersFor(inf(), "TikTok")).toBe(20_000);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMin: 50_000 }, "TikTok", now)).toBe(false);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, folMin: 50_000 }, "Instagram", now)).toBe(true);
  });

  it("engajamento mínimo; sem engajamento conta como 0", () => {
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, engMin: 4 }, "all", now)).toBe(true);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, engMin: 5 }, "all", now)).toBe(false);
    expect(matchesAdvanced(inf({ engagement: 0 }), { ...NO_ADVANCED, engMin: 1 }, "all", now)).toBe(false);
  });

  it("nicho exato", () => {
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, niche: "Moda" }, "all", now)).toBe(true);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, niche: "Beleza" }, "all", now)).toBe(false);
    expect(matchesAdvanced(inf({ nicheName: undefined }), { ...NO_ADVANCED, niche: "Moda" }, "all", now)).toBe(false);
  });

  it("inscrição nos últimos N dias (hoje = o dia de hoje)", () => {
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, sinceDays: 7 }, "all", now)).toBe(true);
    expect(matchesAdvanced(inf(), { ...NO_ADVANCED, sinceDays: 1 }, "all", now)).toBe(false);
    expect(matchesAdvanced(inf({ statusHistory: [] }), { ...NO_ADVANCED, sinceDays: 30 }, "all", now)).toBe(false);
  });

  it("advancedCount conta cada grupo uma vez", () => {
    expect(advancedCount({ folMin: 1, folMax: 9, engMin: 3, niche: "Moda", sinceDays: 7 })).toBe(4);
  });
});
