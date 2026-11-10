import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { name: "Marina Costa", email: "marina@casaaurora.com.br" } }),
}));

vi.mock("@/shared/services/workspace-invites", () => ({
  listMyWorkspaceInvites: vi.fn().mockResolvedValue([]),
  acceptWorkspaceInvite: vi.fn(),
  declineWorkspaceInvite: vi.fn(),
}));

import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { NoWorkspaceState } from "./no-workspace-state";

afterEach(cleanup);

const open = () =>
  renderAdminRoute([{ path: "/", component: () => <NoWorkspaceState /> }, stubRoute("/onboarding/create-workspace")], "/");

describe("NoWorkspaceState", () => {
  it("cumprimenta pelo primeiro nome e, com o cadastro de marca fechado, só oferece entrar por convite", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Bem-vindo(a) ao Hype, Marina!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criar minha marca" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Criar marca/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrar em uma marca" })).toBeInTheDocument();
  });

  it("mostra o e-mail que a marca deve usar no convite e deixa verificar se ele já chegou", async () => {
    const { queryClient } = open();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    expect(await screen.findByText("marina@casaaurora.com.br")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Verificar convites/ }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["me-workspaces"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["my-workspace-invites"] });
  });
});
