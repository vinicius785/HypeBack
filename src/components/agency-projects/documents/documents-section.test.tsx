import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectDocument } from "@/shared/services/agency-projects";
import { AgencyProjectsUnavailableError } from "@/shared/services/agency-projects";

import type { ProjectPermissions } from "../use-project-permissions";

const h = vi.hoisted(() => ({
  docs: undefined as ProjectDocument[] | undefined,
  loading: false,
  error: null as unknown,
  refetch: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateAsync: vi.fn(),
  remove: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-agency-projects", () => ({
  useProjectDocuments: () => ({ data: h.docs, isLoading: h.loading, error: h.error, refetch: h.refetch, isFetching: false }),
  useCreateProjectDocument: () => ({ mutateAsync: h.create, isPending: false }),
  useUpdateProjectDocument: () => ({ mutate: h.update, mutateAsync: h.updateAsync, isPending: false }),
  useDeleteProjectDocument: () => ({ mutateAsync: h.remove, isPending: false }),
}));

import { ProjectDocumentsSection } from "./documents-section";

const project = { id: "p1", name: "Verão" } as Project;
const can = (over: Partial<ProjectPermissions> = {}): ProjectPermissions => ({ canRead: true, canCreate: true, canWrite: true, canDelete: true, ...over });

const doc = (id: string, over: Partial<ProjectDocument> = {}): ProjectDocument => ({
  id,
  name: `Doc ${id}`,
  url: `https://example.com/${id}`,
  category: "outro",
  pinned: false,
  created_at: "2026-11-01T12:00:00Z",
  ...over,
});

const seed = (): ProjectDocument[] => [
  doc("a", { name: "Briefing da campanha", url: "https://docs.google.com/document/d/1", category: "briefing" }),
  doc("b", { name: "Planilha de custos", url: "https://docs.google.com/spreadsheets/d/2", category: "planejamento" }),
  doc("c", { name: "Telas finais", url: "https://www.figma.com/file/3", category: "apresentacao", pinned: true }),
  doc("d", { name: "Mais telas", url: "https://www.figma.com/file/4", category: "apresentacao" }),
  doc("e", { name: "Site da marca", url: "https://marca.com.br/inicio", category: "referencia" }),
];

const renderIt = (permissions = can()) => render(<ProjectDocumentsSection project={project} can={permissions} />);
const group = (name: string) => within(screen.getByRole("region", { name }));
const names = (el: ReturnType<typeof group>) => el.getAllByRole("listitem").map((li) => li.querySelector("a")?.firstChild?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  h.docs = seed();
  h.loading = false;
  h.error = null;
  h.create.mockImplementation(async (input: { name: string }) => doc("novo", { name: input.name }));
  h.updateAsync.mockImplementation(async () => doc("a"));
  h.remove.mockResolvedValue(undefined);
});

describe("lista", () => {
  it("agrupa por categoria, na ordem do contrato, só as que têm itens, com fixados primeiro", () => {
    const { unmount } = renderIt();
    expect(screen.getAllByRole("heading", { level: 3 }).map((n) => n.textContent)).toEqual(["Briefing1", "Planejamento1", "Apresentação2", "Referência1"]);
    expect(names(group("Apresentação"))).toEqual(["Telas finais", "Mais telas"]);
    unmount();
    // Mesmo se o servidor mandar fora de ordem, o fixado sobe.
    h.docs = [doc("x", { name: "Normal", category: "outro" }), doc("y", { name: "Fixado", category: "outro", pinned: true })];
    renderIt();
    expect(names(group("Outro"))).toEqual(["Fixado", "Normal"]);
  });

  it("tipo e ícone pela URL, e o link abre em outra aba sem expor a página", () => {
    renderIt();
    const docsRow = screen.getByRole("link", { name: /Briefing da campanha/ }).closest("li") as HTMLElement;
    expect(docsRow).toHaveAttribute("data-source", "google_docs");
    expect(within(docsRow).getByText(/Google Docs · docs.google.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Planilha de custos/ }).closest("li")).toHaveAttribute("data-source", "google_sheets");
    expect(screen.getByRole("link", { name: /Telas finais/ }).closest("li")).toHaveAttribute("data-source", "figma");
    const site = screen.getByRole("link", { name: /Site da marca/ });
    expect(site.closest("li")).toHaveAttribute("data-source", "link");
    expect(site).toHaveAttribute("href", "https://marca.com.br/inicio");
    expect(site).toHaveAttribute("target", "_blank");
    expect(site).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(site).getByText("(abre em outra aba)")).toBeInTheDocument();
  });

  it("busca por nome ou endereço, filtro de categoria com chip e 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    renderIt();
    await user.type(screen.getByRole("searchbox", { name: "Buscar arquivo ou link" }), "figma");
    expect(screen.queryByRole("region", { name: "Briefing" })).not.toBeInTheDocument();
    expect(names(group("Apresentação"))).toEqual(["Telas finais", "Mais telas"]);
    await user.clear(screen.getByRole("searchbox", { name: "Buscar arquivo ou link" }));
    await user.selectOptions(screen.getByLabelText("Categoria"), "briefing");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText("Categoria: Briefing")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar arquivo ou link" }), "zzz");
    expect(screen.getByText("Nenhum item encontrado")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(screen.getAllByRole("region")).toHaveLength(4);
  });
});

