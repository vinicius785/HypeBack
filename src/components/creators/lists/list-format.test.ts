import { describe, expect, it } from "vitest";

import type { InfluencerProfile } from "@/shared/services/influencer";

import { filterAndSortMembers, listDateLabel, memberStats, type MemberStats } from "./list-format";

const p = (type: string, members: number, username = "x"): InfluencerProfile => ({ id: type + members, type, type_label: type, name: type, username, members });

describe("listDateLabel", () => {
  it("usa a atualização quando existe e a criação quando não", () => {
    expect(listDateLabel({ created_at: "2026-01-05T12:00:00Z", updated_at: "2026-03-10T12:00:00Z" })).toBe("Atualizada em 10/03/2026");
    expect(listDateLabel({ created_at: "2026-01-05T12:00:00Z" })).toBe("Criada em 05/01/2026");
    expect(listDateLabel({ created_at: "lixo" })).toBeNull();
  });
});

describe("memberStats", () => {
  it("soma só redes sociais (UGC fora) e escolhe a maior como principal", () => {
    const s = memberStats([p("instagram", 1000), p("tiktok", 5000), p("ugc", 99999)]);
    expect(s.followers).toBe(6000);
    expect(s.primary?.type).toBe("tiktok");
    expect(s.networks).toEqual(["instagram", "tiktok"]);
  });
  it("sem contas: zero e sem principal", () => {
    expect(memberStats(undefined)).toEqual({ primary: null, followers: 0, networks: [] });
  });
});

describe("filterAndSortMembers", () => {
  const members = [
    { id: 1, name: "Zélia", email: "z@a.com" },
    { id: 2, name: "Ana", email: "ana@a.com" },
    { id: 3, name: "Bia", email: "b@a.com" },
  ];
  const stats = new Map<number, MemberStats>([
    [1, { primary: null, followers: 500, networks: [] }],
    [2, { primary: null, followers: 100, networks: [] }],
    [3, { primary: null, followers: 500, networks: [] }],
  ]);
  const ids = (l: typeof members) => l.map((m) => m.id);

  it("ordena por nome sem acento e por seguidores com empate estável", () => {
    expect(ids(filterAndSortMembers(members, stats, "", "name"))).toEqual([2, 3, 1]);
    expect(ids(filterAndSortMembers(members, stats, "", "followers"))).toEqual([1, 3, 2]);
    expect(ids(filterAndSortMembers(members, stats, "", "added"))).toEqual([1, 2, 3]);
  });
  it("busca por nome (sem acento), e-mail e @", () => {
    expect(ids(filterAndSortMembers(members, stats, "zelia", "added"))).toEqual([1]);
    expect(ids(filterAndSortMembers(members, stats, "ana@", "added"))).toEqual([2]);
    expect(ids(filterAndSortMembers(members, stats, "@bia_oficial", "added", (m) => (m.id === 3 ? ["bia_oficial"] : [])))).toEqual([3]);
    expect(filterAndSortMembers(members, stats, "nada", "added")).toEqual([]);
  });
});
