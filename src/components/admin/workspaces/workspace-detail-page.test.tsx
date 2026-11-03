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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminWorkspaceDetail, AdminWorkspaceStatus } from "@/shared/admin-platform.types";

import {
  apiError,
  deferred,
  fakeRouter,
  listOf,
  makeCampaign,
  makeDetail,
  makeFinancial,
  makeImpact,
  makeMember,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  WS_ID,
} from "./test-support";
import { WorkspaceDetailPage } from "./workspace-detail-page";

const DETAIL = `/admin/workspaces/${WS_ID}`;
const EMPTY_FEED = { data: [], meta: { next_cursor: null, has_more: false } };

let current: AdminWorkspaceDetail;

function serve(status: AdminWorkspaceStatus = "active", over: Partial<AdminWorkspaceDetail> = {}) {
  current = makeDetail(status, over);
  routeReads(api.adminGet, {
    [DETAIL]: () => current,
    [`${DETAIL}/impact`]: () => makeImpact(),
    [`${DETAIL}/financial`]: makeFinancial(),
  });
  routeReads(api.adminList, {
    [`${DETAIL}/members`]: listOf([makeMember(), makeMember({ user_id: 12, name: "Caio Ramos", email: "caio@serraverde.com.br", role: "member" })]),
    [`${DETAIL}/campaigns`]: listOf([makeCampaign()]),
  });
  routeReads(api.adminFeed, { [`${DETAIL}/activity`]: EMPTY_FEED, "/admin/financial/movements": EMPTY_FEED });
}

const calledPaths = () =>
  [...api.adminGet.mock.calls, ...api.adminList.mock.calls, ...api.adminFeed.mock.calls].map((call) => call[0] as string);

/** A etiqueta de estado do cabeçalho (o mesmo estado também aparece no cartão "Ciclo de vida" do Resumo). */
const headerBadge = (text: string) => within(document.querySelector(".adm-head") as HTMLElement).getByText(text, { selector: ".adm-badge" });

function renderPage() {
  return renderWithQuery(<WorkspaceDetailPage workspaceId={WS_ID} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  fakeRouter.set({});
  serve();
});
afterEach(() => vi.useRealTimers());

describe("WorkspaceDetailPage · cabeçalho", () => {
  it("carregando: esqueleto no padrão dos outros detalhes (título 'Workspace' para leitor de tela) com o 'voltar' já funcionando", async () => {
    api.adminGet.mockReturnValue(deferred<never>().promise);
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando workspace…");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Workspace");
    expect(screen.getByRole("link", { name: "Workspaces" })).toHaveAttribute("href", "/admin/workspaces");
  });

  it("nome, estado, responsável, 'Cliente desde' e a última atividade como linha discreta", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Café Serra Verde" })).toBeInTheDocument();
    expect(headerBadge("Ativo")).toBeInTheDocument();
    const meta = document.querySelector(".adm-head-meta") as HTMLElement;
    expect(meta).toHaveTextContent("Responsável Helena Prado");
    expect(meta).toHaveTextContent("Cliente desde 12/03/2025");
    expect(meta).toHaveTextContent("Última atividade há 3 dias");
    // a regra da última atividade mora no "i" (o Resumo não repete a data)
    expect(within(meta).getByRole("button", { name: "Como é calculado: Última atividade" })).toHaveAccessibleDescription(
      /updated_at do workspace não conta/,
    );
    expect(screen.getByRole("navigation", { name: "Navegação" })).toHaveTextContent("Workspaces");
    expect(screen.getByRole("link", { name: "Workspaces" })).toHaveAttribute("href", "/admin/workspaces");
  });

  it("mais de um proprietário: 'e mais N'; sem nenhum: aviso 'Sem responsável'; sem atividade: diz isso", async () => {
    serve("active", {
      owners: [
        { user_id: 11, name: "Helena Prado", email: "h@x.com" },
        { user_id: 12, name: "Caio Ramos", email: "c@x.com" },
      ],
      activity: { state: "never", last_activity_at: null, window_days: 30 },
    });
    const first = renderPage();
    expect(await screen.findByText("e mais 1", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Sem atividade registrada")).toBeInTheDocument();
    // sem atividade a regra continua à mão: era a única explicação de "Última atividade" que o Resumo deu antes
    expect(screen.getByRole("button", { name: "Como é calculado: Última atividade" })).toHaveAccessibleDescription(
      /updated_at do workspace não conta/,
    );
    first.unmount();

    serve("active", { owners: [] });
    renderPage();
    expect(await screen.findByText("Sem responsável", { selector: ".adm-head-meta .adm-badge" })).toHaveAttribute("data-tone", "warn");
  });

  it("etiqueta de tipo só quando não é cliente (marca)", async () => {
    const brand = renderPage();
    await screen.findByRole("heading", { level: 1, name: "Café Serra Verde" });
    expect(screen.queryByText("Pessoal de criador")).not.toBeInTheDocument();
    brand.unmount();

    serve("active", { kind: "creator_personal" });
    renderPage();
    expect(await screen.findByText("Pessoal de criador")).toBeInTheDocument();
    expect(document.querySelector(".adm-head-meta")).toHaveTextContent("Criado em 12/03/2025");
  });
});

