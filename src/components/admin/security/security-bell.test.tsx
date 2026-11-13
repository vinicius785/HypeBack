/**
 * Sino da sentinela: só para o administrador; bolinha com o número de alertas novos.
 *
 * O QUE PRECISA FUNCIONAR: sem alertas, sem bolinha; com alertas, o número; acima de 99, "99+"; clique leva a Segurança.
 * O QUE NÃO PODE ACONTECER: o sino (ou a chamada de summary) para suporte e somente leitura.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminGet: vi.fn(), auth: { user: null as Record<string, unknown> | null } }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));

import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { bellCountText } from "./security-labels";
import { SecurityBell } from "./security-bell";

const ROUTES = [{ path: "/", component: SecurityBell }, stubRoute("/admin/security")];

beforeEach(() => {
  mocks.adminGet.mockReset();
  mocks.auth.user = { id: 1, is_platform_admin: true, platform_role: "admin" };
});

describe("bellCountText", () => {
  it("0 e vazio não têm bolinha; 99 fica 99; 100 vira 99+", () => {
    expect(bellCountText(0)).toBeNull();
    expect(bellCountText(undefined)).toBeNull();
    expect(bellCountText(7)).toBe("7");
    expect(bellCountText(99)).toBe("99");
    expect(bellCountText(100)).toBe("99+");
    expect(bellCountText(250)).toBe("99+");
  });
});

describe("SecurityBell", () => {
  it("com 0 alertas novos o sino fica sem bolinha", async () => {
    mocks.adminGet.mockResolvedValue({ unseen: 0 });
    const { container } = renderRoutes(ROUTES, "/");
    await waitFor(() => expect(mocks.adminGet).toHaveBeenCalledWith("/admin/security/alerts/summary", undefined, expect.anything()));
    expect(await screen.findByRole("button", { name: "Segurança: nenhum alerta novo" })).toBeInTheDocument();
    expect(container.querySelector(".adm-sec-bell-n")).toBeNull();
  });

  it("mostra o número de alertas novos", async () => {
    mocks.adminGet.mockResolvedValue({ unseen: 4 });
    renderRoutes(ROUTES, "/");
    const bell = await screen.findByRole("button", { name: "Segurança: 4 alertas novos" });
    expect(bell).toHaveTextContent("4");
  });

  it("com mais de 99 mostra 99+", async () => {
    mocks.adminGet.mockResolvedValue({ unseen: 100 });
    renderRoutes(ROUTES, "/");
    expect(await screen.findByRole("button", { name: "Segurança: 100 alertas novos" })).toHaveTextContent("99+");
  });

  it("o clique leva para Segurança", async () => {
    mocks.adminGet.mockResolvedValue({ unseen: 1 });
    const { router } = renderRoutes(ROUTES, "/");
    await userEvent.click(await screen.findByRole("button", { name: "Segurança: 1 alerta novo" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/security"));
  });

  it("suporte e somente leitura não veem o sino nem consultam", async () => {
    mocks.auth.user = { id: 7, is_platform_admin: false, platform_role: "support" };
    const { container } = renderRoutes(ROUTES, "/");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector(".adm-sec-bell")).toBeNull();
    expect(mocks.adminGet).not.toHaveBeenCalled();
  });
});
