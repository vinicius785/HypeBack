import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminList: client.adminList, adminFeed: client.adminFeed };
});

import { adminKeys } from "./admin-query-keys";
import {
  useAdminWorkspace,
  useAdminWorkspaceActivity,
  useAdminWorkspaceAuditDay,
  useAdminWorkspaceCampaigns,
  useAdminWorkspaceFinancial,
  useAdminWorkspaceImpact,
  useAdminWorkspaceList,
  useAdminWorkspaceMembers,
  useAdminWorkspaceMovements,
  workspaceDetailKey,
} from "./use-admin-workspaces";

const META = { page: 1, per_page: 25, total: 0, total_pages: 0 };
const FEED = { data: [], meta: { next_cursor: null, has_more: false } };
const ID = "7a1e0000-0000-4000-8000-000000000002";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

beforeEach(() => {
  client.adminGet.mockReset().mockResolvedValue({});
  client.adminList.mockReset().mockResolvedValue({ data: [], meta: META });
  client.adminFeed.mockReset().mockResolvedValue(FEED);
});

describe("chaves de cache", () => {
  it("todas começam por ['admin','platform','workspaces'] (uma invalidação pega tudo do recurso)", () => {
    expect(workspaceDetailKey(ID)).toEqual(["admin", "platform", "workspaces", "detail", ID, {}]);
    expect(workspaceDetailKey(ID).slice(0, 3)).toEqual(adminKeys.resource("workspaces"));
  });
});

describe("consultas", () => {
  it("lista: caminho e parâmetros como a tela mandou", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceList({ page: 2, status: "suspended" }), { wrapper });
    await waitFor(() => expect(client.adminList).toHaveBeenCalled());
    expect(client.adminList.mock.calls[0].slice(0, 2)).toEqual(["/admin/workspaces", { page: 2, status: "suspended" }]);
  });

  it("detalhe: o id é escapado no caminho (nunca vira outro caminho)", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspace("a/b?x=1"), { wrapper });
    await waitFor(() => expect(client.adminGet).toHaveBeenCalled());
    expect(client.adminGet.mock.calls[0][0]).toBe("/admin/workspaces/a%2Fb%3Fx%3D1");
  });

  it("membros e campanhas: caminho do workspace, e `enabled=false` não consulta (a aba ainda não abriu)", async () => {
    const { wrapper } = setup();
    const off = renderHook(() => useAdminWorkspaceMembers(ID, { page: 1 }, false), { wrapper });
    renderHook(() => useAdminWorkspaceCampaigns(ID, { page: 1 }, false), { wrapper });
    await Promise.resolve();
    expect(client.adminList).not.toHaveBeenCalled();
    expect(off.result.current.fetchStatus).toBe("idle");

    renderHook(() => useAdminWorkspaceMembers(ID, { page: 1, per_page: 100 }), { wrapper });
    renderHook(() => useAdminWorkspaceCampaigns(ID, { page: 1, sort_by: "title" }), { wrapper });
    await waitFor(() => expect(client.adminList).toHaveBeenCalledTimes(2));
    const calls = client.adminList.mock.calls.map((call) => call.slice(0, 2));
    expect(calls).toContainEqual([`/admin/workspaces/${ID}/members`, { page: 1, per_page: 100 }]);
    expect(calls).toContainEqual([`/admin/workspaces/${ID}/campaigns`, { page: 1, sort_by: "title" }]);
  });

  it("números financeiros: período em dias de São Paulo, do/até", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceFinancial(ID, { from: "2026-10-02", to: "2026-10-31" }), { wrapper });
    await waitFor(() => expect(client.adminGet).toHaveBeenCalled());
    expect(client.adminGet.mock.calls[0].slice(0, 2)).toEqual([`/admin/workspaces/${ID}/financial`, { from: "2026-10-02", to: "2026-10-31" }]);
  });

  it("movimentações: filtra pelo workspace e pelo período; o tipo só vai quando não é 'all'; o cursor segue adiante", async () => {
    client.adminFeed
      .mockResolvedValueOnce({ data: [{ id: "a" }], meta: { next_cursor: "c1", has_more: true } })
      .mockResolvedValue(FEED);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminWorkspaceMovements(ID, { from: "2026-10-02", to: "2026-10-31" }, "all"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [path, params] = client.adminFeed.mock.calls[0];
    expect(path).toBe("/admin/financial/movements");
    expect(params).toMatchObject({ workspace_id: ID, from: "2026-10-02", to: "2026-10-31" });
    expect(params.type).toBeUndefined();

    await result.current.fetchNextPage();
    expect(client.adminFeed.mock.calls[1][1]).toMatchObject({ workspace_id: ID, cursor: "c1" });

    renderHook(() => useAdminWorkspaceMovements(ID, { from: "2026-10-02", to: "2026-10-31" }, "charge"), { wrapper });
    await waitFor(() => expect(client.adminFeed.mock.calls.at(-1)?.[1]).toMatchObject({ type: "charge" }));
  });

  it("atividade: só as ações do Admin quando pedido", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceActivity(ID, false), { wrapper });
    renderHook(() => useAdminWorkspaceActivity(ID, true), { wrapper });
    await waitFor(() => expect(client.adminFeed).toHaveBeenCalledTimes(2));
    const kinds = client.adminFeed.mock.calls.map((call) => call[1].kind);
    expect(kinds).toContain(undefined);
    expect(kinds).toContain("admin_action");
    expect(client.adminFeed.mock.calls[0][0]).toBe(`/admin/workspaces/${ID}/activity`);
  });

  it("auditoria do dia: só consulta quando habilitada, com o workspace e o dia nos dois extremos", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceAuditDay(ID, "2026-10-28", false), { wrapper });
    await Promise.resolve();
    expect(client.adminList).not.toHaveBeenCalled();

    renderHook(() => useAdminWorkspaceAuditDay(ID, "2026-10-28", true), { wrapper });
    await waitFor(() => expect(client.adminList).toHaveBeenCalled());
    expect(client.adminList.mock.calls[0].slice(0, 2)).toEqual([
      "/admin/audit-log",
      { workspace_id: ID, from: "2026-10-28", to: "2026-10-28", per_page: 100 },
    ]);
  });
});

