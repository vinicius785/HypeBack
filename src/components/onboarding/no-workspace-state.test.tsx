import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { name: "Marina Costa", email: "marina@casaaurora.com.br" } }),
}));

import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { NoWorkspaceState } from "./no-workspace-state";

afterEach(cleanup);

const open = () =>
  renderAdminRoute([{ path: "/", component: () => <NoWorkspaceState /> }, stubRoute("/onboarding/create-workspace")], "/");

describe("NoWorkspaceState", () => {
  it("cumprimenta pelo primeiro nome e oferece as duas saídas", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Bem-vindo(a) ao Hype, Marina!" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar minha marca" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrar em uma marca" })).toBeInTheDocument();
  });

  it("'Criar marca' leva à criação da marca", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("link", { name: /Criar marca/ }));
    expect(await screen.findByTestId("stub:/onboarding/create-workspace")).toBeInTheDocument();
  });

  it("mostra o e-mail que a marca deve usar no convite e deixa atualizar depois de aceitar", async () => {
    const { queryClient } = open();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    expect(await screen.findByText("marina@casaaurora.com.br")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Já aceitei o convite/ }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["me-workspaces"] });
  });
});
