import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  ...api,
}));
vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock());
// o `adminToast` do kit é quem fala com o `sonner`: o aviso chega com o texto e as opções (duração)
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { toAdminApiError } from "@/lib/admin/admin-client";

import {
  apiError,
  deferred,
  listOf,
  makeDetail,
  makeMember,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  UUID_V4,
  WS_ID,
} from "./test-support";
import { WorkspaceMembersTab } from "./workspace-members-tab";

const MEMBERS_PATH = `/admin/workspaces/${WS_ID}/members`;
const HELENA = makeMember();
const CAIO = makeMember({
  user_id: 12,
  name: "Caio Ramos",
  email: "caio@serraverde.com.br",
  role: "member",
  has_custom_permissions: true,
  joined_at: "2026-01-05T12:00:00.000Z",
  last_session_at: null,
});
const MARINA = makeMember({
  user_id: 1,
  name: "Marina Albuquerque",
  email: "marina@hype.com.br",
  role: "admin",
  is_platform_admin: true,
  user_status: "suspended",
  joined_at: "2026-02-10T12:00:00.000Z",
});

const SESSION_DEFINITION = "Aproximação: maior last_used_at das sessões (±5 min).";

/** O detalhe diz 3 pessoas com acesso (`counts.members`, sem contas excluídas): é o número do selo da aba e do cabeçalho. */
const DETAIL_WITH_3 = () => makeDetail("active", { counts: { ...makeDetail().counts, members: 3 } });

function renderTab(workspace = DETAIL_WITH_3()) {
  return renderWithQuery(<WorkspaceMembersTab workspace={workspace} />);
}

const button = (name: string) => screen.getByRole("button", { name });
const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement;
const lastBody = (mock: typeof api.adminPost) => mock.mock.calls.at(-1) as [string, Record<string, unknown>, { idempotencyKey: string }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  routeReads(api.adminList, {
    [MEMBERS_PATH]: () => listOf([HELENA, CAIO, MARINA], 3, 1, 100, { last_session: SESSION_DEFINITION }),
  });
  api.adminPost.mockImplementation(async () => makeMember({ user_id: 99 }));
  api.adminPatch.mockImplementation(async () => makeMember({ user_id: 12, role: "aprovador" }));
});
afterEach(() => vi.useRealTimers());

