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

import { ADMIN_TABLE_BREAKPOINTS, AdminTable, type AdminTableColumn } from "./admin-table";

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

/** As mesmas colunas sem o "i" do cabeçalho: nos testes de teclado o primeiro Tab não cai nele. */
const PLAIN_COLUMNS = COLUMNS.map((c) => ({ ...c, definition: undefined }));

function rootOf(container: HTMLElement): HTMLElement {
  return container.querySelector(".adm-table") as HTMLElement;
}
const colsVar = (container: HTMLElement, name: string) => rootOf(container).style.getPropertyValue(name);

describe("AdminTable: limite de colunas configurável (hideBelow)", () => {
  const wide: AdminTableColumn<Row>[] = [
    COLUMNS[0],
    { key: "members", header: "Membros", cell: (r) => r.members, width: "90px", hideBelow: 1100 },
    { key: "status", header: "Status", cell: (r) => r.status, width: "120px", hideBelow: "sm" },
    { key: "extra", header: "Extra", cell: () => "x", width: "70px", hideBelow: "lg" },
  ];

  it("os breakpoints históricos continuam os mesmos e 'sm' fica antes do modo empilhado", () => {
    expect(ADMIN_TABLE_BREAKPOINTS).toEqual({ sm: 840, md: 960, lg: 1180 });
  });

  it("só 'md' e 'lg': nada muda (marca os atributos de sempre e não injeta CSS próprio)", () => {
    const { container } = renderTable({
      columns: [COLUMNS[0], { ...COLUMNS[1], hideBelow: "lg" }, { ...COLUMNS[2], hideBelow: "md" }],
    });
    expect(container.querySelector("style")).toBeNull();
    expect(rootOf(container)).not.toHaveAttribute("data-adm-scope");
    expect(colsVar(container, "--adm-cols")).toBe("2fr 90px 120px");
    expect(colsVar(container, "--adm-cols-lg")).toBe("2fr 120px"); // tira só a 'lg'
    expect(colsVar(container, "--adm-cols-md")).toBe("2fr"); // tira 'md' e 'lg'
    expect(container.querySelectorAll('[data-hide="lg"]')).toHaveLength(1 + ROWS.length);
    expect(container.querySelectorAll('[data-hide="md"]')).toHaveLength(1 + ROWS.length);
  });

  it("px e 'sm': o cabeçalho e as células levam o corte (nome ou px) e a grade ganha uma faixa por corte", () => {
    const { container } = renderTable({ columns: wide });
    expect(container.querySelectorAll('[data-hide="1100"]')).toHaveLength(1 + ROWS.length);
    expect(container.querySelectorAll('[data-hide="sm"]')).toHaveLength(1 + ROWS.length);
    expect(container.querySelectorAll('[data-hide="lg"]')).toHaveLength(1 + ROWS.length);
    // cada faixa lista só o que ainda cabe: abaixo de 840 sobra a 1ª; entre 840 e 1100, a 1ª e a 'sm'...
    expect(colsVar(container, "--adm-cols-t840")).toBe("2fr");
    expect(colsVar(container, "--adm-cols-t1100")).toBe("2fr 120px");
    expect(colsVar(container, "--adm-cols-t1180")).toBe("2fr 90px 120px");
    // ...e as variáveis do kit seguem a mesma regra (a 'sm' ainda cabe a 960; a de 1100 não)
    expect(colsVar(container, "--adm-cols-md")).toBe("2fr 120px");
    expect(colsVar(container, "--adm-cols-lg")).toBe("2fr 90px 120px");
  });

  it("o CSS gerado é restrito à tabela, não vale no modo empilhado e esconde cumulativamente", () => {
    const { container } = renderTable({ columns: wide });
    const scope = rootOf(container).getAttribute("data-adm-scope") as string;
    expect(scope).toBeTruthy();
    const css = container.querySelector("style")?.textContent ?? "";
    const blocks = css.split("@container").filter(Boolean);
    expect(blocks).toHaveLength(3);
    // do corte maior para o menor: o menor vem depois e vence
    expect(blocks.map((b) => /width <= (\d+)px/.exec(b)?.[1])).toEqual(["1180", "1100", "840"]);
    for (const block of blocks) {
      expect(block).toContain("adm-table (width > 720px)");
      expect(block).toContain(`data-adm-scope="${scope}"`);
    }
    // a 840: some tudo que corta em 840 ou mais (sm, 1100 e lg); a 1180: só a 'lg'
    expect(blocks[2]).toContain('[data-hide="sm"]');
    expect(blocks[2]).toContain('[data-hide="1100"]');
    expect(blocks[2]).toContain('[data-hide="lg"]');
    expect(blocks[0]).toContain('[data-hide="lg"]');
    expect(blocks[0]).not.toContain('[data-hide="1100"]');
    expect(blocks[2]).toContain("var(--adm-cols-t840)");
  });

  it("o CSS gerado nunca leva texto das colunas (larguras vão em variáveis, só números e nomes entram no <style>)", () => {
    const { container } = renderTable({
      columns: [{ ...COLUMNS[0], width: "} body { display: none } /*" }, { ...COLUMNS[1], hideBelow: 1000 }],
    });
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).not.toContain("body");
    expect(css).not.toContain("display: none } /*");
    expect(colsVar(container, "--adm-cols-t1000")).toContain("body");
  });

  it("duas tabelas na mesma página não compartilham o escopo do CSS", () => {
    const { container } = render(
      <>
        <AdminTable columns={wide} rows={ROWS} rowKey={(r) => r.id} caption="A" />
        <AdminTable columns={wide} rows={ROWS} rowKey={(r) => r.id} caption="B" />
      </>,
    );
    const scopes = Array.from(container.querySelectorAll(".adm-table")).map((el) => el.getAttribute("data-adm-scope"));
    expect(new Set(scopes).size).toBe(2);
  });

  it("corte de até 720px (ou inválido) não esconde nada: no empilhado já aparece tudo", () => {
    const { container } = renderTable({
      columns: [COLUMNS[0], { ...COLUMNS[1], hideBelow: 600 }, { ...COLUMNS[2], hideBelow: Number.NaN }],
    });
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("[data-hide]")).toBeNull();
    expect(colsVar(container, "--adm-cols-md")).toBe("2fr 90px 120px");
  });

  it("o esqueleto marca os mesmos cortes", () => {
    const { container } = renderTable({ columns: wide, rows: undefined, loading: true, skeletonRows: 2 });
    expect(container.querySelectorAll('.adm-cell[data-hide="1100"]')).toHaveLength(2);
  });
});