describe("resumo de impacto", () => {
  it("é sempre fresco: sai do cache quando o diálogo fecha e a próxima abertura consulta de novo", async () => {
    const { queryClient, wrapper } = setup();
    client.adminGet.mockResolvedValue({ impact_token: "token-1" });

    const first = renderHook(() => useAdminWorkspaceImpact(ID, true), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    const key = adminKeys.detail("workspaces", ID, ["impact"]);
    expect(queryClient.getQueryData(key)).toEqual({ impact_token: "token-1" });

    first.unmount();
    await waitFor(() => expect(queryClient.getQueryData(key)).toBeUndefined()); // gcTime 0

    client.adminGet.mockResolvedValue({ impact_token: "token-2" });
    const second = renderHook(() => useAdminWorkspaceImpact(ID, true), { wrapper });
    expect(second.result.current.data).toBeUndefined(); // nada de token velho enquanto carrega
    await waitFor(() => expect(second.result.current.data).toEqual({ impact_token: "token-2" }));
    expect(client.adminGet).toHaveBeenCalledTimes(2);
  });

  it("desabilitado não consulta", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceImpact(ID, false), { wrapper });
    await Promise.resolve();
    expect(client.adminGet).not.toHaveBeenCalled();
  });

  it("o caminho é o do contrato (GET .../impact) e sem parâmetros", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdminWorkspaceImpact(ID, true), { wrapper });
    await waitFor(() => expect(client.adminGet).toHaveBeenCalled());
    expect(client.adminGet.mock.calls[0].slice(0, 2)).toEqual([`/admin/workspaces/${ID}/impact`, undefined]);
  });
});
