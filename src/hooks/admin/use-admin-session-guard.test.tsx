import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => ctx.navigate }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null, setUser: ctx.setUser }) }));
vi.mock("@/lib/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/api")>("@/lib/utils/api");
  return {
    ...actual,
    getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
    getAuthToken: () => localStorage.getItem("token"),
  };
});

import { adminGet } from "@/lib/admin/admin-client";

import { adminKeys } from "./admin-query-keys";
import { useAdminSessionGuard } from "./use-admin-session-guard";

const fetchMock = vi.fn();

function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useAdminSessionGuard(), { wrapper }) };
}

beforeEach(() => {
  ctx.navigate.mockReset();
  ctx.setUser.mockReset();
  localStorage.clear();
  localStorage.setItem("token", "tok");
  localStorage.setItem("workspaceId", "ws-1");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: unknown) =>
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("useAdminSessionGuard", () => {
  it("401 do Admin faz o que o app faz quando /me volta 401: apaga o token, zera o usuário e vai para o login", async () => {
    setup();
    respond(401, { statusCode: 401, message: "Unauthorized" });

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true }));
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("workspaceId")).toBeNull();
    expect(ctx.setUser).toHaveBeenCalledWith(null);
  });

  it("conta suspensa no meio da sessão (ACCOUNT_SUSPENDED) também encerra a sessão", async () => {
    setup();
    respond(403, { statusCode: 403, message: "Conta suspensa", error: "ACCOUNT_SUSPENDED" });

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true }));
  });

  it("várias consultas que falham juntas só encerram a sessão uma vez", async () => {
    setup();
    respond(401, { statusCode: 401, message: "Unauthorized" });

    await Promise.allSettled([adminGet("/admin/a"), adminGet("/admin/b"), adminGet("/admin/c")]);

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalled());
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
  });

  it("esvazia o cache inteiro (Admin e o resto: a próxima conta na mesma aba não vê dado da anterior)", async () => {
    const { client } = setup();
    client.setQueryData(adminKeys.list("workspaces", { page: 1 }), { data: [] });
    client.setQueryData(adminKeys.of("overview"), {});
    client.setQueryData(["campaigns"], ["x"]);
    respond(401, {});

    await adminGet("/admin/overview").catch(() => undefined);
    await waitFor(() => expect(ctx.navigate).toHaveBeenCalled());

    expect(client.getQueryData(adminKeys.list("workspaces", { page: 1 }))).toBeUndefined();
    expect(client.getQueryData(adminKeys.of("overview"))).toBeUndefined();
    expect(client.getQueryData(["campaigns"])).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("403 sem código de conta (falta de permissão) não derruba a sessão", async () => {
    setup();
    respond(403, { statusCode: 403, message: "Forbidden resource" });

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBe("tok");
    expect(localStorage.getItem("workspaceId")).toBe("ws-1");
  });

  it("ao desmontar o layout o aviso é desligado (nada acontece num 401 depois)", async () => {
    const { unmount } = setup();
    unmount();
    respond(401, {});

    await adminGet("/admin/overview").catch(() => undefined);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});