describe("estados", () => {
  it("carregando, erro com 'Tentar de novo' e API sem a rota", async () => {
    const user = userEvent.setup();
    h.docs = undefined;
    h.loading = true;
    const { unmount } = renderIt();
    expect(screen.getByLabelText("Carregando arquivos e links")).toHaveAttribute("aria-busy", "true");
    unmount();
    h.loading = false;
    h.error = new Error("Falha de rede");
    const second = renderIt();
    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao carregar os arquivos e links");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
    second.unmount();
    h.error = new AgencyProjectsUnavailableError();
    renderIt();
    expect(screen.getByText("Arquivos e links ainda não estão disponíveis")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("vazio: convida a adicionar (com edição) ou só informa (somente leitura)", async () => {
    h.docs = [];
    const user = userEvent.setup();
    const { unmount } = renderIt();
    expect(screen.getByText("Nenhum arquivo ou link ainda")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar link" }));
    expect(screen.getByRole("dialog", { name: "Adicionar link" })).toBeInTheDocument();
    unmount();
    renderIt(can({ canWrite: false }));
    expect(screen.getByText("Este projeto ainda não tem arquivos nem links.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar link" })).not.toBeInTheDocument();
  });
});

describe("adicionar e editar", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Adicionar link" }));
    return within(screen.getByRole("dialog", { name: "Adicionar link" }));
  };

  it("valida o endereço: vazio, esquema que não é http/https e texto solto", async () => {
    const user = userEvent.setup();
    renderIt();
    const form = await open(user);
    await user.click(form.getByRole("button", { name: "Adicionar link" }));
    expect(form.getByText("Informe o endereço do link")).toBeInTheDocument();
    for (const bad of ["javascript:alert(1)", "ftp://arquivos.com/x", "isso nao e um link"]) {
      await user.clear(form.getByLabelText("Endereço do link"));
      await user.type(form.getByLabelText("Endereço do link"), bad);
      await user.click(form.getByRole("button", { name: "Adicionar link" }));
      expect(form.getByText(/Use um endereço http ou https válido/)).toBeInTheDocument();
    }
    expect(form.getByLabelText("Endereço do link")).toHaveAttribute("aria-invalid", "true");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("endereço sem esquema vira https; sem nome usa o domínio; categoria padrão 'outro'", async () => {
    const user = userEvent.setup();
    renderIt();
    const form = await open(user);
    await user.type(form.getByLabelText("Endereço do link"), "www.miro.com/board/9");
    expect(form.getByPlaceholderText("miro.com")).toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Adicionar link" }));
    await waitFor(() => expect(h.create).toHaveBeenCalledWith({ url: "https://www.miro.com/board/9", name: "miro.com", category: "outro" }));
    expect(h.toast.success).toHaveBeenCalledWith("Link adicionado");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Adicionar link" })).not.toBeInTheDocument());
  });

  it("com nome e categoria escolhidos", async () => {
    const user = userEvent.setup();
    renderIt();
    const form = await open(user);
    await user.type(form.getByLabelText("Endereço do link"), "https://notion.so/plano");
    await user.type(form.getByLabelText(/Nome/), "  Plano de mídia ");
    await user.selectOptions(form.getByLabelText("Categoria"), "contrato");
    await user.click(form.getByRole("button", { name: "Adicionar link" }));
    await waitFor(() => expect(h.create).toHaveBeenCalledWith({ url: "https://notion.so/plano", name: "Plano de mídia", category: "contrato" }));
  });

  it("erro da API aparece no formulário, que continua aberto", async () => {
    h.create.mockRejectedValueOnce(new Error("Sem conexão"));
    const user = userEvent.setup();
    renderIt();
    const form = await open(user);
    await user.type(form.getByLabelText("Endereço do link"), "https://canva.com/x");
    await user.click(form.getByRole("button", { name: "Adicionar link" }));
    expect(await form.findByRole("alert")).toHaveTextContent("Sem conexão");
    expect(screen.getByRole("dialog", { name: "Adicionar link" })).toBeInTheDocument();
  });

  it("cancelar com algo digitado pede confirmação de descarte", async () => {
    const user = userEvent.setup();
    renderIt();
    const form = await open(user);
    await user.type(form.getByLabelText("Endereço do link"), "https://x.com");
    await user.click(form.getByRole("button", { name: "Cancelar" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Descartar as alterações?" })).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Adicionar link" })).not.toBeInTheDocument());
    expect(h.create).not.toHaveBeenCalled();
  });

  it("editar abre com os dados do link e grava só o que o formulário tem", async () => {
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole("button", { name: "Mais ações de Briefing da campanha" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    const form = within(screen.getByRole("dialog", { name: "Editar link" }));
    expect(form.getByLabelText("Endereço do link")).toHaveValue("https://docs.google.com/document/d/1");
    expect(form.getByLabelText(/Nome/)).toHaveValue("Briefing da campanha");
    expect(form.getByLabelText("Categoria")).toHaveValue("briefing");
    await user.clear(form.getByLabelText(/Nome/));
    await user.type(form.getByLabelText(/Nome/), "Briefing final");
    await user.click(form.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(h.updateAsync).toHaveBeenCalledWith({ documentId: "a", input: { url: "https://docs.google.com/document/d/1", name: "Briefing final", category: "briefing" } }),
    );
    expect(h.toast.success).toHaveBeenCalledWith("Link atualizado");
  });
});

describe("fixar e remover", () => {
  it("fixar e desafixar chamam a API e avisam; falha mostra o erro", async () => {
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole("button", { name: "Fixar Briefing da campanha" }));
    expect(h.update).toHaveBeenCalledWith({ documentId: "a", input: { pinned: true } }, expect.any(Object));
    act(() => h.update.mock.calls[0][1].onSuccess());
    expect(h.toast.success).toHaveBeenCalledWith("Link fixado");
    expect(screen.getByRole("button", { name: "Desafixar Telas finais" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Desafixar Telas finais" }));
    expect(h.update).toHaveBeenLastCalledWith({ documentId: "c", input: { pinned: false } }, expect.any(Object));
    act(() => h.update.mock.calls[1][1].onError(new Error("Sem conexão")));
    expect(h.toast.error).toHaveBeenCalledWith("Sem conexão");
  });

  it("remover pede confirmação, apaga e avisa", async () => {
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole("button", { name: "Mais ações de Site da marca" }));
    await user.click(screen.getByRole("menuitem", { name: "Remover" }));
    expect(h.remove).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog", { name: "Remover link?" });
    expect(confirm).toHaveTextContent("O arquivo original não é apagado");
    await user.click(within(confirm).getByRole("button", { name: "Remover link" }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("e"));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Link removido"));
  });

  it("remover com erro: o diálogo continua aberto com a mensagem", async () => {
    h.remove.mockRejectedValueOnce(new Error("Sem conexão"));
    const user = userEvent.setup();
    renderIt();
    await user.click(screen.getByRole("button", { name: "Mais ações de Site da marca" }));
    await user.click(screen.getByRole("menuitem", { name: "Remover" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Remover link?" })).getByRole("button", { name: "Remover link" }));
    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Remover link?" })).toBeInTheDocument();
  });
});

describe("somente leitura", () => {
  it("lista e abre, sem adicionar, fixar, editar nem remover; o fixado continua indicado", () => {
    renderIt(can({ canWrite: false }));
    expect(screen.queryByRole("button", { name: "Adicionar link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fixar|Desafixar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mais ações de/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Telas finais/ })).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Telas finais/ }).closest("li") as HTMLElement).getByText("Fixado")).toBeInTheDocument();
  });
});