describe("WorkspaceMembersTab · lista", () => {
  it("cada pessoa com e-mail, papel em pt-BR, entrada, status de acesso e última sessão aproximada", async () => {
    renderTab();
    await screen.findByText("Helena Prado");

    expect(screen.getByText("3 pessoas com acesso")).toBeInTheDocument();
    const helena = rowOf("Helena Prado");
    expect(within(helena).getByText("helena@serraverde.com.br")).toBeInTheDocument();
    expect(within(helena).getByText("Proprietário")).toBeInTheDocument();
    expect(within(helena).getByText("12/03/2025")).toBeInTheDocument();
    expect(within(helena).getByText("Ativo", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(helena).getByText("ontem")).toBeInTheDocument();

    const caio = rowOf("Caio Ramos");
    expect(within(caio).getByText("Membro")).toBeInTheDocument();
    expect(within(caio).getByText("permissões personalizadas")).toBeInTheDocument();
    expect(within(caio).getByText("Sem sessão")).toHaveAttribute("title", expect.stringMatching(/Sem sessão registrada/));
    expect(within(helena).queryByText("permissões personalizadas")).not.toBeInTheDocument();
  });

  it("conta excluída continua na lista, marcada, e NÃO conta como acesso (o número é o do selo da aba e do cabeçalho)", async () => {
    const gone = makeMember({ user_id: 77, name: "Kaique Lima", email: "kaique@kappa.com.br", user_status: "deleted", last_session_at: null });
    routeReads(api.adminList, { [MEMBERS_PATH]: () => listOf([gone], 1, 1, 100) });
    // Workspace cujo único membro é uma conta excluída: o selo e o cabeçalho dizem 0.
    const detail = makeDetail("active", { counts: { ...makeDetail().counts, members: 0 } });
    renderTab(detail);
    await screen.findByText("Kaique Lima");

    expect(screen.getByText("0 pessoas com acesso (1 conta excluída listada, sem acesso)")).toBeInTheDocument();
    expect(screen.queryByText(/^1 pessoa com acesso/)).not.toBeInTheDocument();
    const row = rowOf("Kaique Lima");
    expect(within(row).getByText("Excluído", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(row).getByText("Conta excluída: não conta como acesso")).toBeInTheDocument();
  });

  it("sem contas excluídas na lista o texto é só o número de pessoas com acesso, no singular quando é 1", async () => {
    routeReads(api.adminList, { [MEMBERS_PATH]: () => listOf([HELENA], 1, 1, 100) });
    renderTab(makeDetail("active", { counts: { ...makeDetail().counts, members: 1 } }));
    await screen.findByText("Helena Prado");
    expect(screen.getByText("1 pessoa com acesso")).toBeInTheDocument();
  });

  it("marca quem é administrador da plataforma e mostra o acesso suspenso", async () => {
    renderTab();
    await screen.findByText("Marina Albuquerque");

    const marina = rowOf("Marina Albuquerque");
    expect(within(marina).getByText("Admin da plataforma")).toBeInTheDocument();
    expect(within(marina).getByText("Suspenso", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(rowOf("Helena Prado")).queryByText("Admin da plataforma")).not.toBeInTheDocument();
  });

  it("o 'i' da última sessão traz a definição do servidor", async () => {
    renderTab();
    await screen.findByText("Helena Prado");
    expect(screen.getByRole("button", { name: "Como é calculado: Última sessão" })).toHaveAccessibleDescription(SESSION_DEFINITION);
  });

  it("carregando, vazio e erro", async () => {
    const pending = deferred<never>();
    api.adminList.mockReturnValue(pending.promise);
    const first = renderTab();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    first.unmount();

    routeReads(api.adminList, { [MEMBERS_PATH]: listOf([]) });
    const second = renderTab();
    expect(await screen.findByText("Nenhum usuário neste workspace")).toBeInTheDocument();
    second.unmount();

    api.adminList.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /api/backoffice/admin/workspaces/x/members" }));
    renderTab();
    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
  });

  it("paginação só aparece quando há mais de uma página; trocar de página pede a seguinte", async () => {
    routeReads(api.adminList, { [MEMBERS_PATH]: (query) => listOf([HELENA], 250, Number(query?.page ?? 1), 100) });
    renderTab();
    await screen.findByText("Helena Prado");
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–100 de 250");

    await userEvent.click(button("Página 2"));
    await waitFor(() => expect(api.adminList.mock.calls.at(-1)?.[1]).toMatchObject({ page: 2, per_page: 100 }));
  });

  it("uma página só: sem paginação", async () => {
    renderTab();
    await screen.findByText("Helena Prado");
    expect(screen.queryByRole("navigation", { name: "Paginação" })).not.toBeInTheDocument();
  });
});

describe("WorkspaceMembersTab · adicionar membro", () => {
  async function openAdd() {
    renderTab();
    await screen.findByText("Helena Prado");
    await userEvent.click(button("Adicionar membro"));
    return screen.getByRole("dialog", { name: "Adicionar membro" });
  }

  it("e-mail válido, papel e motivo: sem e-mail válido o botão fica desabilitado e o erro aparece ao sair do campo", async () => {
    await openAdd();
    const email = screen.getByLabelText("E-mail da pessoa");
    expect(email).toHaveFocus();
    expect(button("Adicionar")).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^Motivo/), "Novo analista de marketing");
    await userEvent.type(email, "nao-e-email");
    await userEvent.tab();
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(button("Adicionar")).toBeDisabled();

    await userEvent.clear(email);
    await userEvent.type(email, "novo@empresa.com.br");
    expect(button("Adicionar")).toBeEnabled();
  });

  it("papel não atribuível pelo Admin ('Personalizado') não é oferecido; o padrão é Membro", async () => {
    await openAdd();
    const select = screen.getByLabelText("Papel");
    expect(select).toHaveValue("member");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Proprietário", "Administrador", "Membro", "Aprovador", "Observador", "Jurídico", "Financeiro", "Analista"]);
  });

  it("envia e-mail (aparado, minúsculo), papel e motivo com Idempotency-Key; avisa, fecha e atualiza a lista", async () => {
    await openAdd();
    await userEvent.type(screen.getByLabelText("E-mail da pessoa"), "  Novo.Analista@Empresa.com.br ");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "financeiro");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Novo analista financeiro do cliente");
    const before = api.adminList.mock.calls.length;
    await userEvent.click(button("Adicionar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [path, body, options] = lastBody(api.adminPost);
    expect(path).toBe(MEMBERS_PATH);
    expect(body).toEqual({ reason: "Novo analista financeiro do cliente", email: "novo.analista@empresa.com.br", role: "financeiro" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Membro adicionado.", expect.anything());
    await waitFor(() => expect(api.adminList.mock.calls.length).toBeGreaterThan(before)); // a lista foi consultada de novo
  });

  it("pessoa que já é membro (409 sem código): o texto do servidor aparece e o diálogo continua aberto", async () => {
    api.adminPost.mockRejectedValue(toAdminApiError(409, { statusCode: 409, message: "Este usuário já é membro do workspace." }));
    await openAdd();
    await userEvent.type(screen.getByLabelText("E-mail da pessoa"), "helena@serraverde.com.br");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Tentando adicionar de novo");
    await userEvent.click(button("Adicionar"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este usuário já é membro do workspace.");
    expect(screen.getByRole("dialog", { name: "Adicionar membro" })).toBeInTheDocument();
  });

  it("repetir o mesmo envio depois de uma falha reaproveita a Idempotency-Key", async () => {
    api.adminPost.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Sem rede")).mockResolvedValueOnce(makeMember({ user_id: 99 }));
    await openAdd();
    await userEvent.type(screen.getByLabelText("E-mail da pessoa"), "novo@empresa.com.br");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Novo analista de marketing");
    await userEvent.click(button("Adicionar"));
    await screen.findByRole("alert");
    await userEvent.click(button("Adicionar"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((api.adminPost.mock.calls[1] as [string, unknown, { idempotencyKey: string }])[2].idempotencyKey).toBe(
      (api.adminPost.mock.calls[0] as [string, unknown, { idempotencyKey: string }])[2].idempotencyKey,
    );
  });
});

describe("WorkspaceMembersTab · alterar papel", () => {
  async function openRole(name: string) {
    renderTab();
    await screen.findByText(name);
    await userEvent.click(button(`Alterar papel de ${name}`));
  }

  it("mostra o papel atual e só habilita com um papel diferente e o motivo", async () => {
    await openRole("Helena Prado");
    const dialog = screen.getByRole("dialog", { name: "Alterar papel" });

    expect(dialog).toHaveTextContent("Papel atual: Proprietário.");
    expect(screen.getByLabelText("Novo papel")).toHaveValue("owner");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Mudança de função na empresa");
    expect(button("Alterar papel")).toBeDisabled();
    expect(screen.getByText("Escolha um papel diferente do atual.")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Novo papel"), "aprovador");
    expect(button("Alterar papel")).toBeEnabled();
  });

  it("envia o novo papel e o motivo (PATCH), avisa e fecha", async () => {
    await openRole("Caio Ramos");
    await userEvent.selectOptions(screen.getByLabelText("Novo papel"), "aprovador");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Passou a aprovar conteúdos");
    await userEvent.click(button("Alterar papel"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [path, body, options] = lastBody(api.adminPatch);
    expect(path).toBe(`${MEMBERS_PATH}/12`);
    expect(body).toEqual({ reason: "Passou a aprovar conteúdos", role: "aprovador" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Papel de Caio Ramos alterado para Aprovador.", expect.anything());
  });

  it("quem tem permissões personalizadas: avisa que elas sobrescrevem o papel e não escolhe papel por ele", async () => {
    await openRole("Caio Ramos");
    expect(screen.getByRole("dialog", { name: "Alterar papel" })).toHaveTextContent(/permissões personalizadas, que sobrescrevem o padrão do papel/);
    expect(screen.getByLabelText("Novo papel")).toHaveValue("member"); // papel padrão atribuível dele
  });

  it("LAST_OWNER ao rebaixar o último proprietário: a frase certa, no diálogo", async () => {
    api.adminPatch.mockRejectedValue(apiError(409, "LAST_OWNER", "x"));
    await openRole("Helena Prado");
    await userEvent.selectOptions(screen.getByLabelText("Novo papel"), "member");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Rebaixando o proprietário");
    await userEvent.click(button("Alterar papel"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este é o último proprietário do workspace. Defina outro proprietário antes de remover ou rebaixar esta pessoa.",
    );
    expect(screen.getByRole("dialog", { name: "Alterar papel" })).toBeInTheDocument();
  });

  it("workspace que mudou por fora: avisa, fecha e consulta de novo", async () => {
    api.adminPatch.mockRejectedValue(apiError(409, "INVALID_STATE_TRANSITION", "x"));
    await openRole("Caio Ramos");
    await userEvent.selectOptions(screen.getByLabelText("Novo papel"), "analista");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Mudança de função");
    await userEvent.click(button("Alterar papel"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/estado do workspace mudou/), expect.anything());
  });
});

describe("WorkspaceMembersTab · ações da linha", () => {
  it("'Alterar papel' fica visível na linha; 'Remover' (destrutivo) só aparece no menu '⋯', separado e em vermelho", async () => {
    renderTab();
    await screen.findByText("Caio Ramos");
    const caio = rowOf("Caio Ramos");

    expect(within(caio).getByRole("button", { name: "Alterar papel de Caio Ramos" })).toHaveTextContent("Alterar papel");
    expect(within(caio).queryByRole("button", { name: /^Remover/ })).not.toBeInTheDocument();

    const trigger = within(caio).getByRole("button", { name: "Ações de Caio Ramos" });
    await userEvent.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Remover do workspace"]);
    expect(items[0]).toHaveAttribute("data-tone", "danger");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("a pessoa é a célula do kit: avatar, e-mail e o selo 'Admin da plataforma' ao lado do nome", async () => {
    renderTab();
    await screen.findByText("Marina Albuquerque");
    const person = within(rowOf("Marina Albuquerque")).getByText("marina@hype.com.br").closest(".adm-entity") as HTMLElement;
    expect(person.querySelector(".adm-entity-av")).not.toBeNull();
    // o selo mora no título da célula (o nome encolhe antes de o selo sumir), não numa caixa própria de Workspaces
    expect(person.querySelector(".adm-entity-title .adm-entity-badge")).toHaveTextContent("Admin da plataforma");
    expect(person.querySelector(".adm-workspaces-person")).toBeNull();
    expect(person.closest(".adm-workspaces-person")).toBeNull();
  });

  it("a conta excluída avisa no apoio da pessoa, que pode ocupar duas linhas (subtitleWrap)", async () => {
    const gone = makeMember({ user_id: 77, name: "Kaique Lima", email: "kaique@kappa.com.br", user_status: "deleted", last_session_at: null });
    routeReads(api.adminList, { [MEMBERS_PATH]: () => listOf([gone], 1, 1, 100) });
    renderTab(makeDetail("active", { counts: { ...makeDetail().counts, members: 0 } }));
    await screen.findByText("Kaique Lima");
    const warning = within(rowOf("Kaique Lima")).getByText("Conta excluída: não conta como acesso");
    expect(warning.closest("small")).toHaveAttribute("data-wrap", "true");
    expect(warning.closest("small")).toHaveTextContent("kaique@kappa.com.br");
  });
});

describe("WorkspaceMembersTab · remover", () => {
  async function openRemove(name: string) {
    renderTab();
    await screen.findByText(name);
    // "Remover" mora no menu "⋯" da linha (a ação destrutiva sai da vista); a confirmação e o motivo são os mesmos
    await userEvent.click(button(`Ações de ${name}`));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remover do workspace" }));
  }

  it("explica o que acontece e envia só o motivo (POST .../remove)", async () => {
    api.adminPost.mockResolvedValue({ user_id: 12, removed: true });
    await openRemove("Caio Ramos");

    const dialog = screen.getByRole("alertdialog", { name: "Remover do workspace" });
    expect(dialog).toHaveTextContent("Confirme a remoção de Caio Ramos (caio@serraverde.com.br) deste workspace.");
    expect(dialog).toHaveTextContent("A pessoa perde o acesso a este workspace.");
    expect(dialog).toHaveTextContent("A conta dela continua existindo");

    expect(button("Remover")).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Saiu da empresa");
    await userEvent.click(button("Remover"));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const [path, body, options] = lastBody(api.adminPost);
    expect(path).toBe(`${MEMBERS_PATH}/12/remove`);
    expect(body).toEqual({ reason: "Saiu da empresa" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Caio Ramos foi removido do workspace.", expect.anything());
  });

  it.each([
    ["LAST_OWNER", 409, /último proprietário do workspace/],
    ["CANNOT_ACT_ON_SELF", 409, /sua própria conta/],
    ["CANNOT_ACT_ON_PLATFORM_ADMIN", 409, /outro administrador da plataforma/],
  ])("%s é traduzido para uma frase clara e o diálogo continua aberto", async (code, status, expected) => {
    api.adminPost.mockRejectedValue(apiError(status, code, "x"));
    await openRemove("Helena Prado");
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Removendo para teste");
    await userEvent.click(button("Remover"));

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("WorkspaceMembersTab · workspace que não aceita alterações", () => {
  it("excluído: sem 'Adicionar membro' e sem ações por linha, com o motivo dito", async () => {
    renderTab(makeDetail("deleted"));
    await screen.findByText("Helena Prado");

    expect(screen.queryByRole("button", { name: "Adicionar membro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alterar papel de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ações de/ })).not.toBeInTheDocument();
    expect(screen.getByText("Workspace excluído: o acesso não pode ser alterado.")).toBeInTheDocument();
  });

  it("qualquer outro estado em que o servidor não permite editar também esconde as ações", async () => {
    renderTab(makeDetail("archived", { can: { ...makeDetail("archived").can, update: false } }));
    await screen.findByText("Helena Prado");
    expect(screen.queryByRole("button", { name: "Adicionar membro" })).not.toBeInTheDocument();
    expect(screen.getByText("O estado atual do workspace não permite alterar o acesso.")).toBeInTheDocument();
  });
});
