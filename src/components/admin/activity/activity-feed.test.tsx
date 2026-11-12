import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
}));

// A saúde (bloco de cima do Monitoramento) tem os testes dela; aqui só interessa a atividade.
vi.mock("@/components/admin/health/health-page", () => ({ HealthPage: () => null }));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminList: client.adminList, adminFeed: client.adminFeed };
});

import { CAFE_WORKSPACE_DETAIL, CAFE_WORKSPACE_ITEM, feedPage } from "@/components/admin/financial/financial-fixtures";
import { AdminApiError } from "@/lib/admin/admin-client";
import { currentSearch } from "@/test/render-admin-route";

import { ADMIN_EVENT, CAMPAIGN_EVENT, CAMPAIGN_ID, WORKSPACE_ID, makeEvent } from "./activity-fixtures";
import { renderActivity } from "./activity-test-support";

const NOW = new Date("2026-10-31T15:00:00.000Z");

function feedCalls() {
  return client.adminFeed.mock.calls.filter(([path]) => path === "/admin/activity");
}

function lastQuery(): Record<string, unknown> {
  return feedCalls().at(-1)?.[1] as Record<string, unknown>;
}

async function openFeed(url = "/admin/activity") {
  const view = renderActivity(url);
  await screen.findByRole("heading", { name: "Linha do tempo" });
  return view;
}

const EVENTS = [makeEvent(), CAMPAIGN_EVENT, ADMIN_EVENT];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminFeed.mockReset();
  // o seletor de workspace de verdade: a busca e o nome de um id da URL
  client.adminGet.mockImplementation(async (path: string) => (path.startsWith("/admin/workspaces/") ? CAFE_WORKSPACE_DETAIL : { id: 7, name: "Marina Admin" }));
  client.adminList.mockImplementation(async (path: string) => ({
    data: path === "/admin/workspaces" ? [CAFE_WORKSPACE_ITEM] : [],
    meta: { page: 1, per_page: 25, total: 0, total_pages: 0 },
  }));
  client.adminFeed.mockImplementation(async () => feedPage(EVENTS));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Atividade: linha do tempo", () => {
  it("abre com os 30 dias de São Paulo que terminam hoje, 50 por vez, sem filtro nenhum na consulta", async () => {
    await openFeed();
    expect(lastQuery()).toEqual({ from: "2026-10-02", to: "2026-10-31", limit: 50 });
  });

  it("mostra cada evento com o tipo dito uma vez e agrupa por dia, e avisa que não é um registro completo", async () => {
    await openFeed();
    expect(await screen.findByText("Workspace Café Serra Verde criado")).toBeInTheDocument();
    expect(screen.getByText("Campanha Festival de Outono criada")).toBeInTheDocument();
    expect(screen.getByText("Workspace suspenso pelo time da plataforma")).toBeInTheDocument();

    // a frase curta fica na página; a lista dos seis tipos está no "i"
    expect(screen.getByText(/Não é um registro completo: mostra só alguns tipos de evento/)).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "Como ler: Linha do tempo" });
    for (const kind of ["Workspace criado", "Campanha criada", "Aporte pago", "Saque pago", "Ação administrativa"]) {
      expect(info).toHaveAccessibleDescription(expect.stringContaining(kind));
    }
    expect(info).toHaveAccessibleDescription(expect.stringContaining("registro de auditoria"));

    // dois dias: 30/10 (dois eventos) e 29/10, numa linha do tempo de verdade
    const timeline = screen.getByRole("list", { name: "Atividade da plataforma" });
    expect(within(timeline).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("3 eventos carregados · fim da lista")).toBeInTheDocument();
  });

  it("os dias vêm do kit (Hoje/Ontem/dia por extenso, fuso de São Paulo) e cada evento mantém a hora", async () => {
    client.adminFeed.mockResolvedValue(
      feedPage([
        makeEvent({ id: "a", title: "Evento de hoje", occurred_at: "2026-10-31T14:00:00.000Z" }),
        // 02:30 UTC de 31/10 ainda é 23:30 de 30/10 em São Paulo: é "Ontem", e não "Hoje"
        makeEvent({ id: "b", title: "Evento da noite", occurred_at: "2026-10-31T02:30:00.000Z" }),
        makeEvent({ id: "c", title: "Evento da semana", occurred_at: "2026-10-28T15:00:00.000Z" }),
      ]),
    );
    await openFeed();
    await screen.findByText("Evento de hoje");
    const timeline = screen.getByRole("list", { name: "Atividade da plataforma" });
    const headings = within(timeline).getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Hoje", "Ontem", "Quarta-feira, 28 de outubro"]);
    const night = screen.getByText("Evento da noite").closest("li")!;
    expect(night.closest("li.adm-tl-day")).toHaveTextContent("Ontem");
    expect(night.querySelector("time")).toHaveTextContent("23:30");
  });

  it("o tipo aparece uma vez, como texto, e o ícone é só decoração (fora da leitura)", async () => {
    const { container } = await openFeed();
    const item = (await screen.findByText("Campanha Festival de Outono criada")).closest("li")!;
    expect(within(item).getByText("Campanha criada")).toBeInTheDocument();
    const mark = item.querySelector(".adm-tl-mark")!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark.querySelector("svg")).not.toBeNull();
    // o tipo não se repete (nem no ícone nem num selo)
    expect(item.textContent?.match(/Campanha criada/g)).toHaveLength(1);
    expect(container.querySelector(".adm-act-ico")).toBeNull();
  });

  it("cada evento mostra a hora de São Paulo num <time>", async () => {
    await openFeed();
    const item = (await screen.findByText("Campanha Festival de Outono criada")).closest("li")!;
    const time = item.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-30T12:00:00.000Z");
    expect(time).toHaveTextContent("09:00");
  });

  it("a ação administrativa mostra o autor; o motivo vem no 'Ver detalhes' do evento", async () => {
    await openFeed();
    const item = (await screen.findByText("Workspace suspenso pelo time da plataforma")).closest("li")!;
    expect(within(item).getByRole("link", { name: "Marina Admin" })).toHaveAttribute("href", "/admin/users/7");

    const reason = within(item).getByText(/Cobrança contestada, aguardando análise/);
    expect(reason).not.toBeVisible();
    await userEvent.click(within(item).getByRole("button", { name: "Ver detalhes", expanded: false }));
    expect(reason).toBeVisible();
    expect(reason.closest("p")).toHaveTextContent("Motivo: Cobrança contestada, aguardando análise");
  });

  it("evento sem motivo não tem 'Ver detalhes'", async () => {
    client.adminFeed.mockResolvedValue(feedPage([CAMPAIGN_EVENT]));
    await openFeed();
    await screen.findByText("Campanha Festival de Outono criada");
    expect(screen.queryByRole("button", { name: "Ver detalhes" })).not.toBeInTheDocument();
  });

  it("linka workspace e campanha, e a ação administrativa leva para o que mudou", async () => {
    await openFeed();
    const created = (await screen.findByText("Workspace Café Serra Verde criado")).closest("li")!;
    expect(within(created).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute("href", `/admin/workspaces/${WORKSPACE_ID}`);

    const campaign = screen.getByText("Campanha Festival de Outono criada").closest("li")!;
    expect(within(campaign).getByRole("link", { name: "Festival de Outono" })).toHaveAttribute("href", `/admin/campaigns/${CAMPAIGN_ID}`);

    const admin = screen.getByText("Workspace suspenso pelo time da plataforma").closest("li")!;
    const change = within(admin).getByRole("link", { name: "Ver o que mudou" });
    const href = change.getAttribute("href") ?? "";
    expect(href).toContain("tab=changes");
    expect(href).toContain("target_type=workspace");
    expect(href).toContain(`target_id=${WORKSPACE_ID}`);
    expect(href).toContain("from=2026-10-29");
  });

  it("evento que não é ação administrativa não oferece 'Ver o que mudou'", async () => {
    client.adminFeed.mockResolvedValue(feedPage([CAMPAIGN_EVENT]));
    await openFeed();
    await screen.findByText("Campanha Festival de Outono criada");
    expect(screen.queryByRole("link", { name: "Ver o que mudou" })).not.toBeInTheDocument();
  });
});

