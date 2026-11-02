import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminList: client.adminList,
    adminGet: client.adminGet,
    adminGetEnvelope: client.adminGetEnvelope,
    adminPost: client.adminPost,
    adminPatch: client.adminPatch,
  };
});

// Os gráficos do "Perfil da base" usam as duas rotas do Dashboard antigo, lidas pelo cliente do Admin: aqui só importa quando e com que período
// elas são chamadas.
const dash = vi.hoisted(() => ({ niche: vi.fn(), size: vi.fn() }));
vi.mock("@/hooks/admin/use-admin-creators-profile", () => ({
  useAdminCreatorsNicheProfile: (period: unknown, limit: unknown, options: unknown) => dash.niche(period, limit, options),
  useAdminCreatorsSizeProfile: (period: unknown, options: unknown) => dash.size(period, options),
}));

import { AdminApiError } from "@/lib/admin/admin-client";
import { civilDateInSaoPaulo } from "@/lib/admin/format";
import { currentSearch } from "@/test/render-admin-route";

import { INCOMPLETE_CREATOR, STUB_CREATOR, CREATOR_DEFINITIONS, makeCreator, pageOf } from "./creator-fixtures";
import { renderCreators } from "./creator-test-utils";

const FIRST = makeCreator();

function idle() {
  return { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
}

/** Parâmetros da última consulta à lista de criadores. */
function lastParams(): Record<string, unknown> {
  const calls = client.adminList.mock.calls.filter(([path]) => path === "/admin/creators");
  return calls.at(-1)?.[1] as Record<string, unknown>;
}

async function renderLoaded(url = "/admin/creators") {
  const view = renderCreators(url);
  await screen.findByText(FIRST.name);
  return view;
}

const rowOf = (name: string) => screen.getByText(name).closest("[role=row]") as HTMLElement;

beforeEach(() => {
  for (const mock of Object.values(client)) mock.mockReset();
  dash.niche.mockReset();
  dash.size.mockReset();
  dash.niche.mockImplementation(() => idle());
  dash.size.mockImplementation(() => idle());
  client.adminList.mockImplementation(async () => ({
    ...pageOf([FIRST, INCOMPLETE_CREATOR, STUB_CREATOR]),
    meta: { ...pageOf([]).meta, total: 3, total_pages: 1, definitions: CREATOR_DEFINITIONS },
  }));
});

afterEach(() => {
  cleanup();
});

describe("Criadores: tabela", () => {
  it("consulta só a lista de criadores (as outras abas não carregam) e mostra o criador com foto/iniciais, nome e e-mail", async () => {
    await renderLoaded();
    expect(client.adminList.mock.calls.every(([path]) => path === "/admin/creators")).toBe(true);
    expect(client.adminGetEnvelope).not.toHaveBeenCalled();

    const row = rowOf("Rafael Borges Mendes");
    expect(within(row).getByText("rafael.borges@hotmail.test")).toBeInTheDocument();
    expect(within(row).getByText("RB")).toBeInTheDocument();
  });

  it("redes: ícone, @usuário e seguidores de cada uma; o arroba nunca dobra e o total soma só as ativas", async () => {
    await renderLoaded();
    const row = rowOf("Rafael Borges Mendes");

    const instagram = within(row).getByRole("img", { name: "Instagram" }).closest("li") as HTMLElement;
    expect(instagram).toHaveTextContent("@rafael");
    expect(instagram).toHaveTextContent("4.290");

    const tiktok = within(row).getByRole("img", { name: "TikTok" }).closest("li") as HTMLElement;
    expect(tiktok).toHaveTextContent("@rafael_tt"); // veio como "@rafael_tt"
    expect(tiktok).not.toHaveTextContent("@@");
    expect(tiktok).toHaveTextContent("2.708.790");

    expect(within(row).getByText("2.713.080")).toBeInTheDocument(); // seguidores totais
    expect(within(row).getByText("27")).toBeInTheDocument(); // campanhas
  });

  it("rede desativada aparece apagada e marcada como inativa", async () => {
    await renderLoaded();
    const row = rowOf("Jéssica Moraes");
    const facebook = within(row).getByRole("img", { name: "Instagram / Facebook" }).closest("li") as HTMLElement;
    expect(facebook).toHaveAttribute("data-disabled", "true");
    expect(facebook).toHaveTextContent("inativa");
    const youtube = within(row).getByRole("img", { name: "YouTube" }).closest("li") as HTMLElement;
    expect(youtube).not.toHaveAttribute("data-disabled");
  });

  it("UGC é só uma etiqueta ('UGC'), nunca uma rede: sem ícone de rede e sem linha com seguidores", async () => {
    await renderLoaded();
    const row = rowOf("Jéssica Moraes"); // has_ugc: true, com duas redes de verdade
    expect(within(row).getByText("UGC")).toBeInTheDocument();
    // as redes são só as duas de verdade: YouTube e Instagram / Facebook
    expect(within(row).getAllByRole("img").map((img) => img.getAttribute("aria-label"))).toEqual(["YouTube", "Instagram / Facebook"]);

    // quem tem só UGC (nenhuma rede): só a etiqueta, nem "Sem redes"
    const only = rowOf("Natália Correia");
    expect(within(only).getByText("UGC")).toBeInTheDocument();
    expect(within(only).queryByRole("img")).not.toBeInTheDocument();
    expect(within(only).queryByText("Sem redes")).not.toBeInTheDocument();
  });

  it("mesmo que o servidor mande `ugc` junto das redes, a tela não o trata como rede", async () => {
    const odd = makeCreator({
      id: 9001,
      name: "Criador Estranho",
      has_ugc: false,
      networks: [
        { type: "ugc", username: "marca_ugc", followers: 777, disabled: false },
        { type: "instagram", username: "estranho", followers: 10, disabled: false },
      ],
    });
    client.adminList.mockImplementation(async () => pageOf([FIRST, odd]));
    await renderLoaded();
    const row = rowOf("Criador Estranho");
    expect(within(row).getAllByRole("img")).toHaveLength(1);
    expect(within(row).queryByText("@marca_ugc")).not.toBeInTheDocument();
    expect(within(row).queryByText("777")).not.toBeInTheDocument();
    expect(within(row).getByText("UGC")).toBeInTheDocument();
  });

  it("sem redes e sem UGC: diz 'Sem redes'", async () => {
    client.adminList.mockImplementation(async () => pageOf([FIRST, makeCreator({ id: 9002, name: "Sem Rede", networks: [], followers_total: 0, has_ugc: false })]));
    await renderLoaded();
    expect(within(rowOf("Sem Rede")).getByText("Sem redes")).toBeInTheDocument();
  });

  it("rede sem nome de usuário não vira um '@' solto", async () => {
    client.adminList.mockImplementation(async () =>
      pageOf([FIRST, makeCreator({ id: 9003, name: "Sem Usuario", networks: [{ type: "youtube", username: "  ", followers: 5, disabled: false }] })]),
    );
    await renderLoaded();
    const youtube = within(rowOf("Sem Usuario")).getByRole("img", { name: "YouTube" }).closest("li") as HTMLElement;
    expect(youtube).toHaveTextContent("sem usuário");
    expect(youtube).not.toHaveTextContent(/^@\s/);
  });

  it("cadastro: etiqueta + 'Faltam: …' (dois itens e '+N itens', que abre a lista inteira no lugar)", async () => {
    await renderLoaded();
    const complete = rowOf("Rafael Borges Mendes");
    expect(within(complete).getByText("Completo")).toBeInTheDocument();
    expect(within(complete).queryByText("Faltam:")).not.toBeInTheDocument();

    const row = rowOf("Jéssica Moraes");
    expect(within(row).getByText("Incompleto")).toBeInTheDocument();
    expect(within(row).getByText("Faltam:")).toBeInTheDocument();
    expect(row).toHaveTextContent("Telefone não verificado, Sem foto de perfil");
    expect(row).not.toHaveTextContent("Sem documento (CPF)");

    const more = within(row).getByRole("button", { name: "+2 itens" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    expect(row).toHaveTextContent("Sem documento (CPF), Sem gênero informado");
    const less = within(row).getByRole("button", { name: "mostrar menos" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(less);
    expect(row).not.toHaveTextContent("Sem documento (CPF)");
  });

  it("conta externa chama-se 'Conta externa' (com a explicação) e criador suspenso leva a etiqueta", async () => {
    await renderLoaded();
    const row = rowOf("Natália Correia");
    const badge = within(row).getByText("Conta externa");
    expect(badge).toHaveAttribute("title", "Conta criada por convite e nunca assumida pela pessoa.");
    expect(within(row).getByText("Suspenso")).toBeInTheDocument();
    expect(screen.queryByText("Convite não aceito")).not.toBeInTheDocument();
  });

  it("primeira campanha: campanha e workspace (links), dia, e 'Nunca participou' quando não houve", async () => {
    await renderLoaded();
    const row = rowOf("Rafael Borges Mendes");
    expect(within(row).getByRole("link", { name: "Páscoa Pizzaria Forno Antigo" })).toHaveAttribute(
      "href",
      "/admin/campaigns/ca3b0000-0000-4000-8000-000000000051",
    );
    expect(within(row).getByRole("link", { name: "Pizzaria Forno Antigo" })).toHaveAttribute(
      "href",
      "/admin/workspaces/7a1e0000-0000-4000-8000-000000000022",
    );
    expect(row).toHaveTextContent("20/05/2025");
    expect(within(rowOf("Jéssica Moraes")).getByText("Nunca participou")).toBeInTheDocument();
  });

  it("cadastro em: o dia, no fuso de São Paulo", async () => {
    await renderLoaded();
    expect(within(rowOf("Rafael Borges Mendes")).getByText("19/03/2025")).toBeInTheDocument();
  });

  it("explica o que é derivado e que o rótulo do cadastro é sugestão, não erro", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Como é calculado: Cadastro" })).toHaveAccessibleDescription(
      expect.stringContaining("sugestão de atenção, não um erro"),
    );
    expect(screen.getByRole("button", { name: "Como é calculado: Primeira campanha" })).toHaveAccessibleDescription(
      expect.stringContaining("PRIMEIRA campanha"),
    );
    expect(screen.getByRole("button", { name: "Como é calculado: Seguidores" })).toHaveAccessibleDescription(
      CREATOR_DEFINITIONS.followers_total,
    );
  });

  it("sem `meta.definitions` do servidor, as colunas usam o texto do contrato", async () => {
    client.adminList.mockImplementation(async () => pageOf([FIRST]));
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Como é calculado: Primeira campanha" })).toHaveAccessibleDescription(
      expect.stringContaining("workspace de origem"),
    );
    expect(screen.getByRole("button", { name: "Como é calculado: Seguidores" })).toHaveAccessibleDescription(
      expect.stringContaining("UGC não é rede social"),
    );
  });
});

describe("Criadores: estados", () => {
  it("primeira carga: esqueleto e aviso para leitor de tela", async () => {
    client.adminList.mockImplementation(() => new Promise(() => {}));
    const { container } = renderCreators();
    expect(await screen.findByRole("status")).toHaveTextContent("Carregando…");
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderCreators();
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");

    client.adminList.mockImplementation(async () => pageOf([FIRST]));
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText(FIRST.name)).toBeInTheDocument();
  });

  it("o servidor ainda não tem a rota: diz isso", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderCreators();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
    expect(client.adminList).toHaveBeenCalledTimes(1);
  });

  it("sem criadores e sem filtro: vazio simples; com filtro: explica e 'Limpar busca e filtros' volta a tudo", async () => {
    client.adminList.mockImplementation(async () => pageOf([]));
    const first = renderCreators();
    expect(await screen.findByText("Nenhum criador ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar busca e filtros" })).not.toBeInTheDocument();
    first.unmount();

    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      params.registration || params.search ? pageOf([]) : pageOf([FIRST]),
    );
    const { router } = renderCreators("/admin/creators?registration=incomplete&search=zzz");
    expect(await screen.findByText("Nenhum criador encontrado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(await screen.findByText(FIRST.name)).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
  });
});

