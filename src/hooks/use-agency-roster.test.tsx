import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isAgency: true, getRoster: vi.fn() }));

vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => h.isAgency }));
vi.mock("@/hooks/use-workspace-query-key", () => ({
  useWorkspaceQueryKey: () => "ws-1",
  withWorkspaceKey: (parts: readonly unknown[], ws: string | undefined) => [...parts, ws],
}));
vi.mock("@/shared/services/agency-roster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/agency-roster")>()),
  getAgencyRoster: h.getRoster,
}));

import { rosterErrorMessage, useAgencyRoster, useRosterStatusMap } from "./use-agency-roster";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

const m = (id: string, userId: number, status: string) => ({ id, status, exclusive: true, invited_at: "", responded_at: null, creator: { id: userId, name: "x", photo: null, username: null, followers_total: 0, networks: [] } });

beforeEach(() => {
  h.isAgency = true;
  h.getRoster.mockReset();
});

describe("useRosterStatusMap", () => {
  it("indexa o estado vivo (convidado ou ativo) pelo id do criador", async () => {
    h.getRoster.mockResolvedValue([m("a", 4, "active"), m("b", 5, "invited"), m("c", 6, "removed"), m("d", 7, "declined")]);
    const { result } = renderHook(() => useRosterStatusMap(), { wrapper });
    await waitFor(() => expect(result.current.get(4)).toBe("active"));
    expect(result.current.get(5)).toBe("invited");
    expect(result.current.has(6)).toBe(false);
    expect(result.current.has(7)).toBe(false);
  });

  it("fora de agência não consulta a API (ela responderia 403)", async () => {
    h.isAgency = false;
    const { result } = renderHook(() => useAgencyRoster(), { wrapper });
    await new Promise((r) => setTimeout(r, 30));
    expect(h.getRoster).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("rosterErrorMessage", () => {
  it("código conhecido vira texto claro; desconhecido usa a mensagem; sem nada, o padrão", () => {
    expect(rosterErrorMessage({ error: "CREATOR_IN_OTHER_AGENCY" }, "f")).toBe("Este criador já é exclusivo de outra agência.");
    expect(rosterErrorMessage({ data: { error: "ROSTER_ALREADY_INVITED" } }, "f")).toBe("Este criador já foi convidado.");
    expect(rosterErrorMessage({ error: "OUTRO", message: "Falhou" }, "f")).toBe("Falhou");
    expect(rosterErrorMessage(null, "padrão")).toBe("padrão");
  });
});
