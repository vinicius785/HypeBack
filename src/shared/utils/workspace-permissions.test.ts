import { describe, expect, it } from "vitest";

import { mergeWorkspacePermissions } from "./workspace-permissions";

describe("mergeWorkspacePermissions", () => {
  it("o Cliente (ver os criadores da campanha) NÃO ganha o banco de criadores: influencers_read não vira catalog_read", () => {
    const permissions = mergeWorkspacePermissions([
      "workspace_read", "campaigns_read", "influencers_read", "scripts_read", "scripts_approve", "content_read", "content_approve",
    ]);
    expect(permissions.influencers_read).toBe(true);
    expect(permissions.catalog_read).toBe(false);
    expect(permissions.contracts_read).toBe(false);
    expect(permissions.financial_read).toBe(false);
  });

  it("quem tem catalog_read na lista continua com ele", () => {
    expect(mergeWorkspacePermissions(["catalog_read"]).catalog_read).toBe(true);
  });

  it("sem lista da API cai no padrão permissivo (compatibilidade)", () => {
    expect(mergeWorkspacePermissions(null).catalog_read).toBe(true);
  });
});
