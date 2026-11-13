/**
 * Tela "Equipe" do Admin: papéis, pessoas e troca de papel.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - as pessoas vêm primeiro (a linha abre a conta); os três papéis ficam recolhidos em "O que cada papel pode fazer",
 *     com o que podem e quantas pessoas têm cada um;
 *   - o administrador adiciona pessoas e altera papéis (motivo obrigatório, Idempotency-Key, erro em português);
 *   - o papel só habilita a confirmação quando difere do atual; "Tirar da equipe" é uma ação perigosa;
 *   - o último administrador não sai (erro do servidor traduzido);
 *   - suporte e somente leitura veem a lista, sem nenhum botão de mudar.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - botão de mudar para quem não é administrador, ou para a própria conta ("Você");
 *   - buscar contas antes de digitar o mínimo de letras.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
  toastSuccess: vi.fn(),
  auth: { user: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet, adminList: mocks.adminList, adminPatch: mocks.adminPatch, adminPost: mocks.adminPost };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminPlatformTeam } from "@/shared/admin-platform.types";

import { listResult, makeUserDetail } from "../users/admin-users-test-data";
import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { AdminTeamPage } from "./admin-team-page";
import { TEAM_SEARCH_MIN } from "./team-role-dialog";

const TEAM: AdminPlatformTeam = {
  roles: [
    { role: "admin", label: "Administrador", description: "Acesso total ao Admin.", permissions: ["read", "users.moderate", "workspaces.moderate"] },
    { role: "support", label: "Suporte", description: "Lê tudo e suspende contas e workspaces.", permissions: ["read", "users.moderate", "workspaces.moderate"] },
    { role: "viewer", label: "Somente leitura", description: "Só visualiza.", permissions: ["read"] },
  ],
  members: [
    { user_id: 1, name: "Marina Alves", email: "marina@hype.com", role: "admin", status: "active" },
    { user_id: 7, name: "Caio Teodoro", email: "caio@hype.com", photo: "https://cdn.test/caio.jpg", role: "support", status: "active" },
    { user_id: 8, name: "Leo Ramos", email: "leo@hype.com", role: "viewer", status: "suspended" },
  ],
};

const ADMIN_USER = { id: 1, name: "Marina Alves", is_platform_admin: true, platform_role: "admin" };

function serve(team: AdminPlatformTeam = TEAM) {
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === "/admin/platform-team") return team;
    if (path === "/admin/me") return { user_id: 7, role: "support", permissions: ["read", "users.moderate"] };
    throw toAdminApiError(404, { message: "x" });
  });
  mocks.adminList.mockImplementation(async (_path: string, params?: Record<string, unknown>) => {
    const search = String(params?.search ?? "");
    const rows = search.toLowerCase().includes("bia")
      ? [makeUserDetail({ id: 20, name: "Bia Santos", email: "bia@marca.com" })]
      : [];
    return listResult(rows as never, rows.length, { page: 1, per_page: 6 });
  });
}

const ROUTES = [{ path: "/admin/team", component: AdminTeamPage }, stubRoute("/admin/users/$userId")];

async function renderPage() {
  const view = renderRoutes(ROUTES, "/admin/team");
  await screen.findByRole("heading", { level: 1, name: "Pessoas" });
  await screen.findByText("Caio Teodoro");
  return { ...view, user: userEvent.setup() };
}

/** Buscas de conta feitas pelo seletor (a ilha de Pessoas também chama a API, só para as contagens das abas). */
const searchCalls = () => mocks.adminList.mock.calls.filter(([, params]) => Boolean((params as { search?: unknown } | undefined)?.search));

const rowOf = (name: string) => screen.getByText(name).closest('[role="row"]') as HTMLElement;

beforeEach(() => {
  for (const mock of [mocks.adminGet, mocks.adminList, mocks.adminPatch, mocks.adminPost, mocks.toastSuccess]) mock.mockReset();
  mocks.auth.user = ADMIN_USER;
  serve();
});

