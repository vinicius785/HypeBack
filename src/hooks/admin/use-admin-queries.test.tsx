import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminFeed: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet, adminFeed: client.adminFeed };
});

import { AdminApiError } from "@/lib/admin/admin-client";

import { adminRetry, isSameListIdentity, useAdminFeed, useAdminItem, useAdminList } from "./use-admin-queries";

function setup() {
  // Sem `retry` global: cada hook declara a sua política (a do Admin), e é ela que está sob teste.
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const META = { page: 1, per_page: 25, total: 2, total_pages: 1 };

/** Promessa que o teste resolve na hora que quiser (simula a rede lenta). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  client.adminFeed.mockReset();
});

describe("adminRetry", () => {
  const apiError = (status: number, code = "UNKNOWN") => new AdminApiError({ status, code, message: "x" });

  it("não repete 4xx: o resultado não muda (404, 403, 409, 422...)", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(adminRetry(0, apiError(status))).toBe(false);
    }
  });

  it("não repete resposta fora do contrato", () => {
    expect(adminRetry(0, apiError(200, "INVALID_RESPONSE"))).toBe(false);
  });

  it("5xx e queda de rede: até 2 novas tentativas", () => {
    expect(adminRetry(0, apiError(500, "SERVER_ERROR"))).toBe(true);
    expect(adminRetry(1, apiError(503, "SERVER_ERROR"))).toBe(true);
    expect(adminRetry(2, apiError(500, "SERVER_ERROR"))).toBe(false);
    expect(adminRetry(0, apiError(0, "NETWORK_ERROR"))).toBe(true);
    expect(adminRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  });
});

describe("isSameListIdentity", () => {
  const base = ["admin", "platform", "workspaces", "list"] as const;

  it("só os parâmetros (último item da chave) mudam: é a mesma lista", () => {
    expect(isSameListIdentity([...base, { page: 1 }], [...base, { page: 2, status: "active" }])).toBe(true);
  });

  it("outro registro (escopo) ou outro recurso é outra lista", () => {
    expect(isSameListIdentity([...base, "members", "ws-1", {}], [...base, "members", "ws-2", {}])).toBe(false);
    expect(isSameListIdentity([...base, {}], ["admin", "platform", "users", "list", {}])).toBe(false);
  });

  it("sem chave anterior ou com formato diferente, não é a mesma", () => {
    expect(isSameListIdentity(undefined, [...base, {}])).toBe(false);
    expect(isSameListIdentity([...base, {}], [...base, "members", {}])).toBe(false);
  });
});

describe("useAdminList", () => {
  it("devolve { data, meta } e manda caminho, parâmetros e o signal da consulta ao cliente", async () => {
    const { wrapper } = setup();
    client.adminList.mockResolvedValue({ data: [{ id: "a" }], meta: META });

    const { result } = renderHook(
      () => useAdminList<{ id: string }>({ resource: "workspaces", path: "/admin/workspaces", params: { page: 1, per_page: 25 } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [{ id: "a" }], meta: META });
    const [path, params, options] = client.adminList.mock.calls[0];
    expect(path).toBe("/admin/workspaces");
    expect(params).toEqual({ page: 1, per_page: 25 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("trocar de página mantém a anterior na tela enquanto a nova carrega (sem piscar o esqueleto)", async () => {
    const { wrapper } = setup();
    const next = deferred<{ data: Array<{ id: string }>; meta: typeof META }>();
    client.adminList
      .mockResolvedValueOnce({ data: [{ id: "pagina-1" }], meta: { ...META, page: 1 } })
      .mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useAdminList<{ id: string }>({ resource: "workspaces", path: "/admin/workspaces", params: { page } }),
      { wrapper, initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("pagina-1"));

    rerender({ page: 2 });
    // A página 2 ainda não chegou: a 1 segue ali, marcada como placeholder.
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.data[0].id).toBe("pagina-1");

    next.resolve({ data: [{ id: "pagina-2" }], meta: { ...META, page: 2 } });
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("pagina-2"));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("trocar de registro NÃO mostra as linhas do anterior (membros de outro workspace)", async () => {
    const { wrapper } = setup();
    const next = deferred<{ data: Array<{ id: string }>; meta: typeof META }>();
    client.adminList
      .mockResolvedValueOnce({ data: [{ id: "membro-do-ws-1" }], meta: META })
      .mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string }) =>
        useAdminList<{ id: string }>({
          resource: "workspaces",
          scope: ["members", workspaceId],
          path: `/admin/workspaces/${workspaceId}/members`,
        }),
      { wrapper, initialProps: { workspaceId: "ws-1" } },
    );
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("membro-do-ws-1"));

    rerender({ workspaceId: "ws-2" });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);

    next.resolve({ data: [{ id: "membro-do-ws-2" }], meta: META });
    await waitFor(() => expect(result.current.data?.data[0].id).toBe("membro-do-ws-2"));
  });

  it("4xx: uma chamada só (sem repetir), e o erro chega tipado", async () => {
    const { wrapper } = setup();
    client.adminList.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "x" }));

    const { result } = renderHook(() => useAdminList({ resource: "workspaces", path: "/admin/workspaces" }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.adminList).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({ code: "ENDPOINT_UNAVAILABLE", status: 404 });
  });

  it("enabled=false não consulta", () => {
    const { wrapper } = setup();
    renderHook(() => useAdminList({ resource: "workspaces", path: "/admin/workspaces", enabled: false }), { wrapper });
    expect(client.adminList).not.toHaveBeenCalled();
  });
});

describe("useAdminItem", () => {
  it("um registro: caminho e parâmetros vão ao cliente; sem placeholder de outro registro", async () => {
    const { wrapper } = setup();
    const next = deferred<{ id: string }>();
    client.adminGet.mockResolvedValueOnce({ id: "ws-1" }).mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useAdminItem<{ id: string }>({ resource: "workspaces", id, path: `/admin/workspaces/${id}` }),
      { wrapper, initialProps: { id: "ws-1" } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ id: "ws-1" }));
    expect(client.adminGet.mock.calls[0][0]).toBe("/admin/workspaces/ws-1");

    rerender({ id: "ws-2" });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data).toBeUndefined();

    next.resolve({ id: "ws-2" });
    await waitFor(() => expect(result.current.data).toEqual({ id: "ws-2" }));
  });

  it("consulta avulsa (overview, alertas) sem id também funciona", async () => {
    const { wrapper } = setup();
    client.adminGet.mockResolvedValue({ ok: true });
    const { result } = renderHook(
      () => useAdminItem<{ ok: boolean }>({ resource: "overview", path: "/admin/overview", params: { from: "2026-10-01" } }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(client.adminGet.mock.calls[0][1]).toEqual({ from: "2026-10-01" });
  });
});

describe("useAdminFeed", () => {
  it("carrega mais pelo cursor do servidor e para quando não há mais", async () => {
    const { wrapper } = setup();
    client.adminFeed
      .mockResolvedValueOnce({ data: [{ id: "e1" }], meta: { next_cursor: "cursor-2", has_more: true } })
      .mockResolvedValueOnce({ data: [{ id: "e2" }], meta: { next_cursor: null, has_more: false } });

    const { result } = renderHook(
      () => useAdminFeed<{ id: string }>({ resource: "activity", path: "/admin/activity", params: { kind: "charge_paid" } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    // Primeira página: sem cursor; o filtro vai junto.
    expect(client.adminFeed.mock.calls[0][1]).toEqual({ kind: "charge_paid", cursor: undefined });

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(client.adminFeed.mock.calls[1][1]).toEqual({ kind: "charge_paid", cursor: "cursor-2" });
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.data?.pages.flatMap((p) => p.data.map((e) => e.id))).toEqual(["e1", "e2"]);
  });
});