describe("AdminTable: linhas expansíveis (renderExpanded)", () => {
  it("sem renderExpanded não há botão de expandir", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: "Detalhes" })).not.toBeInTheDocument();
  });

  it("a 1ª célula de cada linha ganha o botão, fechado e ligado ao painel", () => {
    renderTable({ renderExpanded: (r) => <p>Detalhe de {r.name}</p> });
    const buttons = screen.getAllByRole("button", { name: "Detalhes" });
    expect(buttons).toHaveLength(ROWS.length);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls");
    }
    expect(buttons[0].closest('[role="cell"]')).toHaveAttribute("data-primary", "true");
    expect(screen.queryByText("Detalhe de Acme Ltda")).not.toBeInTheDocument();
    expect(document.getElementById(buttons[0].getAttribute("aria-controls") as string)).toBeNull();
  });

  it("clique abre e fecha; o painel é uma linha da tabela com o id do aria-controls", async () => {
    const user = userEvent.setup();
    renderTable({ renderExpanded: (r) => <p>Detalhe de {r.name}</p> });
    const [first, second] = screen.getAllByRole("button", { name: "Detalhes" });

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(first.getAttribute("aria-controls") as string) as HTMLElement;
    expect(panel).toHaveAttribute("role", "row");
    expect(within(panel).getByRole("cell")).toHaveTextContent("Detalhe de Acme Ltda");
    // fica logo depois da própria linha, e a outra linha continua fechada
    expect(panel.previousElementSibling).toBe(first.closest('[role="row"]'));
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Detalhe de Beta Co")).not.toBeInTheDocument();

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Detalhe de Acme Ltda")).not.toBeInTheDocument();
  });

  it("várias linhas podem ficar abertas ao mesmo tempo", async () => {
    const user = userEvent.setup();
    renderTable({ renderExpanded: (r) => <p>Detalhe de {r.name}</p> });
    const [first, second] = screen.getAllByRole("button", { name: "Detalhes" });
    await user.click(first);
    await user.click(second);
    expect(screen.getByText("Detalhe de Acme Ltda")).toBeInTheDocument();
    expect(screen.getByText("Detalhe de Beta Co")).toBeInTheDocument();
  });

  it("teclado: Tab chega ao botão; Enter abre, Espaço fecha; o foco continua no botão", async () => {
    const user = userEvent.setup();
    renderTable({ columns: PLAIN_COLUMNS, renderExpanded: (r) => <p>Detalhe de {r.name}</p> });
    const [first] = screen.getAllByRole("button", { name: "Detalhes" });

    await user.tab();
    // o 1º foco da tabela é o botão da 1ª linha (sem onSort nem "i" nos cabeçalhos)
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveFocus();
    await user.keyboard(" ");
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(first).toHaveFocus();
  });

  it("expandLabel dá um nome próprio a cada botão", () => {
    renderTable({ renderExpanded: () => <p>x</p>, expandLabel: (r) => `Detalhes de ${r.name}` });
    expect(screen.getByRole("button", { name: "Detalhes de Acme Ltda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detalhes de Beta Co" })).toBeInTheDocument();
  });

  it("renderExpanded só é chamado para a linha aberta (conteúdo pesado não é montado antes)", async () => {
    const user = userEvent.setup();
    const renderExpanded = vi.fn((r: Row) => <p>Detalhe de {r.name}</p>);
    renderTable({ renderExpanded });
    expect(renderExpanded).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("button", { name: "Detalhes" })[1]);
    expect(renderExpanded).toHaveBeenCalled();
    expect(renderExpanded.mock.calls.every(([row]) => row.id === "b")).toBe(true);
  });

  it("convive com rowLink: o link da linha segue na célula principal e o botão não é link", async () => {
    const user = userEvent.setup();
    renderTable({
      columns: PLAIN_COLUMNS,
      rowLink: (r) => ({ to: "/admin/workspaces/$id", params: { id: r.id } }),
      renderExpanded: (r) => <p>Detalhe de {r.name}</p>,
    });
    const link = screen.getByRole("link", { name: "Acme Ltda" });
    expect(link).toHaveAttribute("href", "/admin/workspaces/a");
    const button = screen.getAllByRole("button", { name: "Detalhes" })[0];
    expect(button.closest("a")).toBeNull();
    // a ordem de tabulação: botão, depois o link da mesma linha
    await user.tab();
    expect(button).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("o painel aberto conta como uma célula que ocupa todas as colunas (inclusive a de ações)", async () => {
    const user = userEvent.setup();
    renderTable({ renderExpanded: () => <p>x</p>, rowActions: () => <button type="button">⋯</button> });
    await user.click(screen.getAllByRole("button", { name: "Detalhes" })[0]);
    const panel = document.querySelector(".adm-xrow") as HTMLElement;
    expect(within(panel).getByRole("cell")).toHaveAttribute("aria-colspan", "4");
  });

  it("a linha aberta marca data-expanded e o botão aponta para a linha certa depois de reordenar", async () => {
    const user = userEvent.setup();
    const { rerender } = renderTable({ renderExpanded: (r) => <p>Detalhe de {r.name}</p> });
    await user.click(screen.getAllByRole("button", { name: "Detalhes" })[0]);
    rerender(
      <AdminTable
        columns={COLUMNS}
        rows={[ROWS[1], ROWS[0]]}
        rowKey={(r) => r.id}
        caption="Workspaces"
        renderExpanded={(r) => <p>Detalhe de {r.name}</p>}
      />,
    );
    // quem estava aberta (Acme) segue aberta, agora na 2ª posição
    const rows = screen.getAllByRole("row").filter((r) => r.classList.contains("adm-row"));
    expect(rows[0]).not.toHaveAttribute("data-expanded");
    expect(rows[1]).toHaveAttribute("data-expanded", "true");
    const button = within(rows[1]).getByRole("button", { name: "Detalhes" });
    expect(document.getElementById(button.getAttribute("aria-controls") as string)).toHaveTextContent("Detalhe de Acme Ltda");
  });
});

