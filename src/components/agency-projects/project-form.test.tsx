import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/shared/services/agency-projects";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  resize: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-agency-projects", () => ({
  useCreateAgencyProject: () => ({ mutateAsync: h.create, isPending: false }),
  useUpdateAgencyProject: () => ({ mutateAsync: h.update, isPending: false }),
  useUploadAgencyProjectCover: () => ({ mutateAsync: h.upload, isPending: false }),
}));
vi.mock("./project-cover", () => ({ resizeCoverImage: h.resize }));

import { ProjectForm } from "./project-form";

const project = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Lançamento Verão",
  description: "Coleção nova",
  cover_url: "https://cdn.test/capa.jpg",
  status: "ativo",
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  stats: { tasks_total: 0, tasks_done: 0, tasks_open: 0, tasks_overdue: 0, tasks_blocked: 0, progress: 0, deadline: null, next_due: null, last_activity_at: "2026-11-01T12:00:00Z" },
  health: "saudavel",
  responsible: null,
  participants: [],
  ...over,
});

const onClose = vi.fn();
const onSaved = vi.fn();
const drawer = () => within(screen.getByRole("dialog", { name: /projeto$/ }));

beforeEach(() => {
  vi.clearAllMocks();
  h.create.mockImplementation(async (input: { name: string }) => project({ id: "novo", name: input.name }));
  h.update.mockImplementation(async ({ input }: { input: Partial<Project> }) => project(input));
  h.upload.mockResolvedValue({ url: "/uploads/agency-projects/nova.jpg" });
  h.resize.mockImplementation(async (file: File) => new File([file], "capa.jpg", { type: "image/jpeg" }));
  // Pré-visualização da capa nova: o jsdom não tem `createObjectURL`.
  URL.createObjectURL = vi.fn(() => "blob:capa");
  URL.revokeObjectURL = vi.fn();
});

describe("novo projeto", () => {
  it("abre em branco, sem o campo de status, com o foco no nome", () => {
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "Novo projeto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue("");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar projeto" })).toBeEnabled();
  });

  it("nome é obrigatório: avisa e não chama a API", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(screen.getByText("Informe o nome do projeto")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do projeto")).toHaveAttribute("aria-invalid", "true");
    expect(h.create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Nome do projeto"), "   ");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(h.create).not.toHaveBeenCalled();
  });

  it("cria com nome aparado e descrição vazia como nulo, avisa e entrega o projeto novo", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "  Black Friday ");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(h.create).toHaveBeenCalledWith({ name: "Black Friday", description: null });
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.toast.success).toHaveBeenCalledWith("Projeto criado");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "novo" }), true);
    expect(onClose).toHaveBeenCalled();
  });

  it("limites do contrato nos campos", () => {
    render(<ProjectForm onClose={onClose} />);
    expect(screen.getByLabelText("Nome do projeto")).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText(/^Descrição/)).toHaveAttribute("maxlength", "2000");
  });

  it("erro da API aparece no painel, que continua aberto com o que foi digitado", async () => {
    h.create.mockRejectedValue(Object.assign(new Error("Falha"), { code: "AGENCY_ONLY", status: 403 }));
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "Acme");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Projetos existem só em workspaces de agência.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue("Acme");
    expect(h.toast.success).not.toHaveBeenCalled();
  });
});

