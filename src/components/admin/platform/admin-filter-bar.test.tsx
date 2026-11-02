import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminFilterBar, AdminSegmentedControl, type AdminFilterDef, type AdminFilterOption } from "./admin-filter-bar";

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
