import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...rest }: { to: string; params?: Record<string, string>; children?: ReactNode }) => (
    <a href={params ? to.replace("$id", params.id) : to} {...rest}>
      {children}
    </a>
  ),
}));

import { toAdminApiError } from "@/lib/admin/admin-client";

import { AdminTable, type AdminTableColumn } from "./admin-table";

interface Row {
  id: string;
  name: string;
  members: number;
  status: string;
}

const ROWS: Row[] = [
  { id: "a", name: "Acme Ltda", members: 4, status: "Ativo" },
  { id: "b", name: "Beta Co", members: 12, status: "Suspenso" },
];

const COLUMNS: AdminTableColumn<Row>[] = [
  { key: "name", header: "Workspace", cell: (r) => r.name, sortable: true, width: "2fr" },
  { key: "members", header: "Membros", align: "right", cell: (r) => r.members, sortKey: "members", width: "90px" },
  { key: "status", header: "Status", cell: (r) => r.status, hideBelow: "md", width: "120px", definition: "Estado do ciclo de vida" },
];

function renderTable(props: Partial<React.ComponentProps<typeof AdminTable<Row>>> = {}) {
  return render(<AdminTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} caption="Workspaces" {...props} />);
}

describe("AdminTable", () => {
  it("é uma tabela acessível feita de papéis ARIA, com cabeçalhos, linhas e células", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Workspaces" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Workspace");
    expect(headers[1]).toHaveTextContent("Membros");
    expect(headers[2]).toHaveTextContent("Status");
    // 1 linha de cabeçalho + 2 de dados
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Acme Ltda", "4", "Ativo", "Beta Co", "12", "Suspenso"]);
  });

  it("não usa <table> nativo (o .pv table global o reestilizaria)", () => {
    const { container } = renderTable();
    expect(container.querySelector("table, th, td")).toBeNull();
  });

  it("primeira carga: esqueleto no lugar das linhas, aviso para leitor de tela e tabela ocupada", () => {
    const { container } = renderTable({ rows: undefined, loading: true, skeletonRows: 3 });
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".adm-row .adm-sk")).toHaveLength(3 * COLUMNS.length);
    expect(screen.queryByText("Acme Ltda")).not.toBeInTheDocument();
  });

  it("recarregando com dado na tela: a lista fica (nada de piscar) e só marca como ocupada", () => {
    renderTable({ refreshing: true });
    expect(screen.getByText("Acme Ltda")).toBeInTheDocument();
    const bodies = screen.getAllByRole("rowgroup");
    expect(bodies[bodies.length - 1]).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("estado vazio com título, descrição e ação", () => {
    renderTable({
      rows: [],
      empty: { title: "Nenhum workspace encontrado", description: "Tente outro filtro.", action: <button type="button">Limpar filtros</button> },
    });
    expect(screen.getByText("Nenhum workspace encontrado")).toBeInTheDocument();
    expect(screen.getByText("Tente outro filtro.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
    expect(screen.getAllByRole("row").every((row) => row.querySelector('[role="columnheader"]') || row.className.includes("adm-state-row"))).toBe(true);
  });

  it("estado vazio padrão", () => {
    renderTable({ rows: [] });
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro sem dados: mostra o motivo e 'Tentar de novo' chama onRetry", async () => {
    const onRetry = vi.fn();
    renderTable({ rows: undefined, error: toAdminApiError(500, { message: "x" }), onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("O servidor teve um problema");
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("endpoint que o servidor ainda não tem: diz exatamente isso", () => {
    renderTable({ rows: undefined, error: toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/workspaces" }), onRetry: vi.fn() });
    expect(screen.getByRole("alert")).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
  });

  it("a falha de uma atualização não esconde a lista que já estava na tela", () => {
    renderTable({ error: toAdminApiError(500, {}), onRetry: vi.fn() });
    expect(screen.getByText("Acme Ltda")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("cabeçalho ordenável é botão, com aria-sort; chama onSort com a chave de ordenação", async () => {
    const onSort = vi.fn();
    renderTable({ sort: { by: "members", order: "desc" }, onSort });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveAttribute("aria-sort", "none");
    expect(headers[1]).toHaveAttribute("aria-sort", "descending");
    expect(headers[2]).not.toHaveAttribute("aria-sort");
    expect(within(headers[2]).queryByRole("button", { name: "Status" })).not.toBeInTheDocument();

    await userEvent.click(within(headers[0]).getByRole("button", { name: "Workspace" }));
    expect(onSort).toHaveBeenCalledWith("name");
    await userEvent.click(within(headers[1]).getByRole("button", { name: "Membros" }));
    expect(onSort).toHaveBeenLastCalledWith("members");
  });

  it("ordem crescente aparece como 'ascending'", () => {
    renderTable({ sort: { by: "name", order: "asc" }, onSort: vi.fn() });
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "ascending");
  });

  it("sem onSort os cabeçalhos são só texto", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: "Workspace" })).not.toBeInTheDocument();
  });

  it("no celular a ordenação vira um seletor (os cabeçalhos somem)", () => {
    const onSort = vi.fn();
    renderTable({ sort: { by: "name", order: "asc" }, onSort });
    const select = screen.getByLabelText("Ordenar por");
    fireEvent.change(select, { target: { value: "members" } });
    expect(onSort).toHaveBeenCalledWith("members");
    expect(within(select as HTMLElement).getAllByRole("option").map((o) => o.textContent)).toEqual(["Workspace", "Membros"]);
    fireEvent.click(screen.getByRole("button", { name: /Ordem crescente/ }));
    expect(onSort).toHaveBeenLastCalledWith("name");
  });

  it("linha com link: a célula principal vira um link de verdade (abre em nova aba) e as outras não", () => {
    renderTable({ rowLink: (r) => ({ to: "/admin/workspaces/$id", params: { id: r.id } }) });
    const link = screen.getByRole("link", { name: "Acme Ltda" });
    expect(link).toHaveAttribute("href", "/admin/workspaces/a");
    expect(link).toHaveClass("adm-row-link");
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-link", "true");
  });

  it("sem rowLink não há links", () => {
    renderTable();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("as colunas viram variáveis CSS por faixa de largura; hideBelow marca célula e cabeçalho", () => {
    const { container } = renderTable();
    const root = container.querySelector<HTMLElement>(".adm-table");
    expect(root?.style.getPropertyValue("--adm-cols")).toBe("2fr 90px 120px");
    expect(root?.style.getPropertyValue("--adm-cols-lg")).toBe("2fr 90px 120px");
    expect(root?.style.getPropertyValue("--adm-cols-md")).toBe("2fr 90px");
    expect(container.querySelectorAll('[data-hide="md"]')).toHaveLength(1 + ROWS.length);
  });

  it("cada célula leva o rótulo para o modo empilhado; a primeira é a principal", () => {
    const { container } = renderTable({ columns: [{ ...COLUMNS[0], mobileLabel: "" }, COLUMNS[1], COLUMNS[2]] });
    const cells = container.querySelectorAll(".adm-tbody .adm-row:first-child .adm-cell");
    expect(cells[0]).toHaveAttribute("data-primary", "true");
    expect(cells[0]).toHaveAttribute("data-label", "");
    expect(cells[1]).toHaveAttribute("data-label", "Membros");
  });

  it("a coluna principal pode ser outra", () => {
    const { container } = renderTable({ columns: [COLUMNS[1], { ...COLUMNS[0], primary: true }, COLUMNS[2]] });
    const cells = container.querySelectorAll(".adm-tbody .adm-row:first-child .adm-cell");
    expect(cells[1]).toHaveAttribute("data-primary", "true");
    expect(cells[0]).not.toHaveAttribute("data-primary");
  });

  it("definição da coluna: botão com a regra para leitor de tela", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Como é calculado: Status" })).toHaveAccessibleDescription("Estado do ciclo de vida");
  });

  it("rodapé (paginação) fica dentro da tabela", () => {
    renderTable({ footer: <div>paginação aqui</div> });
    expect(screen.getByText("paginação aqui").closest(".adm-table")).not.toBeNull();
  });

  it("cabeçalho fixo é o padrão e pode ser desligado", () => {
    const { container, rerender } = renderTable();
    expect(container.querySelector(".adm-table")).not.toHaveAttribute("data-sticky");
    rerender(<AdminTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} caption="Workspaces" stickyHeader={false} />);
    expect(container.querySelector(".adm-table")).toHaveAttribute("data-sticky", "false");
  });
});