describe("Equipe: papéis e pessoas", () => {
  it("as pessoas vêm antes dos papéis, e os papéis ficam recolhidos", async () => {
    const { container } = await renderPage();
    const people = screen.getByRole("table", { name: "Equipe da plataforma" });
    const summary = screen.getByText("O que cada papel pode fazer");
    expect(people.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((summary.closest("details") as HTMLDetailsElement).open).toBe(false);
    expect(container.querySelectorAll("details[open]")).toHaveLength(0);
  });

  it("enquanto a equipe carrega, o bloco de papéis é um esqueleto e o erro da tabela não troca a página", async () => {
    mocks.adminGet.mockImplementation(() => new Promise(() => undefined));
    const { container } = renderRoutes(ROUTES, "/admin/team");
    await screen.findByRole("heading", { level: 1, name: "Pessoas" });
    expect(container.querySelector(".adm-team-roles-skel")).toBeInTheDocument();
    // uma só região de status para o carregamento (a da tabela)
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText("O que cada papel pode fazer")).not.toBeInTheDocument();
  });

  it("um cartão por papel, com o que pode, o que não pode e quantas pessoas", async () => {
    const { user } = await renderPage();
    await user.click(screen.getByText("O que cada papel pode fazer"));
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Administrador");
    expect(cards[0]).toHaveTextContent("1 pessoa");
    expect(cards[0]).toHaveTextContent("Excluir contas e arquivar ou excluir workspaces");
    expect(cards[2]).toHaveTextContent("Somente leitura");
    expect(within(cards[2]).getByLabelText("O que Somente leitura pode")).toHaveTextContent("Ver todas as telas do Admin");
  });

  it("a coluna do estado se chama 'Status', a de ações tem nome para leitor de tela e a linha abre a conta", async () => {
    await renderPage();
    const headers = within(screen.getByRole("table", { name: "Equipe da plataforma" })).getAllByRole("columnheader");
    expect(headers.map((h) => h.getAttribute("aria-label") ?? h.textContent)).toEqual(["Pessoa", "Papel", "Status", "Ações"]);
    expect(screen.getByRole("link", { name: /Caio Teodoro/ })).toHaveAttribute("href", "/admin/users/7");
  });

  it("lista as pessoas com papel e status; a própria conta diz 'Você' e não tem botão", async () => {
    await renderPage();
    expect(within(rowOf("Caio Teodoro")).getByText("Suporte")).toBeInTheDocument();
    expect(within(rowOf("Leo Ramos")).getByText("Suspenso")).toBeInTheDocument();
    expect(within(rowOf("Marina Alves")).getByText("Você")).toBeInTheDocument();
    // as ações (alterar papel e gerar código de recuperação) ficam num menu "Ações" por pessoa: só para o administrador,
    // em quem é da equipe e nunca na própria linha
    expect(within(rowOf("Marina Alves")).queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument();
    expect(within(rowOf("Caio Teodoro")).getByRole("button", { name: "Ações de Caio Teodoro" })).toBeInTheDocument();
    expect(within(rowOf("Leo Ramos")).getByRole("button", { name: "Ações de Leo Ramos" })).toBeInTheDocument();
  });

  it("mostra a foto de quem tem; sem foto ficam as iniciais", async () => {
    await renderPage();
    expect(rowOf("Caio Teodoro").querySelector("img")).toHaveAttribute("src", "https://cdn.test/caio.jpg");
    expect(rowOf("Leo Ramos").querySelector("img")).toBeNull();
    expect(within(rowOf("Leo Ramos")).getByText("LR")).toBeInTheDocument();
  });
});

describe("Equipe: alterar papel (administrador)", () => {
  async function openEdit(name = "Caio Teodoro") {
    const ctx = await renderPage();
    await ctx.user.click(within(rowOf(name)).getByRole("button", { name: `Ações de ${name}` }));
    await ctx.user.click(await screen.findByRole("menuitem", { name: "Alterar papel" }));
    const dialog = await screen.findByRole("dialog", { name: `Papel de ${name}` });
    return { ...ctx, dialog };
  }
  const save = () => screen.getByRole("button", { name: "Salvar papel" });

  it("mostra o papel atual e só habilita com um papel diferente e o motivo", async () => {
    const { user, dialog } = await openEdit();
    expect(within(dialog).getByText(/papel atual/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Mudança de função na equipe");
    expect(save()).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /Somente leitura/ }));
    expect(save()).toBeEnabled();
    await user.click(within(dialog).getByRole("radio", { name: /Suporte/ }));
    expect(save()).toBeDisabled();
  });

  it("confirma: PATCH com role e motivo, Idempotency-Key, aviso e a lista atualizada", async () => {
    mocks.adminPatch.mockResolvedValue({ user_id: 7, role: "viewer", previous_role: "support" });
    const { user, dialog } = await openEdit();
    await user.click(within(dialog).getByRole("radio", { name: /Somente leitura/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Mudança de função na equipe");
    await user.click(save());

    await waitFor(() => expect(mocks.adminPatch).toHaveBeenCalledTimes(1));
    const [path, body, options] = mocks.adminPatch.mock.calls[0];
    expect(path).toBe("/admin/users/7/platform-role");
    expect(body).toEqual({ role: "viewer", reason: "Mudança de função na equipe" });
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Papel definido: Somente leitura.", expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("'Tirar da equipe' é perigoso: botão próprio e envia role null", async () => {
    mocks.adminPatch.mockResolvedValue({ user_id: 7, role: null, previous_role: "support" });
    const { user, dialog } = await openEdit();
    await user.click(within(dialog).getByRole("radio", { name: /Tirar da equipe/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Saiu da empresa");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tirar da equipe" }));
    await waitFor(() => expect(mocks.adminPatch).toHaveBeenCalled());
    expect(mocks.adminPatch.mock.calls[0][1]).toEqual({ role: null, reason: "Saiu da empresa" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Pessoa tirada da equipe.", expect.anything());
  });

  it("LAST_PLATFORM_ADMIN: explica que precisa promover outra conta e deixa o diálogo aberto", async () => {
    mocks.adminPatch.mockRejectedValue(
      toAdminApiError(409, { message: "x", error: "LAST_PLATFORM_ADMIN" }),
    );
    const { user, dialog } = await openEdit("Caio Teodoro");
    await user.click(within(dialog).getByRole("radio", { name: /Somente leitura/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Teste do último administrador");
    await user.click(save());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("única conta administradora ativa");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("validação do servidor em inglês vira frase em português", async () => {
    mocks.adminPatch.mockRejectedValue(
      toAdminApiError(400, { message: ["reason must be longer than or equal to 5 characters"], error: "Bad Request" }),
    );
    const { user, dialog } = await openEdit();
    await user.click(within(dialog).getByRole("radio", { name: /Somente leitura/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Mudança de função na equipe");
    await user.click(save());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O motivo precisa ter pelo menos 5 caracteres.");
  });
});

describe("Equipe: adicionar pessoa", () => {
  async function openAdd() {
    const ctx = await renderPage();
    await ctx.user.click(screen.getByRole("button", { name: "Adicionar pessoa" }));
    const dialog = await screen.findByRole("dialog", { name: "Adicionar pessoa à equipe" });
    return { ...ctx, dialog };
  }

  it("busca só depois do mínimo de letras, escolhe a conta no seletor e o papel, e envia", async () => {
    mocks.adminPatch.mockResolvedValue({ user_id: 20, role: "support", previous_role: null });
    const { user, dialog } = await openAdd();

    // a escolha é obrigatória: a pílula pede uma conta (nunca promete um "Todos") e não há dica fixa no diálogo
    const pill = within(dialog).getByRole("button", { name: /^Conta:/ });
    expect(pill).toHaveTextContent("Escolha…");
    expect(pill).not.toHaveTextContent("Todos");
    expect(within(dialog).queryByText(new RegExp(`pelo menos ${TEAM_SEARCH_MIN} letras`))).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Limpar/ })).not.toBeInTheDocument();
    expect(searchCalls()).toHaveLength(0);

    await user.click(pill);
    const search = await screen.findByRole("combobox", { name: "Buscar conta" });
    // a dica do seletor toma o lugar do vazio enganoso, sem "Todos" na lista, e nada vai ao servidor antes do mínimo
    expect((await screen.findAllByText(`Digite pelo menos ${TEAM_SEARCH_MIN} letras`)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: /Todos|Escolha uma conta/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma conta ativa encontrada")).not.toBeInTheDocument();
    await user.type(search, "b");
    expect(screen.getAllByText(`Digite pelo menos ${TEAM_SEARCH_MIN} letras`).length).toBeGreaterThan(0);
    expect(searchCalls()).toHaveLength(0);
    await user.type(search, "ia");
    const option = await screen.findByRole("option", { name: /Bia Santos/ });
    expect(mocks.adminList).toHaveBeenCalledWith(
      "/admin/users",
      expect.objectContaining({ search: "bia", kind: "brand", status: "active" }),
      expect.anything(),
    );
    await user.click(option);

    expect(within(dialog).getByRole("button", { name: /^Conta:/ })).toHaveTextContent("Bia Santos");
    expect(screen.getByRole("button", { name: "Salvar papel" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /Suporte/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Entrou no time de suporte");
    await user.click(screen.getByRole("button", { name: "Salvar papel" }));

    await waitFor(() => expect(mocks.adminPatch).toHaveBeenCalled());
    expect(mocks.adminPatch.mock.calls[0][0]).toBe("/admin/users/20/platform-role");
    expect(mocks.adminPatch.mock.calls[0][1]).toEqual({ role: "support", reason: "Entrou no time de suporte" });
  });

  it("sem resultado: o seletor diz que não achou (a busca já passou do mínimo de letras)", async () => {
    const { user, dialog } = await openAdd();
    await user.click(within(dialog).getByRole("button", { name: /^Conta:/ }));
    await user.type(await screen.findByRole("combobox", { name: "Buscar conta" }), "zzz");
    expect(await screen.findByText("Nenhuma conta ativa encontrada")).toBeInTheDocument();
    expect(screen.queryByText(/Digite pelo menos/)).not.toBeInTheDocument();
  });

  it("Esc fecha primeiro o seletor, depois o diálogo; gravando, nem o Esc nem o fechar fecham", async () => {
    mocks.adminPatch.mockReturnValue(new Promise(() => undefined));
    const { user, dialog } = await openAdd();
    await user.click(within(dialog).getByRole("button", { name: /^Conta:/ }));
    await screen.findByRole("combobox", { name: "Buscar conta" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Buscar conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Adicionar pessoa à equipe" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^Conta:/ }));
    await user.type(await screen.findByRole("combobox", { name: "Buscar conta" }), "bia");
    await user.click(await screen.findByRole("option", { name: /Bia Santos/ }));
    await user.click(within(dialog).getByRole("radio", { name: /Suporte/ }));
    await user.type(within(dialog).getByLabelText(/Motivo/), "Entrou no time de suporte");
    await user.click(screen.getByRole("button", { name: "Salvar papel" }));

    expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Adicionar pessoa à equipe" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeDisabled();
  });
});

describe("Equipe: sem permissão de administrador", () => {
  it("suporte vê a lista, sem 'Adicionar pessoa' nem 'Alterar papel'", async () => {
    mocks.auth.user = { id: 7, name: "Caio Teodoro", platform_role: "support" };
    await renderPage();
    expect(screen.queryByRole("button", { name: "Adicionar pessoa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Alterar papel" })).not.toBeInTheDocument();
    expect(within(rowOf("Caio Teodoro")).getByText("Você")).toBeInTheDocument();
  });

  it("somente leitura também não vê 'Gerar código de recuperação'", async () => {
    mocks.auth.user = { id: 8, name: "Leo Ramos", platform_role: "viewer" };
    await renderPage();
    expect(screen.queryByRole("button", { name: /^Ações de/ })).not.toBeInTheDocument();
  });

  it("o menu de ações do administrador traz 'Alterar papel' e 'Gerar código de recuperação'", async () => {
    const { user } = await renderPage();
    await user.click(within(rowOf("Caio Teodoro")).getByRole("button", { name: "Ações de Caio Teodoro" }));
    expect(await screen.findByRole("menuitem", { name: "Alterar papel" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Gerar código de recuperação" })).toBeInTheDocument();
  });

  it("erro ao carregar a equipe mostra o estado de erro com 'Tentar de novo'", async () => {
    mocks.adminGet.mockImplementation(async () => {
      throw toAdminApiError(500, { message: "falhou" });
    });
    renderRoutes(ROUTES, "/admin/team");
    // o erro é da tabela, inline: a página (título e ação) continua, e os papéis não aparecem sem dados
    expect(await screen.findByRole("button", { name: /Tentar de novo|Tentar novamente/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Pessoas" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Equipe da plataforma" })).toBeInTheDocument();
    expect(screen.queryByText("O que cada papel pode fazer")).not.toBeInTheDocument();
  });
});
