/**
 * "Sair" (menu lateral e menu mobile compartilham `useLogout`): depois do logout a conta seguinte, na mesma
 * aba, não pode ver o cache nem o workspace da anterior.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useLocation: () => ({ pathname: "/" }), useNavigate: () => ctx.navigate }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null, setUser: ctx.setUser }) }));
vi.mock("@/shared/services/auth", () => ({ logout: ctx.logout }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspaceContext: () => ({}), useWorkspacePermissions: () => ({}) }));
vi.mock("@/hooks/use-campaigns", () => ({ useCampaigns: () => ({ data: [] }) }));
vi.mock("@/hooks/admin/use-scroll-edges", () => ({ useScrollEdges: () => ({ ref: { current: null }, edges: {} }) }));

import { useLogout } from "./sidebar";

function setup() {
  const client = new QueryClient();
  client.setQueryData(["get-current-user"], { id: 1, is_platform_admin: true });
  client.setQueryData(["admin", "platform", "workspaces"], { data: [] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useLogout(), { wrapper }) };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("token", "tok");
  localStorage.setItem("workspaceId", "ws-1");
  ctx.navigate.mockReset();
  ctx.setUser.mockReset();
  ctx.logout.mockReset();
});

describe("useLogout", () => {
  it("logout bem-sucedido: apaga token, workspace e cache, zera o usuário e vai ao login", async () => {
    ctx.logout.mockResolvedValue(undefined);
    const { client, result } = setup();

    act(() => result.current());

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true }));
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("workspaceId")).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(ctx.setUser).toHaveBeenCalledWith(null);
  });

  it("mesmo se a API falhar o estado local é limpo", async () => {
    ctx.logout.mockRejectedValue(new Error("rede"));
    const { client, result } = setup();

    act(() => result.current());

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true }));
    expect(localStorage.getItem("workspaceId")).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
