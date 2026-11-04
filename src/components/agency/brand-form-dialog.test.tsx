import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-agency-brands", () => ({
  useCreateAgencyBrand: () => ({ mutate: h.create, isPending: false }),
  useUpdateAgencyBrand: () => ({ mutate: h.update, isPending: false }),
}));

import type { AgencyBrand } from "@/shared/services/agency-brands";

import { BrandFormDialog, brandErrorMessage } from "./brand-form-dialog";

const brand: AgencyBrand = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme",
  photo: null,
  description: "Cosméticos",
  status: "active",
  campaigns_count: 2,
  created_at: "2026-11-03T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BrandFormDialog", () => {
  it("sem nome não envia e mostra o aviso", async () => {
    const user = userEvent.setup();
    render(<BrandFormDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    expect(screen.getByText("Informe o nome da marca")).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("cria: manda nome e descrição aparados, e fecha ao dar certo", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    h.create.mockImplementation((_input, opts) => opts.onSuccess());
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "  Beta Moda ");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    expect(h.create).toHaveBeenCalledWith({ name: "Beta Moda", description: null }, expect.any(Object));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.toast.success).toHaveBeenCalledWith("Marca criada");
  });

  it("edita: parte dos dados da marca e envia o id com as mudanças", async () => {
    const user = userEvent.setup();
    render(<BrandFormDialog brand={brand} onClose={vi.fn()} />);
    const name = screen.getByLabelText("Nome da marca");
    expect(name).toHaveValue("Acme");
    await user.clear(name);
    await user.type(name, "Acme Plus");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.update).toHaveBeenCalledWith(
      { brandId: brand.id, input: { name: "Acme Plus", description: "Cosméticos" } },
      expect.any(Object),
    );
  });

  it("nome repetido: mostra a mensagem em português, e não fecha", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    h.create.mockImplementation((_input, opts) => opts.onError({ error: "BRAND_NAME_TAKEN", message: "x" }));
    render(<BrandFormDialog onClose={onClose} />);
    await user.type(screen.getByLabelText("Nome da marca"), "Acme");
    await user.click(screen.getByRole("button", { name: "Criar marca" }));
    expect(h.toast.error).toHaveBeenCalledWith("Já existe uma marca ativa com esse nome nesta agência.");
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
