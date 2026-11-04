import type React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isAgency: true,
  canWrite: true,
  loading: false,
  brands: [] as unknown[],
  setStatus: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ children, search, to: _to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { search?: { brand?: string }; to?: string }) => (
    <a href="#" data-brand={search?.brand} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspacePermissions: () => ({ workspace_settings_write: h.canWrite }),
}));
vi.mock("@/hooks/use-agency-brands", () => ({
  useIsAgencyWorkspace: () => h.isAgency,
  useAgencyBrands: () => ({ data: h.loading ? undefined : h.brands, isLoading: h.loading, error: null }),
  useSetAgencyBrandStatus: () => ({ mutate: h.setStatus, isPending: false }),
}));
vi.mock("@/components/agency/brand-form-dialog", () => ({
  BrandFormDialog: ({ brand }: { brand?: { name: string } }) => <div role="dialog">{brand ? `Editar ${brand.name}` : "Nova marca"}</div>,
  brandErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/styles/agency-brands.css", () => ({}));

import { Route } from "./brands";

const Page = (Route as unknown as { component: () => React.JSX.Element }).component;

const mk = (id: string, name: string, status: "active" | "archived", n = 0, description: string | null = null) => ({
  id, name, photo: null, description, status, campaigns_count: n, created_at: "2026-11-03T12:00:00Z",
});

const cardOf = (name: string) => screen.getByText(name).closest("article") as HTMLElement;
const kpi = (label: RegExp | string) => within(screen.getByRole("group", { name: "Resumo de marcas" })).getByRole("button", { name: label });

beforeEach(() => {
  vi.clearAllMocks();
  h.isAgency = true;
  h.canWrite = true;
  h.loading = false;
  h.brands = [mk("b1", "Acme", "active", 3, "Cosméticos"), mk("b2", "Beta Moda", "active", 1), mk("b3", "Velha", "archived", 0)];
});

describe("página Marcas", () => {
  it("fora de agência explica que é exclusivo e não lista nada", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.getByText("Marcas são exclusivas de agências")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("cabeçalho, indicadores reais e só as marcas ativas por padrão", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Marcas" })).toBeInTheDocument();
    const strip = screen.getByRole("group", { name: "Resumo de marcas" });
    const value = (label: string) => within(within(strip).getByText(label).closest("button") as HTMLElement).getByText(/^\d+$/).textContent;
    expect(value("Ativas")).toBe("2");
    expect(value("Arquivadas")).toBe("1");
    expect(value("Com campanhas")).toBe("2");
    expect(value("Sem campanhas")).toBe("0");
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Velha")).not.toBeInTheDocument();
  });

  it("o cartão mostra estado, descrição e quantidade de campanhas", () => {
    render(<Page />);
    const acme = cardOf("Acme");
    expect(within(acme).getByText("Ativa")).toBeInTheDocument();
    expect(within(acme).getByText("Cosméticos")).toBeInTheDocument();
    expect(within(acme).getByText("3 campanhas")).toBeInTheDocument();
    const beta = cardOf("Beta Moda");
    expect(within(beta).getByText("Sem descrição")).toBeInTheDocument();
    expect(within(beta).getByText("1 campanha")).toBeInTheDocument();
  });

  it("clicar no indicador Arquivadas filtra; clicar de novo volta ao padrão", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(kpi(/Arquivadas/));
    expect(screen.getByText("Velha")).toBeInTheDocument();
    expect(within(cardOf("Velha")).getByText("Arquivada")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    await user.click(kpi(/Arquivadas/));
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("filtro 'Sem campanhas' e chips dos filtros ativos", async () => {
    h.brands = [mk("b1", "Acme", "active", 3), mk("b2", "Zero", "active", 0)];
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("button", { name: "Sem campanhas" }));
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByText("Zero")).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: "Filtros aplicados" });
    await user.click(within(chips).getByRole("button", { name: "Remover filtro: Sem campanhas" }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("busca por nome e estado de busca sem resultados com 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.type(screen.getByRole("searchbox", { name: "Buscar marca" }), "beta");
    expect(screen.getByText("Beta Moda")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Buscar marca" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar marca" }), "xyz");
    expect(screen.getByText("Nenhuma marca encontrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar marca" })).toHaveValue("");
  });

  it("ordenação alfabética por padrão e inversa pelo menu", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const order = () => screen.getAllByRole("article").map((a) => a.querySelector("b")?.textContent);
    expect(order()).toEqual(["Acme", "Beta Moda"]);
    await user.click(screen.getByRole("button", { name: /Ordenar: Nome \(A–Z\)/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Nome (Z–A)" }));
    expect(order()).toEqual(["Beta Moda", "Acme"]);
  });

  it("o cartão inteiro e o menu levam ao filtro de campanhas da marca", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const card = cardOf("Acme");
    expect(within(card).getByRole("link", { name: "Ver campanhas de Acme" })).toHaveAttribute("data-brand", "b1");
    await user.click(within(card).getByRole("button", { name: "Mais ações para Acme" }));
    expect(within(card).getByRole("menuitem", { name: /Ver campanhas/ })).toHaveAttribute("data-brand", "b1");
  });

  it("com o menu aberto o cartão sobe acima dos vizinhos (o menu não fica por baixo do cartão seguinte)", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const card = cardOf("Acme");
    expect(card).not.toHaveClass("menu-open");
    await user.click(within(card).getByRole("button", { name: "Mais ações para Acme" }));
    expect(card).toHaveClass("menu-open");
    expect(cardOf("Beta Moda")).not.toHaveClass("menu-open");
    await user.keyboard("{Escape}");
    expect(card).not.toHaveClass("menu-open");
  });

  it("arquivar pelo menu chama a API com o novo estado; reativar volta para active", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(within(cardOf("Acme")).getByRole("button", { name: "Mais ações para Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ brandId: "b1", status: "archived" }, expect.any(Object));
    await user.click(kpi(/Arquivadas/));
    await user.click(within(cardOf("Velha")).getByRole("button", { name: "Mais ações para Velha" }));
    await user.click(screen.getByRole("menuitem", { name: "Reativar" }));
    expect(h.setStatus).toHaveBeenLastCalledWith({ brandId: "b3", status: "active" }, expect.any(Object));
  });

  it("quem não pode editar não vê Nova marca, Editar nem Arquivar", async () => {
    h.canWrite = false;
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Nova marca" })).not.toBeInTheDocument();
    await user.click(within(cardOf("Acme")).getByRole("button", { name: "Mais ações para Acme" }));
    expect(screen.queryByRole("menuitem", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Arquivar" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Ver campanhas/ })).toBeInTheDocument();
  });

  it("Nova marca e Editar abrem o formulário", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getAllByRole("button", { name: "Nova marca" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova marca");
  });

  it("Editar pelo menu abre o formulário da marca", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(within(cardOf("Acme")).getByRole("button", { name: "Mais ações para Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Editar Acme");
  });

  it("sem nenhuma marca: estado vazio com ação para cadastrar a primeira (e sem indicadores nem busca)", async () => {
    h.brands = [];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Nenhuma marca cadastrada ainda")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Resumo de marcas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    const empty = screen.getByText("Nenhuma marca cadastrada ainda").closest(".ov-empty") as HTMLElement;
    await user.click(within(empty).getByRole("button", { name: "Nova marca" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("tudo arquivado: o padrão (ativas) vazio leva às arquivadas ou a uma marca nova", async () => {
    h.brands = [mk("b3", "Velha", "archived", 0)];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Nenhuma marca ativa")).toBeInTheDocument();
    expect(screen.getByText(/Há 1 marca arquivada/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver arquivadas" }));
    expect(screen.getByText("Velha")).toBeInTheDocument();
  });

  it("carregando: esqueleto no lugar dos cartões", () => {
    h.loading = true;
    render(<Page />);
    expect(screen.getByLabelText("Carregando marcas")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Nenhuma marca cadastrada ainda")).not.toBeInTheDocument();
  });
});