describe("capa", () => {
  const pick = async (user: ReturnType<typeof userEvent.setup>, file: File) =>
    user.upload(screen.getByLabelText("Arquivo da capa", { selector: "input" }), file);

  it("a imagem escolhida é reduzida, enviada antes de gravar e a URL vai em cover_url", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "Verão");
    const big = new File(["x".repeat(10)], "foto.png", { type: "image/png" });
    await pick(user, big);
    expect(h.resize).toHaveBeenCalledWith(big);
    expect(await screen.findByAltText("Capa do projeto")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect((h.upload.mock.calls[0][0] as File).type).toBe("image/jpeg");
    expect(h.create).toHaveBeenCalledWith({ name: "Verão", description: null, cover_url: "/uploads/agency-projects/nova.jpg" });
    expect(h.upload.mock.invocationCallOrder[0]).toBeLessThan(h.create.mock.invocationCallOrder[0]);
  });

  it("tipo não aceito é recusado na hora", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ProjectForm onClose={onClose} />);
    await pick(user, new File(["x"], "doc.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use uma imagem JPG, PNG ou WebP.");
    expect(h.resize).not.toHaveBeenCalled();
  });

  it("imagem que não abre mostra o erro e não vira capa", async () => {
    h.resize.mockRejectedValue(new Error("Não foi possível ler essa imagem."));
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} />);
    await pick(user, new File(["x"], "quebrada.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível ler essa imagem.");
    expect(screen.queryByAltText("Capa do projeto")).not.toBeInTheDocument();
  });

  it("falha no envio da capa interrompe: o projeto não é gravado e o erro aparece", async () => {
    h.upload.mockRejectedValue(new Error("Arquivo muito grande"));
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "Verão");
    await pick(user, new File(["x"], "foto.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo muito grande");
    expect(h.create).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("arrastar uma imagem para a área também escolhe a capa", async () => {
    render(<ProjectForm onClose={onClose} />);
    const area = screen.getByRole("group", { name: /Capa/ });
    const file = new File(["x"], "arrastada.webp", { type: "image/webp" });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.drop(area, { dataTransfer: { files: [file] } });
    expect(await screen.findByAltText("Capa do projeto")).toBeInTheDocument();
    expect(h.resize).toHaveBeenCalledWith(file);
  });
});

describe("editar projeto", () => {
  it("vem preenchido, com o status atual, e salva só com o que mudou no corpo (status incluso)", async () => {
    const user = userEvent.setup();
    render(<ProjectForm project={project()} onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "Editar projeto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue("Lançamento Verão");
    expect(screen.getByLabelText(/^Descrição/)).toHaveValue("Coleção nova");
    expect(screen.getByLabelText("Status")).toHaveValue("ativo");
    expect(screen.getByAltText("Capa do projeto")).toHaveAttribute("src", "https://cdn.test/capa.jpg");

    await user.selectOptions(screen.getByLabelText("Status"), "pausado");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(h.update).toHaveBeenCalledWith({
      projectId: "p1",
      input: { name: "Lançamento Verão", description: "Coleção nova", status: "pausado" },
    });
    expect(h.toast.success).toHaveBeenCalledWith("Projeto atualizado");
    expect(onSaved).toHaveBeenCalledWith(expect.anything(), false);
    expect(onClose).toHaveBeenCalled();
  });

  it("limpar a descrição envia nulo", async () => {
    const user = userEvent.setup();
    render(<ProjectForm project={project()} onClose={onClose} />);
    await user.clear(screen.getByLabelText(/^Descrição/));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(h.update.mock.calls[0][0].input.description).toBeNull();
  });

  it("remover a capa existente envia cover_url nulo", async () => {
    const user = userEvent.setup();
    render(<ProjectForm project={project()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Remover capa" }));
    expect(screen.queryByAltText("Capa do projeto")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(h.update.mock.calls[0][0].input.cover_url).toBeNull();
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("sem mexer na capa, cover_url nem vai no corpo", async () => {
    const user = userEvent.setup();
    render(<ProjectForm project={project()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(h.update.mock.calls[0][0].input).not.toHaveProperty("cover_url");
  });
});

describe("descartar alterações", () => {
  it("sem alterações, Cancelar fecha direto", async () => {
    const user = userEvent.setup();
    render(<ProjectForm project={project()} onClose={onClose} />);
    await user.click(drawer().getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("com alterações pendentes, pede confirmação: continuar editando mantém, descartar fecha", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "Rascunho");
    await user.click(drawer().getByRole("button", { name: "Cancelar" }));
    const confirm = within(screen.getByRole("alertdialog", { name: "Descartar as alterações?" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(confirm.getByRole("button", { name: "Continuar editando" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue("Rascunho");

    await user.click(drawer().getByRole("button", { name: "Cancelar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("o botão de fechar do painel segue a mesma regra (Escape também)", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome do projeto"), "x");
    await user.click(drawer().getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("alertdialog", { name: "Descartar as alterações?" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