describe("Atividade: filtros e período", () => {
  it("o filtro de tipo vai para a API e para a URL", async () => {
    const { router } = await openFeed();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "charge_paid");
    await waitFor(() => expect(lastQuery()).toMatchObject({ kind: "charge_paid", from: "2026-10-02", to: "2026-10-31" }));
    expect(currentSearch(router)).toMatchObject({ kind: "charge_paid" });
  });

  it("o filtro de workspace vai para a API e o chip tira da consulta", async () => {
    const { router } = await openFeed();
    await userEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ workspace_id: CAFE_WORKSPACE_ITEM.id }));
    expect(currentSearch(router)).toMatchObject({ workspace_id: CAFE_WORKSPACE_ITEM.id });

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" }));
    await waitFor(() => expect(lastQuery().workspace_id).toBeUndefined());
  });

  it("uma só barra de filtros, acima do painel, com workspace e tipo na linha dela (sem 'Atualizar' no cabeçalho)", async () => {
    const { container } = await openFeed();
    expect(container.querySelectorAll(".adm-filters")).toHaveLength(1);
    // o seletor de visão (Tudo / Alterações) mora na mesma barra, e a lista vem depois dela
    expect(within(container.querySelector<HTMLElement>(".adm-filters")!).getByRole("group", { name: "O que mostrar" })).toBeInTheDocument();
    const bar = container.querySelector<HTMLElement>(".adm-filters")!;
    expect(within(bar).getByRole("button", { name: /^Workspace:/ })).toBeInTheDocument();
    expect(within(bar).getByRole("combobox", { name: "Tipo" })).toBeInTheDocument();
    // o período fica no cabeçalho do bloco "Atividade" e o "Atualizar" é o ícone no fim da barra
    const head = screen.getByRole("heading", { name: "Atividade", level: 2 }).closest(".adm-mon-head") as HTMLElement;
    expect(within(head).getByRole("group", { name: "Período" })).toBeInTheDocument();
    expect(within(head).queryByRole("button", { name: "Atualizar" })).not.toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Atualizar" })).toHaveAttribute("data-icon-only", "true");
  });

  it("o tipo escolhido vira chip e 'Limpar filtros' zera tipo e workspace, mantendo o período", async () => {
    const { router } = await openFeed(`/admin/activity?kind=charge_paid&workspace_id=${CAFE_WORKSPACE_ITEM.id}&from=2026-10-20&to=2026-10-25`);
    expect(screen.getByRole("button", { name: "Remover filtro Tipo: Aporte pago" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastQuery()).toEqual({ from: "2026-10-20", to: "2026-10-25", limit: 50 }));
    expect(currentSearch(router)).toEqual({ from: "2026-10-20", to: "2026-10-25" });
  });

  it("filtro vindo da URL com valor inválido é descartado", async () => {
    await openFeed("/admin/activity?kind=nao_existe&workspace_id=xyz");
    expect(lastQuery()).toEqual({ from: "2026-10-02", to: "2026-10-31", limit: 50 });
  });

  it("trocar o período refaz o feed com as novas datas", async () => {
    const { router } = await openFeed();
    const period = screen.getByRole("group", { name: "Período" });
    await userEvent.click(within(period).getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ from: "2026-10-25", to: "2026-10-31" }));
    expect(currentSearch(router)).toMatchObject({ from: "2026-10-25", to: "2026-10-31" });
  });
});

