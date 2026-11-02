import { describe, expect, it } from "vitest";

import { adminKeys, cleanAdminParams } from "./admin-query-keys";

describe("adminKeys", () => {
  it("tudo começa com ['admin', 'platform']", () => {
    expect(adminKeys.all).toEqual(["admin", "platform"]);
    expect(adminKeys.resource("workspaces").slice(0, 2)).toEqual(["admin", "platform"]);
    expect(adminKeys.list("workspaces", { page: 1 }).slice(0, 2)).toEqual(["admin", "platform"]);
    expect(adminKeys.detail("workspaces", "w1").slice(0, 2)).toEqual(["admin", "platform"]);
    expect(adminKeys.feed("activity").slice(0, 2)).toEqual(["admin", "platform"]);
    expect(adminKeys.of("overview", { from: "2026-10-01" }).slice(0, 2)).toEqual(["admin", "platform"]);
  });

  it("a chave do recurso é prefixo da lista e do detalhe (invalidar o recurso pega os dois)", () => {
    const resource = adminKeys.resource("workspaces");
    expect(adminKeys.list("workspaces", { page: 2 }).slice(0, resource.length)).toEqual([...resource]);
    expect(adminKeys.detail("workspaces", "w1", ["impact"]).slice(0, resource.length)).toEqual([...resource]);
    expect(adminKeys.feed("workspaces", {}, ["activity", "w1"]).slice(0, resource.length)).toEqual([...resource]);
  });

  it("parâmetro vazio não entra na chave: { search: '' } e {} dividem o cache", () => {
    expect(adminKeys.list("users", { search: "", page: 1, status: undefined, kind: null })).toEqual(adminKeys.list("users", { page: 1 }));
    expect(adminKeys.list("users", {})).toEqual(adminKeys.list("users"));
  });

  it("parâmetros diferentes dão chaves diferentes", () => {
    expect(adminKeys.list("users", { page: 1 })).not.toEqual(adminKeys.list("users", { page: 2 }));
    expect(adminKeys.list("users", { search: "ana" })).not.toEqual(adminKeys.list("users", {}));
  });

  it("detalhe por id e por parte", () => {
    expect(adminKeys.detail("workspaces", 7, ["financial"], { from: "2026-10-01" })).toEqual([
      "admin",
      "platform",
      "workspaces",
      "detail",
      "7",
      "financial",
      { from: "2026-10-01" },
    ]);
  });

  it("cleanAdminParams mantém 0 e false (são valores)", () => {
    expect(cleanAdminParams({ a: 0, b: false, c: "", d: undefined, e: null })).toEqual({ a: 0, b: false });
  });
});
