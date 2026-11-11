import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminFilterBar, AdminSegmentedControl, type AdminCustomFilter, type AdminFilterDef, type AdminFilterOption } from "./admin-filter-bar";
import { AdminSearchInput } from "./admin-search-input";

const STATUS: AdminFilterOption[] = [
  { value: "", label: "Todos", count: 120 },
  { value: "active", label: "Ativos", count: 90 },
  { value: "suspended", label: "Suspensos", count: 8 },
  { value: "archived", label: "Arquivados" },
];

const FILTERS: AdminFilterDef[] = [
  {
    kind: "select",
    key: "activity",
    label: "Atividade",
    options: [
      { value: "", label: "Todas" },
      { value: "active", label: "Com atividade" },
      { value: "never", label: "Nunca teve" },
    ],
  },
  {
    kind: "pills",
    key: "network",
    label: "Rede",
    options: [
      { value: "", label: "Todas" },
      { value: "instagram", label: "Instagram" },
      { value: "tiktok", label: "TikTok" },
    ],
  },
  { kind: "date-range", label: "Criado em", fromKey: "created_from", toKey: "created_to" },
];

function setup(values: Record<string, string> = {}, extra: Partial<React.ComponentProps<typeof AdminFilterBar>> = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  const onSegment = vi.fn();
  const view = render(
    <AdminFilterBar
      segment={{ ariaLabel: "Estado do workspace", options: STATUS, value: values.status ?? "", onChange: onSegment }}
      search={<input aria-label="busca" />}
      filters={FILTERS}
      values={values}
      onChange={onChange}
      onClear={onClear}
      {...extra}
    />,
  );
  return { ...view, onChange, onClear, onSegment, user: userEvent.setup() };
}

