import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  lookup: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-agency-brands", () => ({
  useCreateAgencyBrand: () => ({ mutateAsync: h.create, isPending: false }),
  useUpdateAgencyBrand: () => ({ mutateAsync: h.update, isPending: false }),
  useUploadAgencyBrandPhoto: () => ({ mutateAsync: h.upload, isPending: false }),
}));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [{ id: 1, parent_id: null, name: "Beleza" }, { id: 2, parent_id: null, name: "Moda" }] }) }));
vi.mock("@/shared/utils/postal-code", () => ({ lookupPostalCode: h.lookup }));
vi.mock("@/lib/utils/api", () => ({ getUploadUrl: (p: string | null) => (p ? `https://cdn.test${p}` : undefined) }));

import type { AgencyBrand } from "@/shared/services/agency-brands";

import { BrandFormDialog, brandErrorMessage } from "./brand-form-dialog";

const brand: AgencyBrand = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme",
  photo: null,
  description: "Cosméticos",
  niche_id: 1,
  legal_name: "Acme Ltda",
  tax_id: "12345678000190",
  postal_code: "05101210",
  street: "Rua A",
  street_number: "10",
  unit: null,
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  status: "active",
  campaigns_count: 2,
  created_at: "2026-11-03T00:00:00Z",
};

const saved = { ...brand, id: "new-id" };

beforeEach(() => {
  vi.clearAllMocks();
  h.create.mockResolvedValue(saved);
  h.update.mockResolvedValue(brand);
  h.upload.mockResolvedValue(saved);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
});