describe("WorkspaceDetailPage · erros", () => {
  it("workspace inexistente: 'Não encontramos este workspace' (kit), sem tentar de novo, e dá para voltar à lista", async () => {
    api.adminGet.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Workspace não encontrado." }));
    renderPage();

    expect(await screen.findByText("Não encontramos este workspace")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Workspaces" })).toHaveAttribute("href", "/admin/workspaces");
  });

  it("recurso ainda não disponível no servidor", async () => {
    api.adminGet.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /api/backoffice/admin/workspaces/x" }));
    renderPage();
    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
  });

  it("erro do servidor: 'Tentar de novo' recarrega e a página abre", async () => {
    api.adminGet.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    renderPage();

    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    serve();
    await userEvent.click(retry);
    expect(await screen.findByRole("heading", { level: 1, name: "Café Serra Verde" })).toBeInTheDocument();
  });
});

describe("WorkspaceDetailPage · menu Ações e edição", () => {
  const MENU: Array<[AdminWorkspaceStatus, string[]]> = [
    ["active", ["Suspender", "Arquivar", "Excluir"]],
    ["suspended", ["Reativar", "Arquivar", "Excluir"]],
    ["archived", ["Desarquivar", "Excluir"]],
    ["deleted", ["Restaurar"]],
  ];

  it.each(MENU)("workspace %s: o menu oferece só %j", async (status, items) => {
    serve(status);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(items);
  });

  it("Excluir é o último item, separado e em vermelho; o menu é um só (não uma fileira de botões)", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));

    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("menuitem", { name: "Suspender" })).not.toHaveAttribute("data-tone");
    expect(screen.getAllByRole("menuitem").at(-1)).toHaveTextContent("Excluir");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspender" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ações" })).toHaveAttribute("aria-expanded", "true");
  });

  it("o menu segue o teclado: foco no primeiro item, setas, Escape fecha e devolve o foco ao botão", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: "Ações" });
    await userEvent.click(trigger);

    const [first, second, third] = screen.getAllByRole("menuitem");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(third).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar fora fecha o menu", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("escolher um item abre o diálogo da ação e, ao cancelar, o foco volta ao botão 'Ações'", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: "Ações" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Suspender" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Suspender workspace" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("suspender pela página atualiza o cabeçalho e o menu na hora (a resposta já é o workspace novo)", async () => {
    api.adminPost.mockImplementation(async () => {
      current = makeDetail("suspended");
      return current;
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Suspender" }));
    await userEvent.type(screen.getByLabelText(/^Motivo/), "Cobrança em aberto");
    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(headerBadge("Suspenso")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ações" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Reativar", "Arquivar", "Excluir"]);
  });

  it("'Editar dados' abre o diálogo de edição", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Editar dados" }));
    expect(screen.getByRole("dialog", { name: "Editar dados" })).toBeInTheDocument();
  });

  it("excluir bloqueado oferece arquivar no lugar e a página troca de diálogo", async () => {
    routeReads(api.adminGet, {
      [DETAIL]: () => current,
      [`${DETAIL}/impact`]: () =>
        makeImpact({
          blockers: [{ code: "HAS_PUBLISHED_CAMPAIGNS", message: "Há 2 campanhas publicadas.", count: 2 }],
          can: { delete: false },
        }),
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Arquivar em vez de excluir" }));

    expect(await screen.findByRole("dialog", { name: "Arquivar workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("WorkspaceDetailPage · workspace excluído", () => {
  beforeEach(() => {
    serve("deleted", {
      lifecycle: {
        status: "deleted",
        suspended_at: null,
        archived_at: null,
        deleted_at: "2026-10-20T12:00:00.000Z",
        status_changed_at: "2026-10-20T12:00:00.000Z",
        status_reason: "Cliente encerrou o contrato",
        status_changed_by: { user_id: 1, name: "Marina Albuquerque" },
      },
    });
  });

  it("abre só para consulta, com um aviso claro de quando, por quem e por quê", async () => {
    renderPage();

    const notice = await screen.findByText("Este workspace foi excluído");
    expect(notice.closest(".adm-workspaces-notice")).toHaveTextContent("Excluído em 20/10/2026 09:00 por Marina Albuquerque");
    expect(notice.closest(".adm-workspaces-notice")).toHaveTextContent("Motivo: Cliente encerrou o contrato");
    expect(headerBadge("Excluído")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar dados" })).toBeDisabled();
  });

  it("a única ação é restaurar", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ações" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    await userEvent.click(screen.getByRole("menuitem", { name: "Restaurar" }));
    expect(screen.getByRole("dialog", { name: "Restaurar workspace" })).toBeInTheDocument();
  });

  it("workspace que não está excluído não mostra o aviso", async () => {
    serve("active");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Café Serra Verde" });
    expect(screen.queryByText("Este workspace foi excluído")).not.toBeInTheDocument();
  });
});

describe("WorkspaceDetailPage · abas", () => {
  it("abre em Resumo e só consulta o detalhe: cada aba carrega quando é aberta", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Café Serra Verde" });

    expect(screen.getByRole("tab", { name: /Resumo/ })).toHaveAttribute("aria-selected", "true");
    expect(calledPaths()).toEqual([DETAIL]);
  });

  it("as abas Usuários e Campanhas mostram a contagem que o detalhe já trouxe", async () => {
    renderPage();
    expect(await screen.findByRole("tab", { name: "Usuários 6" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Campanhas 8" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Atividade" })).toBeInTheDocument();
  });

  it("trocar de aba grava `tab` na URL e carrega só o que a aba precisa", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /Usuários/ }));

    expect(fakeRouter.search).toEqual({ tab: "usuarios" });
    expect(await screen.findByText("Caio Ramos")).toBeInTheDocument();
    expect(calledPaths()).toContain(`${DETAIL}/members`);
    expect(calledPaths()).not.toContain(`${DETAIL}/campaigns`);
    expect(calledPaths()).not.toContain(`${DETAIL}/financial`);
    expect(calledPaths()).not.toContain(`${DETAIL}/activity`);

    await userEvent.click(screen.getByRole("tab", { name: /Campanhas/ }));
    expect(await screen.findByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(calledPaths()).toContain(`${DETAIL}/campaigns`);
    expect(calledPaths()).not.toContain(`${DETAIL}/activity`);

    await userEvent.click(screen.getByRole("tab", { name: /Resumo/ }));
    expect(fakeRouter.search).toEqual({}); // a aba padrão sai da URL
  });

  it("a aba vem da URL (link compartilhado) e valor desconhecido cai em Resumo", async () => {
    fakeRouter.set({ tab: "financeiro" });
    const first = renderPage();
    expect(await screen.findByRole("tab", { name: /Financeiro/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(calledPaths()).toContain(`${DETAIL}/financial`));
    first.unmount();

    fakeRouter.set({ tab: "bogus" });
    renderPage();
    expect(await screen.findByRole("tab", { name: /Resumo/ })).toHaveAttribute("aria-selected", "true");
  });

  it("o painel da aba ativa é o único montado e está ligado à aba", async () => {
    fakeRouter.set({ tab: "usuarios" });
    renderPage();
    const tab = await screen.findByRole("tab", { name: /Usuários/ });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(within(panel).getByRole("table", { name: "Usuários do workspace" })).toBeInTheDocument();
  });
});