describe("AdminFilterBar", () => {
  it("segmentado de estado com contagens; o ativo fica marcado e o clique troca", async () => {
    const { user, onSegment } = setup({ status: "suspended" });
    const group = screen.getByRole("group", { name: "Estado do workspace" });
    const suspended = within(group).getByRole("button", { name: /Suspensos/ });
    expect(suspended).toHaveAttribute("aria-pressed", "true");
    expect(suspended).toHaveTextContent("8");
    expect(within(group).getByRole("button", { name: /Todos/ })).toHaveTextContent("120");
    expect(within(group).getByRole("button", { name: "Arquivados" })).toBeInTheDocument(); // sem contagem

    await user.click(within(group).getByRole("button", { name: /Ativos/ }));
    expect(onSegment).toHaveBeenCalledWith("active");
  });

  it("seletor: mostra a opção atual, troca e informa só a chave que mudou", async () => {
    const { user, onChange } = setup({ activity: "never" });
    const select = screen.getByRole("combobox", { name: "Atividade" });
    expect(select).toHaveValue("never");
    expect(screen.getAllByText("Nunca teve").length).toBeGreaterThan(0);

    await user.selectOptions(select, "active");
    expect(onChange).toHaveBeenCalledWith({ activity: "active" });
  });

  it("pílulas de escolha única", async () => {
    const { user, onChange } = setup({ network: "tiktok" });
    const group = screen.getByRole("group", { name: "Rede" });
    expect(within(group).getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(group).getByRole("button", { name: "Instagram" }));
    expect(onChange).toHaveBeenCalledWith({ network: "instagram" });
  });

  it("intervalo de datas: dois campos de data com nomes acessíveis", () => {
    setup({ created_from: "2026-10-01", created_to: "2026-10-31" });
    expect(screen.getByLabelText("Criado em: a partir de")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Criado em: até")).toHaveValue("2026-10-31");
  });

  it("data inicial passa a final: o limite final acompanha (nada de intervalo invertido)", () => {
    const { onChange } = setup({ created_from: "2026-10-01", created_to: "2026-10-10" });
    fireEvent.change(screen.getByLabelText("Criado em: a partir de"), { target: { value: "2026-10-20" } });
    expect(onChange).toHaveBeenCalledWith({ created_from: "2026-10-20", created_to: "2026-10-20" });
  });

  it("data final antes da inicial: o limite inicial acompanha", () => {
    const { onChange } = setup({ created_from: "2026-10-10", created_to: "2026-10-20" });
    fireEvent.change(screen.getByLabelText("Criado em: até"), { target: { value: "2026-10-05" } });
    expect(onChange).toHaveBeenCalledWith({ created_to: "2026-10-05", created_from: "2026-10-05" });
  });

  it("datas válidas mudam só o campo mexido; limpar o campo manda vazio", () => {
    const { onChange } = setup({ created_from: "2026-10-01" });
    fireEvent.change(screen.getByLabelText("Criado em: até"), { target: { value: "2026-10-31" } });
    expect(onChange).toHaveBeenLastCalledWith({ created_to: "2026-10-31" });
    fireEvent.change(screen.getByLabelText("Criado em: a partir de"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ created_from: "" });
  });

  it("os limites min/max dos campos de data impedem escolher um intervalo invertido pelo calendário", () => {
    setup({ created_from: "2026-10-01", created_to: "2026-10-31" });
    expect(screen.getByLabelText("Criado em: a partir de")).toHaveAttribute("max", "2026-10-31");
    expect(screen.getByLabelText("Criado em: até")).toHaveAttribute("min", "2026-10-01");
  });

  it("sem filtro ativo: nada de 'Limpar filtros', de chips nem de contador", () => {
    setup({});
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros" })).not.toHaveTextContent(/\d/);
  });

  it("filtros ativos viram chips; cada chip desfaz o seu e 'Limpar filtros' chama onClear", async () => {
    const { user, onChange, onClear } = setup({ activity: "never", network: "tiktok", created_from: "2026-10-01", created_to: "2026-10-31" });

    const chips = within(screen.getByRole("group", { name: "Filtros ativos" }));
    expect(chips.getByRole("button", { name: "Remover filtro Atividade: Nunca teve" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remover filtro Rede: TikTok" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remover filtro Criado em: 01/10/2026 – 31/10/2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("3");

    await user.click(chips.getByRole("button", { name: "Remover filtro Atividade: Nunca teve" }));
    expect(onChange).toHaveBeenLastCalledWith({ activity: "" });
    await user.click(chips.getByRole("button", { name: "Remover filtro Criado em: 01/10/2026 – 31/10/2026" }));
    expect(onChange).toHaveBeenLastCalledWith({ created_from: "", created_to: "" });

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("chip de data com um limite só diz de que lado", () => {
    setup({ created_from: "2026-10-01" });
    expect(screen.getByRole("button", { name: "Remover filtro Criado em: a partir de 01/10/2026" })).toBeInTheDocument();
  });

  it("o segmentado NÃO conta como filtro nem vira chip", () => {
    setup({ status: "suspended" });
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("valor igual ao padrão do filtro não conta como ativo", () => {
    const filters: AdminFilterDef[] = [
      { kind: "select", key: "kind", label: "Tipo", defaultValue: "brand", options: [{ value: "brand", label: "Marcas" }, { value: "all", label: "Todos" }] },
    ];
    const { rerender } = render(<AdminFilterBar filters={filters} values={{ kind: "brand" }} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    rerender(<AdminFilterBar filters={filters} values={{ kind: "all" }} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remover filtro Tipo: Todos" })).toBeInTheDocument();
  });

  it("chave ausente de `values` é o valor padrão do filtro (não vira chip vazio nem filtro ativo)", () => {
    const filters: AdminFilterDef[] = [
      { kind: "select", key: "kind", label: "Tipo", defaultValue: "brand", options: [{ value: "brand", label: "Marcas" }, { value: "all", label: "Todos" }] },
      { kind: "pills", key: "network", label: "Rede", defaultValue: "instagram", options: [{ value: "instagram", label: "Instagram" }, { value: "tiktok", label: "TikTok" }] },
    ];
    render(<AdminFilterBar filters={filters} values={{}} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    // O seletor mostra o padrão, e a pílula padrão aparece marcada.
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("brand");
    expect(screen.getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "true");
  });

  it("no celular os filtros ficam num painel que o botão 'Filtros' abre e fecha (estado e vínculo ARIA)", async () => {
    const { user, container } = setup();
    const toggle = screen.getByRole("button", { name: "Filtros" });
    const panel = container.querySelector(".adm-filters-panel") as HTMLElement;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", panel.id);
    expect(panel).not.toHaveAttribute("data-open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-open", "true");
  });

  it("slot de busca e ação à direita", () => {
    setup({}, { trailing: <button type="button">Exportar</button> });
    expect(screen.getByLabelText("busca")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
  });

  it("o segmentado funciona sozinho (período do dashboard)", async () => {
    const onChange = vi.fn();
    render(<AdminSegmentedControl ariaLabel="Período" options={[{ value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }]} value="30d" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "90 dias" }));
    expect(onChange).toHaveBeenCalledWith("90d");
  });
});

/** Filtro próprio de teste: um botão que "escolhe" um workspace (estado fora de `values`, como o seletor de workspace). */
function workspaceFilter(partial: Partial<AdminCustomFilter> = {}): AdminCustomFilter {
  return {
    kind: "custom",
    id: "workspace",
    label: "Workspace",
    summary: null,
    onClear: vi.fn(),
    render: ({ label, inline }) => (
      <button type="button" data-inline={inline ? "true" : "false"}>
        {label}: escolher
      </button>
    ),
    ...partial,
  };
}

function renderBar(props: Partial<React.ComponentProps<typeof AdminFilterBar>>) {
  const onChange = vi.fn();
  const view = render(<AdminFilterBar values={{}} onChange={onChange} {...props} />);
  return { ...view, onChange, user: userEvent.setup() };
}

describe("AdminFilterBar: filtro próprio (kind: 'custom')", () => {
  it("é desenhado dentro do painel 'Filtros' quando não é inline, e recebe o contexto", () => {
    const { container } = renderBar({ filters: [workspaceFilter()] });
    const panel = container.querySelector(".adm-filters-panel") as HTMLElement;
    const control = within(panel).getByRole("button", { name: "Workspace: escolher" });
    expect(control).toHaveAttribute("data-inline", "false");
    expect(container.querySelector(".adm-filters-inline")).toBeNull();
  });

  it("inline: aparece na linha da barra, fora do painel (visível sem abrir 'Filtros'), e o painel nem existe se só há inline", () => {
    const { container } = renderBar({ filters: [workspaceFilter({ inline: true })] });
    const inline = container.querySelector(".adm-filters-inline") as HTMLElement;
    expect(within(inline).getByRole("button", { name: "Workspace: escolher" })).toHaveAttribute("data-inline", "true");
    expect(container.querySelector(".adm-filters-panel")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument();
  });

  it("inativo (summary null): não conta, não vira chip e não oferece 'Limpar filtros'", () => {
    renderBar({ filters: [workspaceFilter()], onClear: vi.fn() });
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros" })).not.toHaveTextContent(/\d/);
  });

  it("ativo: conta em 'Filtros (n)' junto dos demais e vira chip com o texto de summary", () => {
    renderBar({ filters: [...FILTERS, workspaceFilter({ summary: "Workspace: Acme Ltda" })], values: { activity: "never" } });
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("2");
    const chips = within(screen.getByRole("group", { name: "Filtros ativos" }));
    expect(chips.getByRole("button", { name: "Remover filtro Workspace: Acme Ltda" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remover filtro Atividade: Nunca teve" })).toBeInTheDocument();
  });

  it("o chip do filtro próprio chama o onClear dele (e só o dele)", async () => {
    const filter = workspaceFilter({ summary: "Workspace: Acme", inline: true });
    const { user, onChange } = renderBar({ filters: [filter] });
    await user.click(screen.getByRole("button", { name: "Remover filtro Workspace: Acme" }));
    expect(filter.onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("'Limpar filtros' chama o onClear da barra e o de cada filtro próprio ativo (e não o dos inativos)", async () => {
    const active = workspaceFilter({ summary: "Workspace: Acme" });
    const idle = workspaceFilter({ id: "author", label: "Autor", summary: null });
    const onClear = vi.fn();
    const { user } = renderBar({ filters: [active, idle], onClear });
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(active.onClear).toHaveBeenCalledTimes(1);
    expect(idle.onClear).not.toHaveBeenCalled();
  });

  it("só com filtro próprio ativo e sem onClear da barra, 'Limpar filtros' ainda existe e o desfaz", async () => {
    const active = workspaceFilter({ summary: "Workspace: Acme" });
    const { user } = renderBar({ filters: [active] });
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(active.onClear).toHaveBeenCalledTimes(1);
  });

  it("filtro de seletor ativo sem onClear continua sem 'Limpar filtros' (comportamento de antes)", () => {
    renderBar({ filters: FILTERS, values: { activity: "never" } });
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("no painel, o filtro próprio segue a ordem do array junto dos seletores, e as pílulas ficam por último", () => {
    const { container } = renderBar({ filters: [FILTERS[1], workspaceFilter(), FILTERS[0]] });
    const panel = container.querySelector(".adm-filters-panel") as HTMLElement;
    const order = Array.from(panel.children).map((el) => (el.tagName === "BUTTON" ? "custom" : el.classList.contains("adm-select") ? "select" : "pills"));
    expect(order).toEqual(["custom", "select", "pills"]);
  });
});

describe("AdminFilterBar: filtro inline (select, pílulas e datas)", () => {
  const INLINE: AdminFilterDef[] = [
    { ...(FILTERS[0] as AdminFilterDef), inline: true } as AdminFilterDef,
    { kind: "pills", key: "network", label: "Rede", inline: true, options: [{ value: "", label: "Todas" }, { value: "tiktok", label: "TikTok" }] },
    { kind: "date-range", label: "Criado em", fromKey: "created_from", toKey: "created_to" },
  ];

  it("select e pílulas inline ficam fora do painel; os demais seguem nele", () => {
    const { container } = renderBar({ filters: INLINE });
    const inline = container.querySelector(".adm-filters-inline") as HTMLElement;
    const panel = container.querySelector(".adm-filters-panel") as HTMLElement;
    expect(within(inline).getByRole("combobox", { name: "Atividade" })).toBeInTheDocument();
    expect(within(inline).getByRole("group", { name: "Rede" })).toBeInTheDocument();
    expect(within(panel).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(panel).getByLabelText("Criado em: até")).toBeInTheDocument();
  });

  it("o inline troca e vira chip como qualquer filtro, e conta em 'Filtros (n)'", async () => {
    const { user, onChange } = renderBar({ filters: INLINE, values: { network: "tiktok" } });
    await user.selectOptions(screen.getByRole("combobox", { name: "Atividade" }), "never");
    expect(onChange).toHaveBeenCalledWith({ activity: "never" });
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Remover filtro Rede: TikTok" })).toBeInTheDocument();
  });

  it("só filtros inline: não há botão 'Filtros' nem painel (nada escondido para abrir)", () => {
    const { container } = renderBar({ filters: INLINE.slice(0, 2) });
    expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument();
    expect(container.querySelector(".adm-filters-panel")).toBeNull();
  });
});

describe("AdminFilterBar: busca, segmento e trailing", () => {
  it("searchLabel dá o nome acessível ao AdminSearchInput", () => {
    renderBar({ search: <AdminSearchInput value="" onSearch={vi.fn()} />, searchLabel: "Buscar workspaces" });
    expect(screen.getByRole("searchbox", { name: "Buscar workspaces" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Buscar" })).not.toBeInTheDocument();
  });

  it("sem searchLabel o AdminSearchInput segue com o nome dele (nada muda)", () => {
    renderBar({ search: <AdminSearchInput value="" onSearch={vi.fn()} label="Buscar criadores" /> });
    expect(screen.getByRole("searchbox", { name: "Buscar criadores" })).toBeInTheDocument();
  });

  it("outro elemento de busca é embrulhado numa região de busca com o nome pedido", () => {
    const { container } = renderBar({ search: <input aria-label="Autor" />, searchLabel: "Buscar autor" });
    const region = screen.getByRole("search", { name: "Buscar autor" });
    expect(within(region).getByLabelText("Autor")).toBeInTheDocument();
    expect(container.querySelector(".adm-filters-search")).toBe(region);
  });

  it("segmento: grupo nomeado, botões com aria-pressed e teclado (Enter e Espaço) trocam o valor", async () => {
    const onSegment = vi.fn();
    const user = userEvent.setup();
    render(
      <AdminFilterBar
        segment={{ ariaLabel: "Estado", options: STATUS, value: "", onChange: onSegment }}
        values={{}}
        onChange={vi.fn()}
      />,
    );
    const group = screen.getByRole("group", { name: "Estado" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);

    await user.tab();
    expect(buttons[0]).toHaveFocus();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSegment).toHaveBeenLastCalledWith("active");
    await user.tab();
    await user.keyboard(" ");
    expect(onSegment).toHaveBeenLastCalledWith("suspended");
  });

  it("trailing sozinho já abre a linha da barra (botão de atualizar sem busca nem filtros)", () => {
    const { container } = renderBar({ trailing: <button type="button">Atualizar</button> });
    expect(within(container.querySelector(".adm-filters-trail") as HTMLElement).getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
  });

  it("trailing vem depois de 'Limpar filtros'", () => {
    const { container } = renderBar({ filters: FILTERS, values: { activity: "never" }, onClear: vi.fn(), trailing: <button type="button">Atualizar</button> });
    const labels = Array.from((container.querySelector(".adm-filters-trail") as HTMLElement).querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Limpar filtros", "Atualizar"]);
  });
});

describe("AdminFilterBar: foco ao desfazer filtros pelo teclado", () => {
  function Stateful({ filters: initial }: { filters?: AdminFilterDef[] }) {
    const [values, setValues] = useState<Record<string, string>>({ activity: "never", network: "tiktok", created_from: "2026-10-01" });
    return (
      <AdminFilterBar
        search={<AdminSearchInput value="" onSearch={() => undefined} />}
        searchLabel="Buscar"
        filters={initial ?? FILTERS}
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        onClear={() => setValues({})}
      />
    );
  }

  it("remover um chip leva o foco para o chip que ocupou o lugar dele", async () => {
    const user = userEvent.setup();
    render(<Stateful />);
    const chips = screen.getByRole("group", { name: "Filtros ativos" });
    const first = within(chips).getByRole("button", { name: "Remover filtro Atividade: Nunca teve" });
    first.focus();
    await user.keyboard("{Enter}");
    expect(within(chips).queryByRole("button", { name: /Atividade/ })).not.toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: "Remover filtro Rede: TikTok" })).toHaveFocus();
  });

  it("remover o último chip leva o foco para o anterior", async () => {
    const user = userEvent.setup();
    render(<Stateful />);
    const chips = screen.getByRole("group", { name: "Filtros ativos" });
    const last = within(chips).getByRole("button", { name: /Remover filtro Criado em/ });
    last.focus();
    await user.keyboard(" ");
    expect(within(chips).getByRole("button", { name: "Remover filtro Rede: TikTok" })).toHaveFocus();
  });

  it("desfazer o último chip e 'Limpar filtros' levam o foco para a busca (não para o body)", async () => {
    const user = userEvent.setup();
    render(<Stateful />);
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar" })).toHaveFocus();
  });

  it("não rouba o foco de quem já foi para outro lugar enquanto a lista atualizava", async () => {
    const user = userEvent.setup();
    const search = <AdminSearchInput value="" onSearch={() => undefined} />;
    const filters = FILTERS.slice(0, 1);
    const { rerender } = render(
      <AdminFilterBar search={search} searchLabel="Buscar" filters={filters} values={{ activity: "never" }} onChange={vi.fn()} />,
    );
    // o chip é clicado, mas a resposta (a URL nova) só chega depois; nesse meio tempo a pessoa foi para a busca
    await user.click(screen.getByRole("button", { name: "Remover filtro Atividade: Nunca teve" }));
    screen.getByRole("searchbox", { name: "Buscar" }).focus();
    rerender(<AdminFilterBar search={search} searchLabel="Buscar" filters={filters} values={{}} onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: "Buscar" })).toHaveFocus();
  });

});


describe("AdminFilterBar: values/onChange opcionais", () => {
  it("só com segmento: renderiza e troca sem values nem onChange", async () => {
    const onSegment = vi.fn();
    render(<AdminFilterBar segment={{ ariaLabel: "Estado", options: STATUS, value: "", onChange: onSegment }} />);
    await userEvent.click(screen.getByRole("button", { name: /Ativos/ }));
    expect(onSegment).toHaveBeenCalledWith("active");
  });

  it("só com trailing e filtros de seletor: values ausente é {} e onChange ausente não quebra", async () => {
    render(<AdminFilterBar filters={[FILTERS[0]]} trailing={<button type="button">Exportar</button>} />);
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Atividade"), { target: { value: "never" } });
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });
});

describe("AdminFilterBar: segmentDefault", () => {
  const segment = (value: string, onChange = vi.fn()) => ({ ariaLabel: "Estado do workspace", options: STATUS, value, onChange });

  it("sem segmentDefault o segmento nunca conta (comportamento de antes)", () => {
    render(<AdminFilterBar segment={segment("suspended")} />);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("no valor padrão: não conta, não vira chip e não oferece 'Limpar filtros'", () => {
    render(<AdminFilterBar segment={segment("")} segmentDefault="" />);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("fora do padrão: 'Limpar filtros' e o chip aparecem, e os dois devolvem o segmento ao padrão", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdminFilterBar segment={segment("suspended", onChange)} segmentDefault="" />);
    const chips = screen.getByRole("group", { name: "Filtros ativos" });
    await user.click(within(chips).getByRole("button", { name: "Remover filtro Estado do workspace: Suspensos" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("conta em 'Filtros (n)' junto dos demais", () => {
    render(
      <AdminFilterBar segment={segment("suspended")} segmentDefault="" filters={FILTERS} values={{ activity: "never" }} />,
    );
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2");
  });

  it("'Limpar filtros' chama o onClear da barra e também devolve o segmento ao padrão", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<AdminFilterBar segment={segment("active", onChange)} segmentDefault="" onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("AdminFilterBar: filtro liga/desliga (kind: 'toggle')", () => {
  const toggle = (partial: Partial<Extract<AdminFilterDef, { kind: "toggle" }>> = {}): AdminFilterDef => ({
    kind: "toggle",
    id: "deleted",
    label: "Excluídos",
    active: false,
    onToggle: vi.fn(),
    ...partial,
  });

  it("é um botão adm-pill com aria-pressed; o clique chama onToggle", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderBar({ filters: [toggle({ onToggle })] });
    await user.click(screen.getByRole("button", { name: "Excluídos", pressed: false }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Excluídos" })).toHaveClass("adm-pill");
  });

  it("teclado: Enter e Espaço acionam o botão", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderBar({ filters: [toggle({ onToggle })] });
    screen.getByRole("button", { name: "Excluídos" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("inativo: não conta, não vira chip e não oferece 'Limpar filtros'", () => {
    renderBar({ filters: [toggle()] });
    expect(screen.getByRole("button", { name: "Excluídos" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("ativo: aria-pressed, conta em 'Filtros (n)' e vira chip com summary (ou o label)", () => {
    const { unmount } = renderBar({ filters: [toggle({ active: true, summary: "Mostrando excluídos" })] });
    expect(screen.getByRole("button", { name: "Excluídos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Remover filtro Mostrando excluídos" })).toBeInTheDocument();
    unmount();
    renderBar({ filters: [toggle({ active: true })] });
    expect(screen.getByRole("button", { name: "Remover filtro Excluídos" })).toBeInTheDocument();
  });

  it("o chip desfaz o toggle (onToggle) e o foco vai para um controle da barra", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderBar({ filters: [toggle({ active: true, onToggle })] });
    await user.click(screen.getByRole("button", { name: "Remover filtro Excluídos" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("'Limpar filtros' desfaz o toggle ativo mesmo sem onClear da barra, e ignora o inativo", async () => {
    const on = vi.fn();
    const off = vi.fn();
    const user = userEvent.setup();
    renderBar({ filters: [toggle({ active: true, onToggle: on }), toggle({ id: "x", label: "Outro", onToggle: off })] });
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(on).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });

  it("com onClear próprio, chip e 'Limpar filtros' usam o onClear (e não o onToggle)", async () => {
    const onToggle = vi.fn();
    const onClearToggle = vi.fn();
    const user = userEvent.setup();
    renderBar({ filters: [toggle({ active: true, onToggle, onClear: onClearToggle })] });
    await user.click(screen.getByRole("button", { name: "Remover filtro Excluídos" }));
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("inline fica na linha da barra, fora do painel; sem inline vai para o painel 'Filtros'", () => {
    const { container, unmount } = renderBar({ filters: [toggle({ inline: true })] });
    expect(container.querySelector(".adm-filters-inline")).toContainElement(screen.getByRole("button", { name: "Excluídos" }));
    expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument();
    unmount();
    const second = renderBar({ filters: [toggle()] });
    expect(second.container.querySelector(".adm-filters-panel")).toContainElement(screen.getByRole("button", { name: "Excluídos" }));
  });
});

describe("AdminFilterBar: barra compacta (compact)", () => {
  const compactFilters: AdminFilterDef[] = [FILTERS[0], { ...FILTERS[1], inline: true } as AdminFilterDef, FILTERS[2]];
  const compactBar = (props: Partial<React.ComponentProps<typeof AdminFilterBar>> = {}) =>
    renderBar({
      compact: true,
      segment: { ariaLabel: "Estado", options: STATUS, value: "", onChange: vi.fn() },
      search: <AdminSearchInput value="" onSearch={vi.fn()} />,
      searchLabel: "Buscar",
      beforeFilters: <button type="button">Ordenar</button>,
      filters: compactFilters,
      ...props,
    });

  it("a busca, o que vem antes dos filtros (ordenar) e o botão só-ícone de filtros ficam numa linha, ao lado do segmento", () => {
    const { container } = compactBar();
    const root = container.querySelector(".adm-filters") as HTMLElement;
    expect(root).toHaveAttribute("data-compact", "true");
    expect(root.querySelector(":scope > .seg")).not.toBeNull();
    const row = root.querySelector(":scope > .adm-filters-row") as HTMLElement;
    const kids = Array.from(row.children).map((el) => el.className || el.tagName);
    expect(within(row).getByRole("button", { name: "Ordenar" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(kids.length).toBeGreaterThanOrEqual(3);
  });

  it("todos os filtros (inline ou não) ficam dentro do painel, fechado até o botão abrir", async () => {
    const { user, container } = compactBar();
    const toggle = screen.getByRole("button", { name: "Filtros" });
    const panel = screen.getByRole("group", { name: "Filtros" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toHaveAttribute("data-open");
    expect(container.querySelector(".adm-filters-inline")).toBeNull();
    expect(within(panel).getByLabelText("Atividade")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Instagram" })).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("data-open", "true");
  });

  it("o botão diz quantos filtros estão ativos, no nome e no selo", () => {
    compactBar({ values: { activity: "never", network: "tiktok" } });
    const toggle = screen.getByRole("button", { name: "Filtros, 2 ativos" });
    expect(toggle).toHaveTextContent("2");
  });

  it("Escape e clique fora fecham o painel (o foco volta ao botão com Escape)", async () => {
    const { user } = compactBar();
    const toggle = screen.getByRole("button", { name: "Filtros" });
    await user.click(toggle);
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    await user.click(document.body);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("dentro do painel cada filtro tem o nome em cima, e 'Limpar' (com filtro ativo) fica no topo do painel", async () => {
    const onClear = vi.fn();
    const { user } = compactBar({ values: { activity: "never" }, onClear });
    const panel = screen.getByRole("group", { name: "Filtros" });
    const labels = Array.from(panel.querySelectorAll(".adm-filters-field-k")).map((el) => el.textContent);
    expect(labels).toEqual(["Atividade", "Criado em", "Rede"]);
    await user.click(within(panel).getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    // na barra compacta o "Limpar filtros" não fica solto ao lado dos ícones
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })).toHaveLength(1);
  });

  it("sem filtro ativo o painel não mostra 'Limpar'", () => {
    compactBar();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("sem `compact` nada disso muda: botão com texto 'Filtros' e filtros inline na linha", () => {
    const { container } = renderBar({ filters: [{ ...FILTERS[0], inline: true } as AdminFilterDef, FILTERS[2]] });
    expect(container.querySelector(".adm-filters")).not.toHaveAttribute("data-compact");
    expect(container.querySelector(".adm-filters-inline")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Filtros" })).toHaveTextContent("Filtros");
  });
});
