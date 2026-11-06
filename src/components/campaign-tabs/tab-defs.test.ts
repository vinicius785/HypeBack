import { describe, expect, it } from "vitest";

import type { WorkspacePermissions } from "@/shared/types";

import { campaignTabsFor } from "./tab-defs";

const ALL = new Proxy({}, { get: () => true }) as WorkspacePermissions;
const ids = (tabs: Array<{ id: string }>) => tabs.map((t) => t.id);

describe("abas da campanha", () => {
  it("o time vê tudo, inclusive a Gestão (Comunidade, Contratos, Métricas)", () => {
    expect(ids(campaignTabsFor(ALL, false))).toEqual([
      "dashboard", "selection", "management", "groups", "contracts", "metrics",
    ]);
  });

  it("o Cliente fica sem a Gestão, mesmo com as permissões de leitura", () => {
    expect(ids(campaignTabsFor(ALL, true))).toEqual(["dashboard", "selection", "management"]);
  });

  it("sem permissão a aba some também para o time", () => {
    const noContracts = new Proxy({}, { get: (_t, key) => key !== "contracts_read" }) as WorkspacePermissions;
    expect(ids(campaignTabsFor(noContracts, false))).not.toContain("contracts");
  });
});