describe("AdminTable: headerLabel (nome acessível de cabeçalho sem texto)", () => {
  const cols: AdminTableColumn<Row>[] = [
    COLUMNS[0],
    { key: "actions", header: "", headerLabel: "Ações da linha", cell: () => <button type="button">⋯</button>, width: "48px" },
  ];

  it("a coluna de cabeçalho vazio ganha nome para leitor de tela", () => {
    renderTable({ columns: cols });
    expect(screen.getByRole("columnheader", { name: "Ações da linha" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Workspace" })).toBeInTheDocument();
  });

  it("sem headerLabel o cabeçalho segue sem nome inventado", () => {
    renderTable({ columns: [COLUMNS[0], { ...cols[1], headerLabel: undefined }] });
    expect(screen.getAllByRole("columnheader").map((h) => h.getAttribute("aria-label"))).toEqual([null, null]);
  });

  it("a definição da coluna usa o mesmo nome", () => {
    renderTable({ columns: [{ ...COLUMNS[0], header: "", headerLabel: "Nome do workspace", definition: "Como o nome aparece." }] });
    expect(screen.getByRole("button", { name: "Como é calculado: Nome do workspace" })).toBeInTheDocument();
  });

  it("o seletor de ordenação do celular mostra o headerLabel quando o cabeçalho é vazio", () => {
    renderTable({
      columns: [{ ...COLUMNS[0], header: "", headerLabel: "Workspace (nome)", sortable: true }, COLUMNS[1]],
      sort: { by: "name", order: "asc" },
      onSort: vi.fn(),
    });
    const options = within(screen.getByLabelText("Ordenar por")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Workspace (nome)", "Membros"]);
  });
});

describe("AdminTable: coluna de ações (rowActions)", () => {
  const actions = (r: Row) => <button type="button" aria-label={`Ações de ${r.name}`}>⋯</button>;

  it("sem rowActions não há coluna extra", () => {
    const { container } = renderTable();
    expect(container.querySelector(".adm-cell-actions")).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("uma célula por linha, à direita, com o cabeçalho 'Ações' só para leitor de tela", () => {
    const { container } = renderTable({ rowActions: actions });
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(4);
    expect(headers[3]).toHaveAccessibleName("Ações");
    expect(headers[3]).toHaveTextContent("");
    const cells = within(container.querySelector(".adm-tbody") as HTMLElement).getAllByRole("cell");
    expect(cells).toHaveLength(ROWS.length * 4);
    expect(cells[3]).toHaveAttribute("data-actions", "true");
    expect(cells[3]).toHaveAttribute("data-label", "");
    expect(within(cells[3]).getByRole("button", { name: "Ações de Acme Ltda" })).toBeInTheDocument();
  });

  it("rowActionsLabel renomeia o cabeçalho", () => {
    renderTable({ rowActions: actions, rowActionsLabel: "Opções" });
    expect(screen.getByRole("columnheader", { name: "Opções" })).toBeInTheDocument();
  });

  it("a grade ganha um trilho com largura mínima do alvo de toque, em todas as faixas", () => {
    const { container } = renderTable({ rowActions: actions });
    const track = "minmax(var(--adm-hit), max-content)";
    expect(colsVar(container, "--adm-cols")).toBe(`2fr 90px 120px ${track}`);
    expect(colsVar(container, "--adm-cols-lg")).toBe(`2fr 90px 120px ${track}`);
    expect(colsVar(container, "--adm-cols-md")).toBe(`2fr 90px ${track}`);
  });

  it("as faixas dos cortes em px também levam o trilho de ações", () => {
    const { container } = renderTable({
      rowActions: actions,
      columns: [COLUMNS[0], { ...COLUMNS[1], hideBelow: 1000 }],
    });
    expect(colsVar(container, "--adm-cols-t1000")).toBe("2fr minmax(var(--adm-hit), max-content)");
  });

  it("a linha avisa que tem ações (o CSS do cartão do celular reserva o canto)", () => {
    renderTable({ rowActions: actions });
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-has-actions", "true");
  });

  it("o botão da linha funciona mesmo com rowLink (fica acima do link esticado) e entra na ordem de tabulação", async () => {
    const user = userEvent.setup();
    const onAct = vi.fn();
    renderTable({
      columns: PLAIN_COLUMNS,
      rowLink: (r) => ({ to: "/admin/workspaces/$id", params: { id: r.id } }),
      rowActions: (r) => (
        <button type="button" onClick={onAct}>
          Ações de {r.name}
        </button>
      ),
    });
    await user.tab();
    expect(screen.getByRole("link", { name: "Acme Ltda" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Ações de Acme Ltda" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("esqueleto, estado vazio e erro respeitam a coluna extra", () => {
    const { container, rerender } = renderTable({ rowActions: actions, rows: undefined, loading: true, skeletonRows: 2 });
    expect(container.querySelectorAll(".adm-tbody .adm-row .adm-cell")).toHaveLength(2 * 4);
    rerender(<AdminTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} caption="Workspaces" rowActions={actions} />);
    expect(container.querySelector(".adm-state-row [role=cell]")).toHaveAttribute("aria-colspan", "4");
  });

  it("junto com a linha expansível: o botão de expandir fica na 1ª célula e as ações na última", () => {
    const { container } = renderTable({ rowActions: actions, renderExpanded: () => <p>x</p> });
    const cells = container.querySelectorAll(".adm-tbody .adm-row:first-child > .adm-cell");
    expect(within(cells[0] as HTMLElement).getByRole("button", { name: "Detalhes" })).toBeInTheDocument();
    expect(within(cells[cells.length - 1] as HTMLElement).getByRole("button", { name: "Ações de Acme Ltda" })).toBeInTheDocument();
  });
});


describe("AdminTable: largura do botão de expandir na coluna 0", () => {
  const cols = (width: string | undefined): AdminTableColumn<Row>[] => [{ ...COLUMNS[0], width }, COLUMNS[1]];
  const colsVarOf = (container: HTMLElement) => (container.querySelector(".adm-table") as HTMLElement).style.getPropertyValue("--adm-cols");
  const EXTRA = "(var(--adm-hit) - 2px)";

  it("largura fixa da coluna 0 ganha o botão sozinha", () => {
    const { container } = renderTable({ columns: cols("120px"), renderExpanded: () => <p>x</p> });
    expect(colsVarOf(container)).toBe(`calc(120px + ${EXTRA}) 90px`);
  });

  it("minmax: soma nos dois lados que são comprimento e deixa o fr", () => {
    const { container } = renderTable({ columns: cols("minmax(160px, 2fr)"), renderExpanded: () => <p>x</p> });
    expect(colsVarOf(container)).toBe(`minmax(calc(160px + ${EXTRA}), 2fr) 90px`);
  });

  it("minmax com calc dentro (vírgulas aninhadas) é cortado só na vírgula de fora", () => {
    const { container } = renderTable({ columns: cols("minmax(calc(100px + 2rem), 300px)"), renderExpanded: () => <p>x</p> });
    expect(colsVarOf(container)).toBe(`minmax(calc(calc(100px + 2rem) + ${EXTRA}), calc(300px + ${EXTRA})) 90px`);
  });

  it("trilhos flexíveis e de conteúdo ficam como estão (fr, padrão, auto, max-content)", () => {
    for (const width of ["2fr", undefined, "auto", "max-content", "minmax(0, 1fr)"]) {
      const { container, unmount } = renderTable({ columns: cols(width), renderExpanded: () => <p>x</p> });
      expect(colsVarOf(container)).toBe(`${width ?? "minmax(0, 1fr)"} 90px`);
      unmount();
    }
  });

  it("sem renderExpanded nada muda", () => {
    const { container } = renderTable({ columns: cols("120px") });
    expect(colsVarOf(container)).toBe("120px 90px");
  });

  it("só a coluna 0 é alargada, e as variáveis por breakpoint acompanham", () => {
    const { container } = renderTable({
      columns: [{ ...COLUMNS[0], width: "120px" }, { ...COLUMNS[1], width: "90px" }, COLUMNS[2]],
      renderExpanded: () => <p>x</p>,
    });
    const root = container.querySelector(".adm-table") as HTMLElement;
    expect(root.style.getPropertyValue("--adm-cols-md")).toBe(`calc(120px + ${EXTRA}) 90px`);
  });
});

describe("AdminTable: seletor 'Ordenar por' com sort_by desconhecido", () => {
  it("sort.by fora das colunas: o seletor fica neutro, sem opção errada selecionada e sem botão de inverter", () => {
    renderTable({ sort: { by: "inexistente", order: "asc" }, onSort: vi.fn() });
    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ordenar por", "Workspace", "Membros"]);
    expect(screen.queryByRole("button", { name: /Ordem (crescente|decrescente)/ })).not.toBeInTheDocument();
  });

  it("escolher uma coluna a partir do neutro chama onSort", () => {
    const onSort = vi.fn();
    renderTable({ sort: { by: "inexistente", order: "asc" }, onSort });
    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "members" } });
    expect(onSort).toHaveBeenCalledWith("members");
  });

  it("sort.by válido continua selecionado e com o botão de inverter", () => {
    renderTable({ sort: { by: "members", order: "desc" }, onSort: vi.fn() });
    expect((screen.getByLabelText("Ordenar por") as HTMLSelectElement).value).toBe("members");
    expect(screen.getByRole("button", { name: "Ordem decrescente: inverter" })).toBeInTheDocument();
  });

  it("sem sort.by o neutro segue sendo 'Padrão'", () => {
    renderTable({ sort: { order: "asc" }, onSort: vi.fn() });
    expect(within(screen.getByLabelText("Ordenar por")).getAllByRole("option")[0]).toHaveTextContent("Padrão");
  });
});
