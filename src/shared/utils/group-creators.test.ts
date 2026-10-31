import { describe, expect, it } from "vitest";

import type { CatalogItem } from "@/shared/services/creators-catalog";
import { groupCreators, hasUgcAccount, isDeletedUser, isSocialNetworkType } from "./group-creators";

const item = (
  snId: number,
  userId: number,
  over: Partial<CatalogItem["social_network"]> = {},
  extra: Partial<CatalogItem> & { photo?: string | null; name?: string } = {},
): CatalogItem => ({
  social_network: {
    id: snId,
    type: "instagram",
    name: "",
    username: `u${snId}`,
    members: 1000,
    photo: null,
    engagement_percent: 2,
    ...over,
  },
  user: { id: userId, name: extra.name ?? `Pessoa ${userId}`, photo: extra.photo ?? null, gender: null },
  niches: extra.niches ?? [],
  distance_km: extra.distance_km ?? null,
});

describe("groupCreators", () => {
  it("junta as contas do mesmo user.id em um único criador", () => {
    const groups = groupCreators([
      item(1, 10, { type: "instagram", members: 5000 }),
      item(2, 10, { type: "tiktok", members: 9000 }),
      item(3, 10, { type: "youtube", members: 100 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].accounts.map((a) => a.social_network.type)).toEqual(["tiktok", "instagram", "youtube"]);
  });

  it("não agrupa pessoas só por nome, foto ou @ parecidos", () => {
    const groups = groupCreators([
      item(1, 10, { username: "ana" }, { name: "Ana Souza", photo: "/a.png" }),
      item(2, 11, { username: "ana" }, { name: "Ana Souza", photo: "/a.png" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("não duplica a mesma conta repetida em páginas diferentes", () => {
    const groups = groupCreators([item(1, 10), item(1, 10)]);
    expect(groups[0].accounts).toHaveLength(1);
  });

  it("une nichos sem repetir e guarda a menor distância", () => {
    const groups = groupCreators([
      item(1, 10, {}, { niches: [{ id: 1, name: "Moda" }], distance_km: 12 }),
      item(2, 10, {}, { niches: [{ id: 1, name: "Moda" }, { id: 2, name: "Beleza" }], distance_km: 3 }),
    ]);
    expect(groups[0].niches.map((n) => n.name)).toEqual(["Moda", "Beleza"]);
    expect(groups[0].distance_km).toBe(3);
  });

  it("mantém a ordem da primeira aparição e aproveita a foto quando só uma conta tem", () => {
    const groups = groupCreators([
      item(1, 10),
      item(2, 20),
      item(3, 10, {}, { photo: "/p.png" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["10", "20"]);
    expect(groups[0].user.photo).toBe("/p.png");
  });

  it("ignora usuários excluídos (nome de reserva do backend)", () => {
    const groups = groupCreators([
      item(1, 10, {}, { name: "Usuário excluído" }),
      item(2, 11, {}, { name: "usuario EXCLUIDO " }),
      item(3, 12, {}, { name: "Ana" }),
    ]);
    expect(groups.map((g) => g.user.name)).toEqual(["Ana"]);
    expect(isDeletedUser({ id: 1, name: "Usuário excluído", photo: null, gender: null })).toBe(true);
    expect(isDeletedUser({ id: 2, name: "Excluída Silva", photo: null, gender: null })).toBe(false);
  });

  it("trata UGC como tipo de conteúdo, não como rede social", () => {
    expect(isSocialNetworkType("instagram")).toBe(true);
    expect(isSocialNetworkType("UGC")).toBe(false);
    const [g] = groupCreators([item(1, 10, { type: "instagram" }), item(2, 10, { type: "ugc" })]);
    expect(hasUgcAccount(g)).toBe(true);
  });
});
