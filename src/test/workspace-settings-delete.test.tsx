/**
 * Exclusão do workspace na tela de configurações: impedimentos dentro do diálogo (que continua aberto, sem
 * toast de erro) e o caminho de sucesso de sempre. Fica em `src/test`: tudo dentro de `src/screens` é lido pelo
 * gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Workspace, WorkspaceStatus } from "@/shared/types";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  selectWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getMyWorkspaces: vi.fn(),
  removeWorkspaceId: vi.fn(),
  saveWorkspaceId: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ options }),
  useNavigate: () => ctx.navigate,
  useSearch: () => ({}),
}));
vi.mock("sonner", () => ({ toast: ctx.toast }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    selectedWorkspace: {
      id: "w1",
      name: "Acme Ltda",
      role: "owner",
      status: "active",
      permissions: { workspace_read: true, workspace_settings_write: true, workspace_delete: true },
    },
    selectWorkspace: ctx.selectWorkspace,
  }),
}));
vi.mock("@/hooks/use-workspace-members", () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useWorkspaceMembersQuery: () => ({ data: [], isLoading: false }),
    useInviteWorkspaceMember: mutation,
    useUpdateWorkspaceMemberRole: mutation,
    useRemoveWorkspaceMember: mutation,
  };
});
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [] }) }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => false, useAgencyBrands: () => ({ data: [] }) }));
vi.mock("@/lib/utils/api", () => ({
  getWorkspaceId: () => null,
  removeWorkspaceId: ctx.removeWorkspaceId,
  saveWorkspaceId: ctx.saveWorkspaceId,
}));
vi.mock("@/shared/services/workspace", () => ({
  deleteWorkspace: ctx.deleteWorkspace,
  getMyWorkspaces: ctx.getMyWorkspaces,
  updateWorkspace: vi.fn(),
  uploadWorkspacePhoto: vi.fn(),
}));
// As outras abas e diálogos não importam aqui.
vi.mock("@/components/workspace-settings/brand-tab", () => ({ BrandTab: () => <div /> }));
vi.mock("@/components/workspace-settings/account-type-card", () => ({ AccountTypeCard: () => <div /> }));
vi.mock("@/components/workspace-settings/company-tab", () => ({ CompanyTab: () => <div /> }));
vi.mock("@/components/workspace-settings/team-tab", () => ({ TeamTab: () => <div /> }));
vi.mock("@/components/workspace-settings/invite-modal", () => ({ InviteModal: () => null }));
vi.mock("@/components/workspace-settings/perm-modal", () => ({ PermModal: () => null }));

import { buildApiError } from "@/lib/workspace-state/api-error";
import { Route } from "@/screens/(private)/(app)/workspace.settings";

const Screen = (Route as unknown as { options: { component: () => ReactNode } }).options.component;
const NBSP = " ";

const ws = (id: string, name: string, status: WorkspaceStatus = "active"): Workspace => ({ id, name, status });

function blockedError() {
  return buildApiError(
    409,
    {
      statusCode: 409,
      message: "A exclusão está bloqueada.",
      error: "WORKSPACE_DELETE_BLOCKED",
      details: {
        blockers: [
          { code: "HAS_CUSTODY_BALANCE", message: "Saldo em custódia", amount_cents: 125000 },
          { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Campanhas publicadas", count: 2 },
        ],
      },
    },
    "falhou",
  );
}

async function openDeleteDialog() {
  render(createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, createElement(Screen)));
  await userEvent.click(screen.getByRole("tab", { name: "Avançado" }));
  // Trocar de aba atualiza o endereço (?tab=adv): isso não conta como a navegação pós-exclusão que o teste confere.
  ctx.navigate.mockClear();
  await userEvent.click(screen.getByRole("button", { name: "Excluir workspace" }));
  const dialog = within(screen.getByRole("dialog", { name: "Excluir workspace" }));
  await userEvent.type(dialog.getByLabelText("Nome do workspace"), "Acme Ltda");
  return dialog;
}

const confirm = (dialog: ReturnType<typeof within>) => dialog.getByRole("button", { name: "Excluir workspace" });

beforeEach(() => {
  for (const fn of [ctx.navigate, ctx.selectWorkspace, ctx.deleteWorkspace, ctx.getMyWorkspaces, ctx.removeWorkspaceId, ctx.saveWorkspaceId]) fn.mockReset();
  for (const fn of Object.values(ctx.toast)) fn.mockReset();
});

describe("aba Avançado", () => {
  it("o texto da zona de risco não promete destruição", async () => {
    render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Screen)));
    await userEvent.click(screen.getByRole("tab", { name: "Avançado" }));
    const text = document.body.textContent ?? "";
    expect(text).toContain("Ações que afetam toda a equipe.");
    expect(text).toContain("Acme Ltda deixa de aparecer para a equipe");
    expect(text).not.toMatch(/permanente|não podem ser desfeitas|para sempre|apaga /i);
  });
});

describe("excluir com impedimentos (409 WORKSPACE_DELETE_BLOCKED)", () => {
  it("os impedimentos aparecem no diálogo, que continua aberto, sem toast de erro", async () => {
    ctx.deleteWorkspace.mockRejectedValue(blockedError());
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));

    const alert = await dialog.findByRole("alert");
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      `Há R$${NBSP}1.250,00 de saldo no workspace.`,
      "Há 2 campanhas publicadas.",
    ]);
    expect(alert).toHaveTextContent("Resolva esses itens e tente de novo, ou fale com o suporte.");
    expect(screen.getByRole("dialog", { name: "Excluir workspace" })).toBeInTheDocument();
    expect(ctx.toast.error).not.toHaveBeenCalled();
    expect(ctx.toast.success).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.deleteWorkspace).toHaveBeenCalledWith("w1");
  });

  it("depois de resolver, tentar de novo funciona: o painel some e o caminho de sucesso roda", async () => {
    ctx.deleteWorkspace.mockRejectedValueOnce(blockedError());
    ctx.deleteWorkspace.mockResolvedValueOnce(undefined);
    ctx.getMyWorkspaces.mockResolvedValue([ws("w2", "Beta")]);
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));
    await dialog.findByRole("alert");

    await userEvent.click(confirm(dialog));
    await waitFor(() => expect(ctx.toast.success).toHaveBeenCalledWith("Workspace excluído."));
    expect(ctx.deleteWorkspace).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: "Excluir workspace" })).not.toBeInTheDocument();
  });

  it("fechar o diálogo limpa os impedimentos: ao abrir de novo não sobra o aviso de antes", async () => {
    ctx.deleteWorkspace.mockRejectedValue(blockedError());
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));
    await dialog.findByRole("alert");

    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Excluir workspace" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Excluir workspace" }));
    expect(screen.getByRole("dialog", { name: "Excluir workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("excluir com sucesso (como sempre)", () => {
  it("avisa, fecha, rebusca a lista e abre o primeiro workspace que está funcionando", async () => {
    ctx.deleteWorkspace.mockResolvedValue(undefined);
    ctx.getMyWorkspaces.mockResolvedValue([ws("w2", "Beta", "suspended"), ws("w3", "Gama")]);
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(ctx.toast.success).toHaveBeenCalledWith("Workspace excluído.");
    expect(ctx.selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "w3" }));
    expect(ctx.saveWorkspaceId).toHaveBeenCalledWith("w3");
    expect(ctx.removeWorkspaceId).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Excluir workspace" })).not.toBeInTheDocument();
    expect(ctx.toast.error).not.toHaveBeenCalled();
  });

  it("era o último: limpa o id guardado e leva ao painel (cadastro de marca fechado por enquanto)", async () => {
    ctx.deleteWorkspace.mockResolvedValue(undefined);
    ctx.getMyWorkspaces.mockResolvedValue([]);
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));

    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(ctx.removeWorkspaceId).toHaveBeenCalledTimes(1);
    expect(ctx.selectWorkspace).not.toHaveBeenCalled();
  });
});

describe("outras falhas ao excluir", () => {
  it("erro comum vira toast com o texto do servidor, e o diálogo fica aberto sem painel de impedimentos", async () => {
    ctx.deleteWorkspace.mockRejectedValue(buildApiError(500, { message: "O servidor teve um problema." }, "falhou"));
    const dialog = await openDeleteDialog();
    await userEvent.click(confirm(dialog));

    await waitFor(() => expect(ctx.toast.error).toHaveBeenCalledWith("O servidor teve um problema."));
    expect(screen.getByRole("dialog", { name: "Excluir workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
