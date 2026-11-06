import { cleanup, screen, within } from "@testing-library/react";
import { useParams } from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminGet: client.adminGet,
    adminList: client.adminList,
    adminPost: client.adminPost,
    adminPatch: client.adminPatch,
  };
});

import { AdminApiError } from "@/lib/admin/admin-client";
import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { AdminCampaignDetail } from "./admin-campaign-detail";
import { UNAVAILABLE_BUDGET, makeCampaignDetail } from "./campaign-fixtures";

const CAMPAIGN_ID = "ca3b0000-0000-4000-8000-000000000006";

function DetailPage() {
  const { campaignId } = useParams({ strict: false }) as { campaignId: string };
  return <AdminCampaignDetail campaignId={campaignId} />;
}

function renderDetail(id = CAMPAIGN_ID) {
  return renderAdminRoute(
    [
      { path: "/admin/campaigns/$campaignId", component: DetailPage },
      stubRoute("/admin/campaigns"),
      stubRoute("/admin/workspaces/$workspaceId"),
    ],
    `/admin/campaigns/${id}`,
  );
}

async function renderLoaded(detail = makeCampaignDetail()) {
  client.adminGet.mockResolvedValue(detail);
  const view = renderDetail();
  await screen.findByRole("heading", { level: 1, name: detail.title });
  return view;
}

const region = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminPost.mockReset();
  client.adminPatch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Detalhe da campanha: cabeçalho", () => {
  it("consulta GET /admin/campaigns/:id e mostra título, status, workspace, pagamento e criação", async () => {
    await renderLoaded();
    expect(client.adminGet).toHaveBeenCalledWith(`/admin/campaigns/${CAMPAIGN_ID}`, undefined, expect.anything());

    expect(screen.getByRole("heading", { level: 1, name: "Festival Café Serra Verde" })).toBeInTheDocument();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Publicada")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute(
      "href",
      "/admin/workspaces/7a1e0000-0000-4000-8000-000000000002",
    );
    expect(within(header).getByRole("link", { name: "Café Serra Verde" })).toHaveClass("adm-textlink");
    expect(within(header).getByText("Valor fixo por conteúdo")).toBeInTheDocument();
    expect(within(header).getByText("12/10/2026")).toBeInTheDocument();
  });

  it("o workspace aparece uma vez só (na meta do cabeçalho): não há seção 'Workspace' de um campo só", async () => {
    await renderLoaded();
    expect(screen.queryByRole("region", { name: "Workspace" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Café Serra Verde" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Ver workspace" })).not.toBeInTheDocument();
  });

  it("migalhas: Campanhas (volta para a lista) > título da campanha", async () => {
    await renderLoaded();
    const crumbs = screen.getByRole("navigation", { name: "Navegação" });
    expect(within(crumbs).getByRole("link", { name: "Campanhas" })).toHaveAttribute("href", "/admin/campaigns");
    expect(within(crumbs).getByText("Festival Café Serra Verde")).toHaveAttribute("aria-current", "page");
  });

  it("workspace que não está ativo leva a etiqueta do estado no cabeçalho", async () => {
    await renderLoaded(
      makeCampaignDetail({ workspace: { id: "7a1e0000-0000-4000-8000-000000000004", name: "Aurora Beauty Studio", status: "suspended" } }),
    );
    expect(within(screen.getByRole("banner")).getByText("Suspenso")).toBeInTheDocument();
  });

  it("sem banner entram as iniciais do título; o banner é decorativo", async () => {
    const { container } = await renderLoaded();
    const banner = container.querySelector(".adm-campaigns-banner") as HTMLElement;
    expect(banner).toHaveAttribute("aria-hidden", "true");
    expect(banner).toHaveTextContent("FC");
  });
});