describe("BrandFormDialog", () => {
  it("sem nome não envia e mostra o aviso", async () => {
    const user = userEvent.setup();
    render(<BrandFormDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    expect(screen.getByText("Informe o nome da marca")).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("pede identidade, dados da empresa e endereço, como no cadastro de um workspace", () => {
    render(<BrandFormDialog onClose={vi.fn()} />);
    for (const label of ["Nome da marca", "Segmento", "Sobre a marca", "Razão social", "CNPJ", "CEP", "Rua / Avenida", "Número", "Complemento", "Bairro", "Cidade", "Estado"]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Escolher logo" })).toBeInTheDocument();
  });

  it("cria só com o nome: os demais campos vão como null e fecha ao dar certo", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "  Beta Moda ");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.create).toHaveBeenCalledWith({
      name: "Beta Moda", description: null, niche_id: null, legal_name: null, tax_id: null, postal_code: null,
      street: null, street_number: null, unit: null, neighborhood: null, city: null, state: null,
    });
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.toast.success).toHaveBeenCalledWith("Marca criada");
  });

  it("CNPJ e CEP ganham máscara e vão só com dígitos; CNPJ incompleto é recusado", async () => {
    const user = userEvent.setup();
    render(<BrandFormDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Nome da marca"), "Beta");
    await user.type(screen.getByLabelText(/^CNPJ/), "12345678000190");
    expect(screen.getByLabelText(/^CNPJ/)).toHaveValue("12.345.678/0001-90");
    await user.clear(screen.getByLabelText(/^CNPJ/));
    await user.type(screen.getByLabelText(/^CNPJ/), "123");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    expect(screen.getByText("O CNPJ tem 14 dígitos")).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/^CNPJ/));
    await user.type(screen.getByLabelText(/^CNPJ/), "12345678000190");
    await user.type(screen.getByLabelText(/^CEP/), "05101210");
    expect(screen.getByLabelText(/^CEP/)).toHaveValue("05101-210");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    await waitFor(() => expect(h.create).toHaveBeenCalled());
    expect(h.create.mock.calls[0][0]).toMatchObject({ tax_id: "12345678000190", postal_code: "05101210" });
  });

  it("o CEP preenche rua, bairro, cidade e estado", async () => {
    h.lookup.mockResolvedValue({ logradouro: "Avenida Cardeal Motta", complemento: "", bairro: "City América", localidade: "São Paulo", uf: "SP" });
    const user = userEvent.setup();
    render(<BrandFormDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/^CEP/), "05101210");
    await user.tab();
    await waitFor(() => expect(screen.getByLabelText(/^Rua/)).toHaveValue("Avenida Cardeal Motta"));
    expect(screen.getByLabelText(/^Bairro/)).toHaveValue("City América");
    expect(screen.getByLabelText(/^Cidade/)).toHaveValue("São Paulo");
    expect(screen.getByLabelText(/^Estado/)).toHaveValue("SP");
  });

  it("CEP inexistente mostra o aviso", async () => {
    h.lookup.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<BrandFormDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/^CEP/), "99999999");
    await user.tab();
    expect(await screen.findByText("CEP não encontrado")).toBeInTheDocument();
  });

  it("logo: mostra a prévia e envia depois de criar a marca", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "Beta");
    const file = new File(["x"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Arquivo da logo"), file);
    expect(screen.getByAltText("Logo da marca")).toHaveAttribute("src", "blob:preview");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    await waitFor(() => expect(h.upload).toHaveBeenCalledWith({ brandId: "new-id", file }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("recusa arquivo que não é imagem aceita e imagem grande demais", async () => {
    render(<BrandFormDialog onClose={vi.fn()} />);
    const input = screen.getByLabelText("Arquivo da logo");
    fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText("Use uma imagem JPG, PNG ou WebP.")).toBeInTheDocument();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText("A imagem passa de 5 MB.")).toBeInTheDocument();
    expect(screen.queryByAltText("Logo da marca")).not.toBeInTheDocument();
  });

  it("a marca é criada mesmo se a logo falhar, e a pessoa é avisada", async () => {
    h.upload.mockRejectedValue(new Error("Storage fora do ar"));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "Beta");
    await user.upload(screen.getByLabelText("Arquivo da logo"), new File(["x"], "logo.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalledWith(expect.stringContaining("Marca criada, mas a logo não foi enviada")));
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("edita: parte de todos os dados da marca e envia o id com as mudanças", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BrandFormDialog brand={brand} onClose={onClose} />);
    expect(screen.getByLabelText("Nome da marca")).toHaveValue("Acme");
    expect(screen.getByLabelText(/^CNPJ/)).toHaveValue("12.345.678/0001-90");
    expect(screen.getByLabelText(/^CEP/)).toHaveValue("05101-210");
    expect(screen.getByLabelText(/^Segmento/)).toHaveValue("1");
    await user.clear(screen.getByLabelText("Nome da marca"));
    await user.type(screen.getByLabelText("Nome da marca"), "Acme Plus");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.update).toHaveBeenCalledWith({
      brandId: brand.id,
      input: {
        name: "Acme Plus", description: "Cosméticos", niche_id: 1, legal_name: "Acme Ltda", tax_id: "12345678000190",
        postal_code: "05101210", street: "Rua A", street_number: "10", unit: null, neighborhood: "Centro", city: "São Paulo", state: "SP",
      },
    });
    expect(h.toast.success).toHaveBeenCalledWith("Marca atualizada");
  });

  it("editar: remover a logo atual manda photo null", async () => {
    const user = userEvent.setup();
    render(<BrandFormDialog brand={{ ...brand, photo: "/uploads/x.png" }} onClose={vi.fn()} />);
    expect(screen.getByAltText("Logo da marca")).toHaveAttribute("src", "https://cdn.test/uploads/x.png");
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0][0].input.photo).toBeNull();
  });

  it("nome repetido: mostra a mensagem em português, e não fecha", async () => {
    h.create.mockRejectedValue({ error: "BRAND_NAME_TAKEN", message: "x" });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "Acme");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Já existe uma marca ativa com esse nome nesta agência."));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("brandErrorMessage", () => {
  it("código conhecido vira texto claro; desconhecido usa a mensagem; sem nada, o padrão", () => {
    expect(brandErrorMessage({ error: "BRAND_REQUIRED" }, "f")).toBe("Escolha a marca da campanha.");
    expect(brandErrorMessage({ data: { error: "BRAND_ARCHIVED" } }, "f")).toBe("Essa marca está arquivada.");
    expect(brandErrorMessage({ error: "OUTRO", message: "Falhou" }, "f")).toBe("Falhou");
    expect(brandErrorMessage(null, "padrão")).toBe("padrão");
  });
});
