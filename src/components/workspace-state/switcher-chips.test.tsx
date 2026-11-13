/**
 * Seletor de workspace (sidebar e gaveta do celular): etiqueta de estado ao lado do nome dos workspaces
 * suspensos e arquivados, que continuam selecionáveis (para ler a explicação). Só o escopo do workspace (app).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Workspace, WorkspaceStatus } from "@/shared/types";

const ctx = vi.hoisted(() => ({
  pathname: "/",
  navigate: vi.fn(),
  selectWorkspace: vi.fn(),
  useCampaigns: vi.fn(),
  workspaces: [] as unknown[],
  selected: undefined as unknown,
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: ctx.pathname }),
  useNavigate: () => ctx.navigate,
}));
vi.mock("@tanstack/react-query", () => ({ useMutation: () => ({ mutate: vi.fn() }), useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { name: "Vini", email: "v@h.com" }, setUser: vi.fn() }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ workspaces: ctx.workspaces, selectedWorkspace: ctx.selected, selectWorkspace: ctx.selectWorkspace }),
  useWorkspacePermissions: () => ({ campaigns_read: true, catalog_read: true, community_lives_read: true, financial_read: true }),
}));
vi.mock("@/hooks/admin/use-admin-security", () => ({ useSecuritySummary: () => ({ data: undefined }) }));
vi.mock("@/hooks/use-campaigns", () => ({
  useCampaigns: (options: unknown) => {
    ctx.useCampaigns(options);
    return { data: [] };
  },
}));
vi.mock("@/shared/services/auth", () => ({ logout: vi.fn() }));
vi.mock("@/hooks/admin/use-scroll-edges", () => ({ useScrollEdges: () => ({ ref: { current: null }, edges: { before: false, after: false } }) }));

import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";

const ws = (id: string, name: string, status?: WorkspaceStatus): Workspace =>
  ({ id, name, role: "member", ...(status ? { status } : {}) }) as Workspace;

beforeEach(() => {
  ctx.pathname = "/";
  ctx.navigate.mockReset();
  ctx.selectWorkspace.mockReset();
  ctx.useCampaigns.mockReset();
  ctx.workspaces = [ws("w1", "Acme", "active"), ws("w2", "Beta", "suspended"), ws("w3", "Gama", "archived"), ws("w4", "Delta")];
  ctx.selected = ctx.workspaces[0];
});

describe("Sidebar (seletor de workspace)", () => {
  it("a lista leva a etiqueta nos suspensos e arquivados, e em mais ninguém", () => {
    render(<Sidebar />);
    const options = screen.getAllByRole("option");
    const chipOf = (name: RegExp) => within(options.find((o) => name.test(o.textContent ?? "")) as HTMLElement).queryByText(/Suspenso|Arquivado/);
    expect(chipOf(/Acme/)).toBeNull();
    expect(chipOf(/Beta/)).toHaveTextContent("Suspenso");
    expect(chipOf(/Gama/)).toHaveTextContent("Arquivado");
    expect(chipOf(/Delta/)).toBeNull(); // servidor antigo: sem o campo, é ativo
  });

  it("os suspensos e arquivados continuam selecionáveis", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("option", { name: /Beta/ }));
    expect(ctx.selectWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ id: "w2", status: "suspended" }));
    await userEvent.click(screen.getByRole("option", { name: /Gama/ }));
    expect(ctx.selectWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ id: "w3", status: "archived" }));
  });

  it("o botão do workspace selecionado mostra o estado dele (e entra no nome acessível, que no trilho vira só o círculo)", () => {
    ctx.selected = ctx.workspaces[1];
    render(<Sidebar />);
    const trigger = screen.getByRole("button", { name: /Beta/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(within(trigger).getByText("Suspenso")).toBeInTheDocument();
    expect(trigger).toHaveAccessibleName(expect.stringContaining("Suspenso"));
  });

  it("selecionado ativo: o botão não leva etiqueta", () => {
    render(<Sidebar />);
    const trigger = screen.getByRole("button", { name: /Acme/ });
    expect(within(trigger).queryByText(/Suspenso|Arquivado/)).not.toBeInTheDocument();
  });

  it("o contador de campanhas não busca com o workspace suspenso (o servidor recusa tudo); arquivado ainda lê", () => {
    ctx.selected = ctx.workspaces[1];
    const { unmount } = render(<Sidebar />);
    expect(ctx.useCampaigns).toHaveBeenLastCalledWith({ enabled: false });
    unmount();

    ctx.selected = ctx.workspaces[2];
    const archived = render(<Sidebar />);
    expect(ctx.useCampaigns).toHaveBeenLastCalledWith({ enabled: true });
    archived.unmount();

    ctx.selected = ctx.workspaces[0];
    render(<Sidebar />);
    expect(ctx.useCampaigns).toHaveBeenLastCalledWith({ enabled: true });
  });

  it("no Admin (escopo da plataforma) não há seletor nem etiqueta", () => {
    ctx.selected = ctx.workspaces[1];
    render(<Sidebar scope="platform" />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Suspenso")).not.toBeInTheDocument();
    expect(ctx.useCampaigns).toHaveBeenLastCalledWith({ enabled: false });
  });
});

describe("MobileNav (gaveta Mais)", () => {
  async function openSheet() {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    return within(screen.getByRole("dialog", { name: "Mais opções" }));
  }

  it("a lista de workspaces leva a etiqueta nos suspensos e arquivados, e em mais ninguém", async () => {
    const sheet = await openSheet();
    const rowOf = (name: string) => sheet.getByRole("button", { name: new RegExp(name) });
    expect(within(rowOf("Acme")).queryByText(/Suspenso|Arquivado/)).toBeNull();
    expect(within(rowOf("Beta")).getByText("Suspenso")).toBeInTheDocument();
    expect(within(rowOf("Gama")).getByText("Arquivado")).toBeInTheDocument();
    expect(within(rowOf("Delta")).queryByText(/Suspenso|Arquivado/)).toBeNull();
  });

  it("escolher um workspace suspenso ou arquivado seleciona", async () => {
    const sheet = await openSheet();
    await userEvent.click(sheet.getByRole("button", { name: /Beta/ }));
    expect(ctx.selectWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ id: "w2", status: "suspended" }));
  });

  it("no Admin a gaveta não tem lista de workspaces (nem etiquetas)", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(screen.queryByText("Suspenso")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beta/ })).not.toBeInTheDocument();
  });
});