describe("Criadores: URL ⇄ filtros ⇄ API", () => {
  it("abre com a consulta padrão: 25 por página, cadastro mais recente primeiro, nenhum filtro", async () => {
    await renderLoaded();
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tudo o que está na URL vai para a API, e os controles mostram o que está valendo", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      pageOf([FIRST], { page: Number(params.page), per_page: Number(params.per_page), total: 200, total_pages: 8 }),
    );
    await renderLoaded(
      "/admin/creators?registration=stub&network=youtube&min_followers=5000&created_from=2026-01-01&created_to=2026-10-31&search=ana&sort_by=followers&order=asc&page=2",
    );
    expect(lastParams()).toEqual({
      page: 2,
      per_page: 25,
      search: "ana",
      sort_by: "followers",
      order: "asc",
      registration: "stub",
      network: "youtube",
      min_followers: "5000",
      created_from: "2026-01-01",
      created_to: "2026-10-31",
    });
    expect(screen.getByRole("button", { name: "Conta externa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Rede")).toHaveValue("youtube");
    expect(screen.getByLabelText("Seguidores mínimos")).toHaveValue("5000");
    expect(screen.getByLabelText("Cadastro em: a partir de")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Cadastro em: até")).toHaveValue("2026-10-31");
    expect(screen.getByRole("searchbox", { name: "Buscar criadores" })).toHaveValue("ana");
    expect(screen.getByRole("columnheader", { name: /Seguidores/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("valores inválidos na URL são ignorados (UGC não é rede; cadastro e seguidores fora do contrato)", async () => {
    await renderLoaded("/admin/creators?network=ugc&registration=weird&min_followers=-1&created_from=31/10/2026&sort_by=email");
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });

  it("um piso de seguidores que veio da URL e não é um dos pisos da lista ganha a sua própria opção", async () => {
    await renderLoaded("/admin/creators?min_followers=2500");
    const select = screen.getByLabelText("Seguidores mínimos") as HTMLSelectElement;
    expect(select.value).toBe("2500");
    expect(within(select).getByRole("option", { name: "2.500" })).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ min_followers: "2500" });
  });

  it("cadastro segmentado: Completo, Incompleto e Conta externa são enviados; Todos tira o filtro", async () => {
    const { router } = await renderLoaded("/admin/creators?page=3");
    await userEvent.click(screen.getByRole("button", { name: "Incompleto" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ registration: "incomplete", page: 1 }));
    expect(currentSearch(router)).toEqual({ registration: "incomplete" });

    await userEvent.click(screen.getByRole("button", { name: "Completo" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ registration: "complete" }));
    await userEvent.click(screen.getByRole("button", { name: "Conta externa" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ registration: "stub" }));
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("registration"));
    expect(currentSearch(router)).toEqual({});
  });

  it("rede: só as redes de verdade (UGC não é opção) e a escolhida é enviada", async () => {
    const { router } = await renderLoaded();
    const select = screen.getByLabelText("Rede") as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todas",
      "Instagram",
      "Instagram / Facebook",
      "TikTok",
      "YouTube",
    ]);
    expect(within(select).queryByRole("option", { name: /ugc/i })).not.toBeInTheDocument();

    await userEvent.selectOptions(select, "tiktok");
    await waitFor(() => expect(lastParams()).toMatchObject({ network: "tiktok" }));
    expect(currentSearch(router)).toEqual({ network: "tiktok" });
    await userEvent.selectOptions(select, "instagram_facebook");
    await waitFor(() => expect(lastParams()).toMatchObject({ network: "instagram_facebook" }));
  });

  it("seguidores mínimos: o piso escolhido é enviado como número inteiro", async () => {
    const { router } = await renderLoaded();
    await userEvent.selectOptions(screen.getByLabelText("Seguidores mínimos"), "10000");
    await waitFor(() => expect(lastParams()).toMatchObject({ min_followers: "10000" }));
    expect(currentSearch(router)).toEqual({ min_followers: "10000" });
    await userEvent.selectOptions(screen.getByLabelText("Seguidores mínimos"), "1000000");
    await waitFor(() => expect(lastParams()).toMatchObject({ min_followers: "1000000" }));
    await userEvent.selectOptions(screen.getByLabelText("Seguidores mínimos"), "");
    await waitFor(() => expect(lastParams()).not.toHaveProperty("min_followers"));
  });

  it("período de cadastro: as duas datas vão para a API", async () => {
    const { router } = await renderLoaded();
    fireEvent.change(screen.getByLabelText("Cadastro em: a partir de"), { target: { value: "2026-01-01" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ created_from: "2026-01-01" }));
    fireEvent.change(screen.getByLabelText("Cadastro em: até"), { target: { value: "2026-03-31" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ created_from: "2026-01-01", created_to: "2026-03-31" }));
    expect(currentSearch(router)).toEqual({ created_from: "2026-01-01", created_to: "2026-03-31" });
  });

  it("busca: Enter busca na hora (nome, e-mail ou @ da rede)", async () => {
    const { router } = await renderLoaded();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar criadores" }), "rafael_tt{Enter}");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "rafael_tt", page: 1 }));
    expect(currentSearch(router)).toEqual({ search: "rafael_tt" });
  });

  it("'Limpar filtros' desfaz os filtros e mantém a busca digitada", async () => {
    const { router } = await renderLoaded("/admin/creators?network=tiktok&min_followers=5000&search=ana");
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("network"));
    expect(lastParams()).not.toHaveProperty("min_followers");
    expect(lastParams()).toMatchObject({ search: "ana" });
    expect(currentSearch(router)).toEqual({ search: "ana" });
  });
});