describe("Atividade: carregar mais (cursor)", () => {
  const A = makeEvent({ id: "charge:a", occurred_at: "2026-10-30T12:00:00.000Z", kind: "charge_paid", title: "Aporte A" });
  const B = makeEvent({ id: "charge:b", occurred_at: "2026-10-29T12:00:00.000Z", kind: "charge_paid", title: "Aporte B" });
  const C = makeEvent({ id: "charge:c", occurred_at: "2026-10-28T12:00:00.000Z", kind: "charge_paid", title: "Aporte C" });

  it("a próxima página usa o cursor da anterior, sem repetir eventos, e termina quando acaba", async () => {
    client.adminFeed.mockImplementation(async (_path: string, query: { cursor?: string }) => {
      if (!query.cursor) return feedPage([A, B], "cursor-1");
      if (query.cursor === "cursor-1") return feedPage([B, C], null); // B repetido
      throw new AdminApiError({ status: 400, code: "BAD_REQUEST", message: "cursor inválido." });
    });
    await openFeed();
    expect(await screen.findByText("2 eventos carregados")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("3 eventos carregados · fim da lista")).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ cursor: "cursor-1", limit: 50 });
    expect(screen.getAllByText("Aporte B")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

describe("Atividade: estados", () => {
  it("carregando: esqueleto", async () => {
    client.adminFeed.mockReturnValue(new Promise(() => {}));
    const { container } = renderActivity();
    await waitFor(() => expect(container.querySelectorAll(".adm-lsk[data-variant='timeline'] .adm-sk").length).toBeGreaterThan(0));
    expect(container.querySelector(".adm-lsk")).toHaveTextContent("Carregando atividades…");
  });

  it("vazio sem filtro sugere um período maior", async () => {
    client.adminFeed.mockResolvedValue(feedPage([]));
    await openFeed();
    expect(await screen.findByText("Nenhuma atividade no período")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("vazio com filtro oferece limpar os filtros", async () => {
    client.adminFeed.mockResolvedValue(feedPage([]));
    const { router } = await openFeed("/admin/activity?kind=charge_paid");
    expect(await screen.findByText("Nenhuma atividade com estes filtros")).toBeInTheDocument();
    const clear = screen.getAllByRole("button", { name: "Limpar filtros" });
    await userEvent.click(clear.at(-1)!);
    await waitFor(() => expect(currentSearch(router)).not.toHaveProperty("kind"));
  });

  it("recurso ainda não disponível no servidor, com tentar de novo", async () => {
    client.adminFeed.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderActivity();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Workspace Café Serra Verde criado");
  });

  it("Atualizar (o ícone da barra) refaz a consulta", async () => {
    await openFeed();
    await screen.findByText("Workspace Café Serra Verde criado");
    const before = feedCalls().length;
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(feedCalls().length).toBeGreaterThan(before));
  });
});