describe("Detalhe da campanha: ordem das seções", () => {
  it("Resumo vem antes de Financeiro, e o cronograma e as participações depois", async () => {
    await renderLoaded();
    const order = ["Resumo", "Financeiro", "Cronograma", "Participações por status"].map((name) => region(name));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("Detalhe da campanha: Resumo e Cronograma", () => {
  it("Resumo: objetivo, prazo de inscrição (dia civil, sem deslocar fuso), mural, vagas e descrição", async () => {
    await renderLoaded();
    const summary = region("Resumo");
    expect(within(summary).getByText("Lançamento de produto")).toBeInTheDocument();
    expect(within(summary).getByText("20/11/2026")).toBeInTheDocument();
    expect(within(summary).getByText("Ativo")).toBeInTheDocument();
    expect(within(summary).getByText("10")).toBeInTheDocument();
    expect(within(summary).getByText(/Campanha de lançamento de produto da Café Serra Verde\./)).toBeInTheDocument();
  });

  it("Resumo: o responsável do workspace (com e-mail), e a definição de que a campanha não tem dono", async () => {
    await renderLoaded();
    const summary = region("Resumo");
    expect(within(summary).getByText("Responsável do workspace")).toBeInTheDocument();
    expect(within(summary).getByText("Ana Santana")).toBeInTheDocument();
    expect(within(summary).getByText("ana.santana@serraverde.test")).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: "Como é calculado: Responsável do workspace" })).toHaveAccessibleDescription(
      expect.stringContaining("responsável próprio"),
    );
  });

  it("Resumo: sem proprietário diz isso", async () => {
    await renderLoaded(makeCampaignDetail({ workspace_owner: null }));
    expect(within(region("Resumo")).getByText("Sem proprietário")).toBeInTheDocument();
  });

  it("Resumo: sem prazo diz 'Não definido'; mural desligado diz 'Inativo'; sem descrição diz isso", async () => {
    await renderLoaded(makeCampaignDetail({ registration_deadline: null, mural_active: false, description: "  " }));
    const summary = region("Resumo");
    expect(within(summary).getByText("Não definido")).toBeInTheDocument();
    expect(within(summary).getByText("Inativo")).toBeInTheDocument();
    expect(within(summary).getByText("Sem descrição.")).toBeInTheDocument();
  });

  it("Cronograma: as fases em ordem, cada uma com a data de publicação; sem data diz isso", async () => {
    await renderLoaded();
    const items = within(region("Cronograma")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // o servidor mandou fora de ordem (2, 1, 3): a tela ordena
    expect(items[0]).toHaveTextContent("Roteiro e aprovação");
    expect(items[0]).toHaveTextContent("Publicação: 18/10/2026");
    expect(items[1]).toHaveTextContent("Publicação do conteúdo");
    expect(items[1]).toHaveTextContent("Publicação: 15/11/2026");
    expect(items[2]).toHaveTextContent("Relatório final");
    expect(items[2]).toHaveTextContent("Sem data de publicação");
  });

  it("Cronograma: campanha sem fases diz isso", async () => {
    await renderLoaded(makeCampaignDetail({ steps: [] }));
    expect(within(region("Cronograma")).getByText("Sem fases definidas")).toBeInTheDocument();
  });
});

describe("Detalhe da campanha: Participações por status", () => {
  it("mostra os totais da API e a distribuição no vocabulário do Kanban (status que caem na mesma coluna somam)", async () => {
    await renderLoaded();
    const section = region("Participações por status");
    expect(section).toHaveTextContent("12 participações no total, 8 em andamento.");

    const rows = within(section).getAllByRole("listitem");
    const byLabel = Object.fromEntries(rows.map((row) => [row.querySelector(".adm-campaigns-dist-label")?.textContent, row.querySelector("b")?.textContent]));
    expect(byLabel).toEqual({
      "Aprovado / Em Andamento": "3",
      "Aguardando Conteúdo": "2",
      "Aguardando Aprovação Conteúdo": "1",
      // published (2) + completed (1)
      Publicado: "3",
      // status que o app não conhece: texto cru, e nunca "Inscrições"
      mystery_status: "1",
    });
    expect(within(section).queryByText("Inscrições")).not.toBeInTheDocument();
  });

  it("segue o funil do Kanban, não a ordem do servidor", async () => {
    await renderLoaded();
    const labels = within(region("Participações por status"))
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".adm-campaigns-dist-label")?.textContent);
    expect(labels).toEqual([
      "Aprovado / Em Andamento",
      "Aguardando Conteúdo",
      "Aguardando Aprovação Conteúdo",
      "Publicado",
      "mystery_status",
    ]);
  });

  it("sem participações: diz isso", async () => {
    await renderLoaded(makeCampaignDetail({ participations_by_status: {}, participants: { total: 0, participating: 0 } }));
    expect(within(region("Participações por status")).getByText("Nenhuma participação ainda")).toBeInTheDocument();
  });
});