describe("Criadores: ordenação e paginação", () => {
  it("clicar no cabeçalho ordena pela chave do contrato: nome do A ao Z; números e datas do maior", async () => {
    const { router } = await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: /^Criador/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "name", order: "asc" }));
    expect(currentSearch(router)).toEqual({ sort_by: "name", order: "asc" });

    await userEvent.click(screen.getByRole("button", { name: /^Seguidores/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "followers", order: "desc" }));

    await userEvent.click(screen.getByRole("button", { name: /^Campanhas/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "campaigns", order: "desc" }));
    await userEvent.click(screen.getByRole("button", { name: /^Campanhas/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "campaigns", order: "asc" }));

    await userEvent.click(screen.getByRole("button", { name: /^Cadastro em/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "created_at", order: "desc" }));
  });

  it("só as colunas do contrato ordenam", async () => {
    await renderLoaded();
    for (const name of ["Redes", "Cadastro", "Primeira campanha"]) {
      // "Cadastro" não pode casar com "Cadastro em" (esta ordena)
      expect(screen.queryByRole("button", { name: new RegExp(`^${name}$`) })).not.toBeInTheDocument();
    }
  });

  it("pager: avança de página (URL e consulta) e troca o tamanho voltando para a primeira", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      pageOf([FIRST], { page: Number(params.page), per_page: Number(params.per_page), total: 120, total_pages: Math.ceil(120 / Number(params.per_page)) }),
    );
    const { router } = await renderLoaded();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 120");

    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(currentSearch(router)).toEqual({ page: 2 });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastParams()).toMatchObject({ per_page: 50, page: 1 }));
    expect(currentSearch(router)).toEqual({ per_page: 50 });
  });
});

