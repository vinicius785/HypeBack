import { cleanup, screen, waitFor, within } from "@testing-library/react";
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

import { AdminApiError } from "@/lib/admin/admin-client";

import { INCONSISTENCIES } from "./creator-fixtures";
import { renderCreators } from "./creator-test-utils";

const URL = "/admin/creators?tab=inconsistencies";
const COMPUTED_AT = "2026-10-31T15:00:00.000Z";

async function renderLoaded() {
  const view = renderCreators(URL);
  await screen.findByRole("article", { name: "Workspaces de marca sem proprietário" });
  return view;
}

beforeEach(() => {
  for (const mock of Object.values(client)) mock.mockReset();
  client.adminGetEnvelope.mockImplementation(async () => ({ data: INCONSISTENCIES, meta: { computed_at: COMPUTED_AT } }));
});

afterEach(() => {
  cleanup();
});

describe("Inconsistências: itens", () => {
  it("abre direto na aba e consulta só as inconsistências", async () => {
    await renderLoaded();
    expect(screen.getByRole("tab", { name: "Inconsistências" })).toHaveAttribute("aria-selected", "true");
    expect(client.adminGetEnvelope).toHaveBeenCalledWith("/admin/creators/inconsistencies", undefined, expect.anything());
    expect(client.adminList).not.toHaveBeenCalled();
  });

  it("cada item é um AdminAlertItem do kit: título, descrição, quantidade e o tipo (alerta ou sugestão), sem gravidade nem regra", async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector(".adm-alerts")).not.toBeNull();
    expect(container.querySelectorAll(".adm-alerts > article.adm-alert")).toHaveLength(3);
    const alert = screen.getByRole("article", { name: "Workspaces de marca sem proprietário" });
    expect(within(alert).getByText("Alerta")).toBeInTheDocument();
    // o servidor não manda gravidade, regra nem origem: nada de "Como é calculado" nem de selo de gravidade
    expect(within(alert).queryByText("Como é calculado")).not.toBeInTheDocument();
    expect(alert.querySelector(".adm-alert-tags")?.children).toHaveLength(1);
    expect(within(alert).getByText(/Há membros, mas nenhum com o papel/)).toBeInTheDocument();
    expect(within(alert).getByText("3")).toBeInTheDocument();
    expect(within(alert).getByText("ocorrências")).toBeInTheDocument();

    const suggestion = screen.getByRole("article", { name: "Criadores sem rede social ativa" });
    expect(within(suggestion).getByText("Sugestão")).toBeInTheDocument();
    expect(within(suggestion).getByText("8")).toBeInTheDocument();

    const single = screen.getByRole("article", { name: "Campanhas finalizadas ainda com reserva" });
    expect(within(single).getByText("ocorrência")).toBeInTheDocument();
  });

  it("alertas objetivos vêm primeiro, sugestões depois (mesmo que o servidor mande a sugestão antes)", async () => {
    await renderLoaded();
    const titles = screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));
    expect(titles).toEqual([
      "Workspaces de marca sem proprietário",
      "Campanhas finalizadas ainda com reserva",
      "Criadores sem rede social ativa",
    ]);
  });

  it("exemplos: workspace e campanha levam à tela deles; os demais (usuário…) são só texto", async () => {
    await renderLoaded();
    const alert = screen.getByRole("article", { name: "Workspaces de marca sem proprietário" });
    expect(within(alert).getByRole("link", { name: "Pet Amigo Fiel" })).toHaveAttribute(
      "href",
      "/admin/workspaces/7a1e0000-0000-4000-8000-000000000011",
    );
    expect(within(alert).getAllByRole("link")).toHaveLength(3);

    const campaign = screen.getByRole("article", { name: "Campanhas finalizadas ainda com reserva" });
    expect(within(campaign).getByRole("link", { name: "Novidades da temporada (R$ 250,00)" })).toHaveAttribute(
      "href",
      "/admin/campaigns/ca3b0000-0000-4000-8000-000000000003",
    );

    const suggestion = screen.getByRole("article", { name: "Criadores sem rede social ativa" });
    expect(within(suggestion).getByText("Ana Clara Dias")).toBeInTheDocument();
    expect(within(suggestion).queryByRole("link")).not.toBeInTheDocument();
  });

  it("quando há mais ocorrências que exemplos, diz quantos está mostrando", async () => {
    await renderLoaded();
    const suggestion = screen.getByRole("article", { name: "Criadores sem rede social ativa" });
    expect(within(suggestion).getByText(/Mostrando 1 de 8 exemplos\./)).toBeInTheDocument();
    // todos os exemplos à mostra: nada a avisar
    const alert = screen.getByRole("article", { name: "Workspaces de marca sem proprietário" });
    expect(within(alert).queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("mostra quando o servidor calculou (no fuso de São Paulo) e explica a diferença entre alerta e sugestão", async () => {
    await renderLoaded();
    const section = screen.getByRole("region", { name: "Alertas e sugestões" });
    expect(section).toHaveTextContent("Calculado em 31/10/2026 12:00.");
    expect(section).toHaveTextContent("Alerta é um fato objetivo guardado no banco; sugestão é uma heurística");
  });

  it("sem `computed_at` não inventa horário", async () => {
    client.adminGetEnvelope.mockImplementation(async () => ({ data: INCONSISTENCIES, meta: undefined }));
    await renderLoaded();
    expect(screen.getByRole("region", { name: "Alertas e sugestões" })).not.toHaveTextContent("Calculado em");
  });

  it("'Atualizar' é um ícone no canto da seção e consulta de novo (só refaz a leitura)", async () => {
    await renderLoaded();
    expect(client.adminGetEnvelope).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Atualizar" })).toHaveAttribute("data-icon-only", "true");
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(client.adminGetEnvelope).toHaveBeenCalledTimes(2));
    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
  });
});

describe("Inconsistências: estados", () => {
  it("primeira carga: esqueleto de alertas (o do kit) e aviso para leitor de tela", async () => {
    client.adminGetEnvelope.mockImplementation(() => new Promise(() => {}));
    const { container } = renderCreators(URL);
    expect(await screen.findByText("Carregando inconsistências…")).toBeInTheDocument();
    expect(container.querySelector(".adm-lsk[data-variant='alerts']")).not.toBeNull();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez", async () => {
    client.adminGetEnvelope.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderCreators(URL);
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");

    client.adminGetEnvelope.mockImplementation(async () => ({ data: INCONSISTENCIES, meta: { computed_at: COMPUTED_AT } }));
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("article", { name: "Workspaces de marca sem proprietário" })).toBeInTheDocument();
  });

  it("o servidor ainda não tem a rota: diz isso", async () => {
    client.adminGetEnvelope.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderCreators(URL);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
    expect(client.adminGetEnvelope).toHaveBeenCalledTimes(1);
  });

  it("nenhuma inconsistência: diz isso", async () => {
    client.adminGetEnvelope.mockImplementation(async () => ({ data: [], meta: { computed_at: COMPUTED_AT } }));
    renderCreators(URL);
    expect(await screen.findByText("Nenhuma inconsistência encontrada")).toBeInTheDocument();
  });

  it("falha ao atualizar com a lista antiga na tela: a lista fica e o aviso aparece por cima", async () => {
    await renderLoaded();
    client.adminGetEnvelope.mockRejectedValue(new AdminApiError({ status: 403, code: "FORBIDDEN", message: "Você não tem permissão para acessar este recurso." }));
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});