describe("Detalhe da campanha: Financeiro", () => {
  it("os três números do contrato, com valor exato e definição", async () => {
    await renderLoaded();
    const finance = region("Financeiro");

    expect(within(finance).getByText("R$ 65.000,12")).toBeInTheDocument();
    expect(within(finance).getByText("R$ 1.200,50")).toBeInTheDocument();
    // pago via PIX = 0 é um zero de verdade (kind realized), não "Não apurado"
    expect(within(finance).getByText("R$ 0,00")).toBeInTheDocument();

    expect(within(finance).getByRole("button", { name: "Como é calculado: Comprometido" })).toHaveAccessibleDescription(
      expect.stringContaining("Reservas em aberto desta campanha"),
    );
    expect(within(finance).getByRole("button", { name: "Como é calculado: Liberado a criadores" })).toHaveAccessibleDescription(
      expect.stringContaining("Não é"),
    );
    expect(within(finance).getByRole("button", { name: "Como é calculado: Pago via PIX" })).toHaveAccessibleDescription(
      expect.stringContaining("PIX concluído"),
    );
  });

  it("a faixa é quieta: o tipo de cada número (comprometido, realizado) vive só no 'i', não em selos", async () => {
    const { container } = await renderLoaded();
    const finance = region("Financeiro");
    expect(container.querySelectorAll(".adm-kind")).toHaveLength(0);
    expect(within(finance).getAllByText("Comprometido")).toHaveLength(1); // só o rótulo
    expect(within(finance).getByRole("button", { name: "Como é calculado: Comprometido" })).toHaveAccessibleDescription(
      expect.stringContaining("Tipo: Comprometido"),
    );
    expect(within(finance).getByRole("button", { name: "Como é calculado: Liberado a criadores" })).toHaveAccessibleDescription(
      expect.stringContaining("Tipo: Realizado"),
    );
  });

  it("Orçamento não aparece: o banco não o guarda e a API devolve sempre 'não apurado'", async () => {
    await renderLoaded();
    const finance = region("Financeiro");
    expect(within(finance).queryByText("Orçamento")).not.toBeInTheDocument();
    expect(within(finance).queryByText("Não apurado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Como é calculado: Orçamento" })).not.toBeInTheDocument();
  });

  it("um número que o servidor diz não existir nunca vira 0", async () => {
    const detail = makeCampaignDetail();
    await renderLoaded({ ...detail, figures: { ...detail.figures, paid_pix: { ...UNAVAILABLE_BUDGET, definition: "PIX não apurado" } } });
    const finance = region("Financeiro");
    expect(within(finance).queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(within(finance).getAllByText("Não apurado")).toHaveLength(1);
  });
});

describe("Detalhe da campanha: estados", () => {
  it("carregando: o esqueleto já tem o cabeçalho (banner, título, apoio), com aviso para leitor de tela", async () => {
    client.adminGet.mockImplementation(() => new Promise(() => {}));
    const { container } = renderDetail();
    expect(await screen.findByRole("status")).toHaveTextContent("Carregando campanha…");
    expect(container.querySelectorAll(".adm-sk").length).toBeGreaterThan(0);
    // título, banner e linha de apoio em esqueleto, como o cabeçalho dos outros detalhes
    expect(container.querySelector(".adm-head h1 .adm-sk")).not.toBeNull();
    expect(container.querySelector(".adm-head-lead .adm-sk")).not.toBeNull();
    expect(container.querySelector(".adm-head-meta .adm-sk")).not.toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Festival Café Serra Verde" })).not.toBeInTheDocument();
    // o caminho de volta já está lá
    expect(screen.getByRole("link", { name: "Campanhas" })).toHaveAttribute("href", "/admin/campaigns");
  });

  it("erro do servidor: mostra o motivo e 'Tentar de novo' consulta outra vez", async () => {
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");

    client.adminGet.mockResolvedValue(makeCampaignDetail());
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Festival Café Serra Verde" })).toBeInTheDocument();
  });

  it("campanha que não existe: diz isso e leva de volta para a lista (sem 'tentar de novo')", async () => {
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 404, code: "NOT_FOUND", message: "Não encontramos este registro." }));
    renderDetail();
    expect(await screen.findByText("Não encontramos esta campanha")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para campanhas" })).toHaveAttribute("href", "/admin/campaigns");
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(client.adminGet).toHaveBeenCalledTimes(1);
  });

  it("o servidor ainda não tem a rota: diz isso", async () => {
    client.adminGet.mockRejectedValue(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
  });
});

describe("Detalhe da campanha: nada escreve sem confirmar", () => {
  it("abrir a página não escreve nada, e a única ação (excluir) fica no menu \"Mais\", atrás de confirmação", async () => {
    await renderLoaded();
    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /publicar|despublicar|excluir|editar|arquivar|suspender|finalizar/i })).not.toBeInTheDocument();
  });
});
