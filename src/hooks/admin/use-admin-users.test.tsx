import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGet: vi.fn(), adminPost: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet, adminPost: client.adminPost };
});

import { toAdminApiError } from "@/lib/admin/admin-client";
import { listResult, makeAuditEntry, makeSuspendedDetail, makeUserDetail, makeUserListItem } from "@/components/admin/users/admin-users-test-data";

import { adminKeys } from "./admin-query-keys";
import {
  ADMIN_USER_AUDIT_PER_PAGE,
  adminUserAuditParams,
  useAdminUser,
  useAdminUserAudit,
  useAdminUsers,
} from "./use-admin-users";
import { adminUserActionPath, useAdminUserAction } from "./use-admin-users-actions";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function setup(): { queryClient: QueryClient; wrapper: ({ children }: { children: ReactNode }) => ReactNode } {
  // `gcTime` infinito: dados postos à mão no cache (sem ninguém observando) não podem sumir no meio do teste.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  client.adminPost.mockReset();
});

describe("useAdminUsers", () => {
  it("chama GET /admin/users com os parâmetros da lista", async () => {
    client.adminList.mockResolvedValue(listResult([makeUserListItem()]));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminUsers({ page: 2, per_page: 25, status: "all" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.adminList).toHaveBeenCalledWith("/admin/users", { page: 2, per_page: 25, status: "all" }, expect.objectContaining({ signal: expect.anything() }));
    expect(result.current.data?.data[0].id).toBe(9);
    expect(result.current.data?.meta.total).toBe(1);
  });

  it("a chave do cache leva os parâmetros (outro filtro, outra lista)", async () => {
    client.adminList.mockResolvedValue(listResult([]));
    const { wrapper, queryClient } = setup();
    const first = renderHook(() => useAdminUsers({ page: 1 }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    const second = renderHook(() => useAdminUsers({ page: 1, status: "suspended" }), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryCache().findAll({ queryKey: [...adminKeys.resource("users"), "list"] })).toHaveLength(2);
  });
});

describe("useAdminUser", () => {
  it("chama GET /admin/users/:userId", async () => {
    client.adminGet.mockResolvedValue(makeUserDetail());
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminUser("9"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.adminGet).toHaveBeenCalledWith("/admin/users/9", undefined, expect.anything());
    expect(result.current.data?.name).toBe("Bernardo Medeiros Moraes");
  });

  it("sem id (rota com id inválido) a consulta nem sai", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminUser(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(client.adminGet).not.toHaveBeenCalled();
  });

  it("o id vira só um segmento do caminho (nada de '../' vindo da URL)", async () => {
    client.adminGet.mockResolvedValue(makeUserDetail());
    const { wrapper } = setup();
    renderHook(() => useAdminUser("9/../../x?y=1"), { wrapper });
    await waitFor(() => expect(client.adminGet).toHaveBeenCalled());
    expect(client.adminGet.mock.calls[0][0]).toBe("/admin/users/9%2F..%2F..%2Fx%3Fy%3D1");
  });
});

describe("trilha de auditoria do usuário", () => {
  it("'sobre a conta' filtra por alvo; 'feitas por ela' filtra por quem agiu", () => {
    expect(adminUserAuditParams(9, "target", 1)).toEqual({
      target_type: "user",
      target_id: "9",
      page: 1,
      per_page: ADMIN_USER_AUDIT_PER_PAGE,
    });
    expect(adminUserAuditParams(9, "actor", 3)).toEqual({ actor_user_id: 9, page: 3, per_page: ADMIN_USER_AUDIT_PER_PAGE });
  });

  it("chama GET /admin/audit-log e cada visão tem a sua entrada de cache", async () => {
    client.adminList.mockResolvedValue(listResult([makeAuditEntry()]));
    const { wrapper, queryClient } = setup();
    const target = renderHook(() => useAdminUserAudit(9, "target", 1), { wrapper });
    const actor = renderHook(() => useAdminUserAudit(9, "actor", 1), { wrapper });
    await waitFor(() => expect(target.result.current.isSuccess && actor.result.current.isSuccess).toBe(true));

    expect(client.adminList).toHaveBeenCalledWith(
      "/admin/audit-log",
      { target_type: "user", target_id: "9", page: 1, per_page: 10 },
      expect.anything(),
    );
    expect(client.adminList).toHaveBeenCalledWith("/admin/audit-log", { actor_user_id: 9, page: 1, per_page: 10 }, expect.anything());
    expect(queryClient.getQueryCache().findAll({ queryKey: adminKeys.resource("audit-log") })).toHaveLength(2);
  });
});

describe("useAdminUserAction", () => {
  it("o caminho de cada ação", () => {
    expect(adminUserActionPath(9, "suspend")).toBe("/admin/users/9/suspend");
    expect(adminUserActionPath(9, "reactivate")).toBe("/admin/users/9/reactivate");
    expect(adminUserActionPath(9, "revoke-sessions")).toBe("/admin/users/9/revoke-sessions");
  });

  it("envia o motivo e uma Idempotency-Key (UUID v4)", async () => {
    client.adminPost.mockResolvedValue(makeSuspendedDetail());
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminUserAction(9, "suspend"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "Suspeita de fraude" });
    });

    expect(client.adminPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = client.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/9/suspend");
    expect(body).toEqual({ reason: "Suspeita de fraude" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
  });

  it("repetir o mesmo envio depois de uma falha reaproveita a chave; outro motivo, chave nova", async () => {
    client.adminPost
      .mockRejectedValueOnce(toAdminApiError(500, { message: "x" }))
      .mockRejectedValueOnce(toAdminApiError(500, { message: "x" }))
      .mockResolvedValueOnce(makeSuspendedDetail());
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminUserAction(9, "suspend"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "mesmo motivo" }).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "mesmo motivo" }).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "outro motivo" });
    });

    const keys = client.adminPost.mock.calls.map((call) => call[2].idempotencyKey as string);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("no sucesso, a resposta (o usuário no novo estado) já vira o detalhe em cache", async () => {
    const suspended = makeSuspendedDetail();
    client.adminPost.mockResolvedValue(suspended);
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(adminKeys.detail("users", 9), makeUserDetail());
    const { result } = renderHook(() => useAdminUserAction(9, "suspend"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "Suspeita de fraude" });
    });

    expect(queryClient.getQueryData(adminKeys.detail("users", 9))).toEqual(suspended);
    // o detalhe acabou de chegar do servidor: não precisa buscar de novo
    expect(queryClient.getQueryState(adminKeys.detail("users", 9))?.isInvalidated).toBe(false);
  });

  it("no sucesso, invalida o que a ação muda: listas, auditoria, atividades, workspaces e visão geral", async () => {
    client.adminPost.mockResolvedValue(makeSuspendedDetail());
    const { wrapper, queryClient } = setup();
    const keys = {
      usersList: adminKeys.list("users", { page: 1 }),
      audit: adminKeys.list("audit-log", { target_id: "9" }, ["user", 9, "target"]),
      activity: adminKeys.feed("activity", {}),
      members: adminKeys.list("workspaces", {}, ["members", "ws-1"]),
      overview: adminKeys.of("overview", { from: "2026-10-01" }),
      campaigns: adminKeys.list("campaigns", {}),
    };
    for (const key of Object.values(keys)) queryClient.setQueryData(key, { data: [] });
    const { result } = renderHook(() => useAdminUserAction(9, "suspend"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "Suspeita de fraude" });
    });

    for (const name of ["usersList", "audit", "activity", "members", "overview"] as const) {
      expect(queryClient.getQueryState(keys[name])?.isInvalidated, name).toBe(true);
    }
    // o que não tem a ver com a conta fica como está
    expect(queryClient.getQueryState(keys.campaigns)?.isInvalidated).toBe(false);
  });

  it("falha: nada muda no cache e o erro chega a quem chamou", async () => {
    client.adminPost.mockRejectedValue(toAdminApiError(409, { error: "INVALID_STATE_TRANSITION", message: "x" }));
    const detail = makeUserDetail();
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(adminKeys.detail("users", 9), detail);
    const { result } = renderHook(() => useAdminUserAction(9, "suspend"), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ reason: "Suspeita de fraude" })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    });
    expect(queryClient.getQueryData(adminKeys.detail("users", 9))).toBe(detail);
  });
});
