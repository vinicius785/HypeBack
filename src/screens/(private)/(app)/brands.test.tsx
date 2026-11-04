import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isAgency: true,
  canWrite: true,
  brands: [] as unknown[],
  setStatus: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ children, search, className }: { children: React.ReactNode; search?: { brand?: string }; className?: string }) => (
    <a className={className} data-brand={search?.brand}>
      {children}
    </a>
  ),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspacePermissions: () => ({ workspace_settings_write: h.canWrite }),
}));
vi.mock("@/hooks/use-agency-brands", () => ({
  useIsAgencyWorkspace: () => h.isAgency,
  useAgencyBrands: () => ({ data: h.brands, isLoading: false, error: null }),
  useSetAgencyBrandStatus: () => ({ mutate: h.setStatus, isPending: false }),
}));
vi.mock("@/components/agency/brand-form-dialog", () => ({
  BrandFormDialog: ({ brand }: { brand?: { name: string } }) => <div role="dialog">{brand ? `Editar ${brand.name}` : "Nova marca"}</div>,
  brandErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/styles/agency-brands.css", () => ({}));

import { Route } from "./brands";

const Page = (Route as unknown as { component: () => ReactElement }).component;

const mk = (id: string, name: string, status: "active" | "archived", n = 0) => ({
  id,
  name,
  photo: null,
  description: null,
  status,
  campaigns_count: n,
  created_at: "2026-11-03T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  h.isAgency = true;
  h.canWrite = true;
  h.brands = [mk("b1", "Acme", "active", 3), mk("b2", "Beta Moda", "active", 1), mk("b3", "Velha", "archived", 0)];
});

describe("página Marcas", () => {
  it("fora de agência explica que é exclusivo e não lista nada", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.getByText("Marcas são exclusivas de agências")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("agência: lista só as ativas, com a contagem de campanhas, e as arquivadas ficam na outra aba", async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("3 campanhas")).toBeInTheDocument();
    expect(screen.getByText("1 campanha")).toBeInTheDocument();
    expect(screen.queryByText("Velha")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Arquivadas (1)" }));
    expect(screen.getByText("Velha")).toBeInTheDocument();
    expect(screen.getByText("Arquivada")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("'Ver campanhas' leva ao filtro por aquela marca", () => {
    render(<Page />);
    const card = screen.getByText("Acme").closest("article") as HTMLElement;
    expect(within(card).getByText("Ver campanhas").closest("a")).toHaveAttribute("data-brand", "b1");
  });

  it("arquivar chama a API com o novo estado, e reativar volta para active", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const card = screen.getByText("Acme").closest("article") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Arquivar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ brandId: "b1", status: "archived" }, expect.any(Object));
    await user.click(screen.getByRole("tab", { name: "Arquivadas (1)" }));
    const old = screen.getByText("Velha").closest("article") as HTMLElement;
    await user.click(within(old).getByRole("button", { name: "Reativar" }));
    expect(h.setStatus).toHaveBeenLastCalledWith({ brandId: "b3", status: "active" }, expect.any(Object));
  });

  it("quem não pode editar não vê Nova marca, Editar nem Arquivar", () => {
    h.canWrite = false;
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Nova marca" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arquivar" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Ver campanhas").length).toBe(2);
  });

  it("Nova marca e Editar abrem o formulário", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getAllByRole("button", { name: "Nova marca" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova marca");
  });
});
