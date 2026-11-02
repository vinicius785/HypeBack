import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Workspace, WorkspaceStatus } from "@/shared/types";

const ctx = vi.hoisted(() => ({
  pathname: "/",
  navigate: vi.fn(),
  selectWorkspace: vi.fn(),
  workspaces: [] as unknown[],
  selected: undefined as unknown,
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: ctx.pathname }),
  useNavigate: () => ctx.navigate,
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    workspaces: ctx.workspaces,
    selectedWorkspace: ctx.selected,
    selectWorkspace: ctx.selectWorkspace,
  }),
}));
// O menu de verdade não entra aqui: só o círculo do workspace, as legendas de papel e a regra de campanha.
vi.mock("@/components/sidebar", () => ({
  Brand: ({ ws, index }: { ws: { name: string }; index: number }) => <span data-testid="brand" data-index={index}>{ws.name[0]}</span>,
  ROLE_LABEL: { owner: "Proprietário", member: "Membro", admin: "Administrador" },
  isCampaignScopedPath: (pathname: string) => pathname.startsWith("/campaigns/") && !pathname.startsWith("/campaigns/new"),
}));

import { WorkspaceSuspendedState } from "./workspace-suspended-state";

const ws = (id: string, name: string, status: WorkspaceStatus = "active", role: Workspace["role"] = "member"): Workspace => ({
  id,
  name,
  role,
  status,
});

beforeEach(() => {
  ctx.pathname = "/";
  ctx.navigate.mockReset();
  ctx.selectWorkspace.mockReset();
  const acme = ws("w1", "Acme", "suspended", "owner");
  ctx.selected = acme;
  ctx.workspaces = [acme, ws("w2", "Beta"), ws("w3", "Gama", "archived")];
});

describe("WorkspaceSuspendedState", () => {
  it("é uma tela dentro do conteúdo (não um diálogo), com o título e a explicação do workspace", () => {
    render(<WorkspaceSuspendedState />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Workspace suspenso" });
    expect(within(region).getByRole("heading", { level: 1, name: "Workspace suspenso" })).toBeInTheDocument();
    expect(region).toHaveTextContent("O acesso a Acme está bloqueado por enquanto.");
    expect(region).toHaveTextContent("indisponíveis para toda a equipe até a reativação");
  });

  it("leva ao suporte pelo e-mail que o produto já usa, com o nome e o id do workspace para o suporte achar", () => {
    render(<WorkspaceSuspendedState />);
    const link = screen.getByRole("link", { name: "Falar com o suporte" });
    expect(link).toHaveClass("btn");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:suporte@hypeapp.com.br?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Workspace suspenso: Acme");
    expect(params.get("body")).toContain('"Acme"');
    expect(params.get("body")).toContain("ID w1");
  });

  it("deixa trocar de workspace: os outros, com os que funcionam primeiro, papel e etiqueta de estado", () => {
    ctx.workspaces = [ws("w1", "Acme", "suspended", "owner"), ws("w3", "Gama", "archived"), ws("w2", "Beta", "active", "admin")];
    ctx.selected = ctx.workspaces[0];
    render(<WorkspaceSuspendedState />);
    const switcher = screen.getByRole("heading", { name: "Continuar em outro workspace" }).parentElement as HTMLElement;
    const rows = within(switcher).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual(["BBetaAdministrador", "GGamaMembroArquivado"]);
    expect(within(switcher).queryByText("Acme")).not.toBeInTheDocument();
  });

  it("a cor do círculo segue a posição do workspace na lista inteira (a mesma do menu)", () => {
    render(<WorkspaceSuspendedState />);
    const brands = screen.getAllByTestId("brand");
    expect(brands.map((b) => b.getAttribute("data-index"))).toEqual(["1", "2"]);
  });

  it("escolher outro workspace seleciona (o selecionado só muda por aqui, como no menu)", async () => {
    render(<WorkspaceSuspendedState />);
    await userEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(ctx.selectWorkspace).toHaveBeenCalledTimes(1);
    expect(ctx.selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "w2" }));
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("pode escolher até um workspace que também está suspenso ou arquivado (para ler a explicação)", async () => {
    render(<WorkspaceSuspendedState />);
    await userEvent.click(screen.getByRole("button", { name: /Gama/ }));
    expect(ctx.selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "w3", status: "archived" }));
  });

  it("estando num detalhe de campanha, trocar leva para a lista de campanhas (o detalhe é do outro workspace)", async () => {
    ctx.pathname = "/campaigns/abc";
    render(<WorkspaceSuspendedState />);
    await userEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/campaigns", replace: true });
  });

  it("com um workspace só, não há o que trocar: some a seção, fica o suporte", () => {
    ctx.workspaces = [ctx.selected];
    render(<WorkspaceSuspendedState />);
    expect(screen.queryByText("Continuar em outro workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar com o suporte" })).toBeInTheDocument();
  });

  it("sem workspace selecionado não mostra nada", () => {
    ctx.selected = undefined;
    const { container } = render(<WorkspaceSuspendedState />);
    expect(container).toBeEmptyDOMElement();
  });
});