describe("Criadores: somente leitura", () => {
  it("só lê: nenhuma escrita é chamada e não há botão que altere criador", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Incompleto" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ registration: "incomplete" }));

    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).queryByRole("button", { name: /suspender|reativar|excluir|apagar|editar|fundir|mesclar|unir|remover|convidar|salvar/i }),
    ).not.toBeInTheDocument();
    // a linha não é link: criador não tem tela de detalhe aqui
    const table = within(panel).getByRole("table", { name: "Criadores" });
    expect(within(table).queryAllByRole("link").every((link) => !link.getAttribute("href")?.includes("/admin/users"))).toBe(true);
  });
});

describe("Criadores: perfil da base (nichos e porte)", () => {
  it("fica recolhido e não consulta nada até a pessoa abrir", async () => {
    await renderLoaded();
    const toggle = screen.getByRole("button", { name: "Mostrar perfil da base" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(dash.niche).toHaveBeenCalled();
    expect(dash.niche.mock.calls.every(([, , options]) => (options as { enabled: boolean }).enabled === false)).toBe(true);
    expect(dash.size.mock.calls.every(([, options]) => (options as { enabled: boolean }).enabled === false)).toBe(true);
    expect(screen.queryByRole("heading", { name: "Nichos" })).not.toBeInTheDocument();
  });

  it("aberto: consulta nichos e porte no período (30 dias, contando hoje, em dias de São Paulo) e mostra os gráficos", async () => {
    dash.niche.mockImplementation(() => ({ ...idle(), data: [{ niche_id: 1, niche_name: "Moda", count: 10, percentage: 62.5 }] }));
    dash.size.mockImplementation(() => ({ ...idle(), data: [{ bucket: "micro", count: 10, percentage: 100 }] }));
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar perfil da base" }));
    expect(screen.getByRole("button", { name: "Ocultar perfil da base" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Nichos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Porte" })).toBeInTheDocument();
    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.getByText("62,5%")).toBeInTheDocument();
    expect(screen.getByText("Micro")).toBeInTheDocument();

    const [period, limit, options] = dash.niche.mock.calls.at(-1) as [{ from: string; to: string }, number, { enabled: boolean }];
    expect(options.enabled).toBe(true);
    expect(limit).toBe(8);
    expect(period.to).toBe(civilDateInSaoPaulo());
    expect(period.from).toBe(civilDateInSaoPaulo(Date.now() - 29 * 86_400_000));
    expect((dash.size.mock.calls.at(-1) as [unknown, { enabled: boolean }])[1].enabled).toBe(true);
  });

  it("trocar o período refaz as consultas com o novo intervalo", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar perfil da base" }));
    const before = (dash.niche.mock.calls.at(-1) as [{ from: string }])[0].from;

    await userEvent.click(screen.getByRole("button", { name: "12 meses" }));
    const [period] = dash.niche.mock.calls.at(-1) as [{ from: string; to: string }];
    expect(period.from).not.toBe(before);
    expect(period.from).toBe(civilDateInSaoPaulo(Date.now() - 364 * 86_400_000));
    expect(period.to).toBe(civilDateInSaoPaulo());
  });

  it("sem dados: os gráficos dizem 'Sem dados ainda' (o endpoint antigo pode não devolver nada)", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar perfil da base" }));
    expect(screen.getAllByText("Sem dados ainda")).toHaveLength(2);
  });

  it("erro: os gráficos dizem que não foi possível carregar e 'Tentar de novo' refaz só o que falhou", async () => {
    const nicheRefetch = vi.fn();
    const sizeRefetch = vi.fn();
    dash.niche.mockImplementation(() => ({ ...idle(), isError: true, refetch: nicheRefetch }));
    dash.size.mockImplementation(() => ({ ...idle(), refetch: sizeRefetch }));
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar perfil da base" }));

    expect(screen.getAllByText("Não foi possível carregar").length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(nicheRefetch).toHaveBeenCalledTimes(1);
    expect(sizeRefetch).not.toHaveBeenCalled();
  });

  it("recolher de novo esconde os gráficos e para as consultas", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar perfil da base" }));
    await userEvent.click(screen.getByRole("button", { name: "Ocultar perfil da base" }));
    expect(screen.queryByRole("heading", { name: "Nichos" })).not.toBeInTheDocument();
    expect((dash.niche.mock.calls.at(-1) as [unknown, unknown, { enabled: boolean }])[2].enabled).toBe(false);
  });
});
