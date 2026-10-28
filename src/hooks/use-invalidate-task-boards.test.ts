import { describe, it, expect, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateCampaignTaskBoards,
  WORKSPACE_OVERVIEW_QUERY_KEY,
} from "./use-invalidate-task-boards";

describe("invalidateCampaignTaskBoards", () => {
  // Este é o teste que teria pego o bug: resolver uma pendência invalidava só o
  // dashboard da campanha, nunca o board agregado da home → item não sumia.
  it("invalida o dashboard da campanha E o overview agregado do workspace", () => {
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as unknown as QueryClient;

    invalidateCampaignTaskBoards(qc, "camp-123");

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["campaigns", "camp-123", "dashboard"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: WORKSPACE_OVERVIEW_QUERY_KEY,
    });
  });

  it("usa o prefixo do overview (casa qualquer workspace por prefix-match)", () => {
    expect(WORKSPACE_OVERVIEW_QUERY_KEY).toEqual(["workspace-dashboard-overview"]);
  });
});
