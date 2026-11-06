import { describe, expect, it } from "vitest";

import type { WorkspacePermissions } from "@/shared/types";

import { campaignTabsFor } from "./tab-defs";

const ALL = new Proxy({}, { get: () => true }) as WorkspacePermissions;
const ids = (tabs: Array<{ id: string }>) => tabs.map((t) => t.id);

describe("abas da campanha", () => {
  it("o time de uma marca vê tudo, inclusive a Gestão, mas não Tarefas (só agência)", () => {
    expect(ids(campaignTabsFor(ALL, false, false))).toEqual([
      "dashboard", "selection", "management", "groups", "contracts", "metrics",
    ]);
  });

  it("o time de uma agência também vê Tarefas, com o Kanban", () => {
    expect(ids(campaignTabsFor(ALL, false, true))).toEqual([
      "dashboard", "selection", "management", "tasks", "groups", "contracts", "metrics",
    ]);
  });

  it("o Cliente fica sem a Gestão, Tarefas inclusive, mesmo com as permissões de leitura", () => {
    expect(ids(campaignTabsFor(ALL, true, true))).toEqual(["dashboard", "selection", "management"]);
  });

  it("sem permissão a aba some também para o time", () => {
    const noContracts = new Proxy({}, { get: (_t, key) => key !== "contracts_read" }) as WorkspacePermissions;
    expect(ids(campaignTabsFor(noContracts, false, true))).not.toContain("contracts");
  });
});
