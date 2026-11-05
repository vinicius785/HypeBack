import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterButton, FilterChips, PageHeader, PageTabs, SearchInput, SortControl, ViewSwitcher } from "./page-kit";

describe("kit de página", () => {
  it("cabeçalho: título, subtítulo e ações", () => {
    render(<PageHeader title="Marcas" subtitle="Todas as marcas" actions={<button type="button">Nova marca</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Marcas" })).toBeInTheDocument();
    expect(screen.getByText("Todas as marcas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova marca" })).toBeInTheDocument();
  });

  it("abas: papel de tab, contagem e troca", () => {
    const onChange = vi.fn();
    render(<PageTabs ariaLabel="Seções" value="a" onChange={onChange} items={[{ id: "a", label: "Explorar", count: 3 }, { id: "b", label: "Listas" }]} />);
    const list = screen.getByRole("tablist", { name: "Seções" });
    expect(within(list).getByRole("tab", { name: /Explorar/ })).toHaveAttribute("aria-selected", "true");
    expect(within(list).getByText("3")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("tab", { name: "Listas" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("pesquisa: limpar só aparece com texto", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} placeholder="Buscar" label="Buscar tudo" />);
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
    rerender(<SearchInput value="ana" onChange={onChange} placeholder="Buscar" label="Buscar tudo" />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("filtro: o selo mostra quantos estão aplicados", () => {
    render(<FilterButton count={2}>Filtros</FilterButton>);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2");
    expect(screen.getByLabelText("2 filtros ativos")).toBeInTheDocument();
  });

  it("ordenação: menu com a opção atual marcada, fecha ao escolher e com Escape", () => {
    const onChange = vi.fn();
    render(<SortControl options={[["recent", "Mais recentes"], ["name", "Nome (A–Z)"]]} value="recent" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar: Mais recentes" }));
    expect(screen.getByRole("menuitemradio", { name: "Mais recentes" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nome (A–Z)" }));
    expect(onChange).toHaveBeenCalledWith("name");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ordenar/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("visualização: botões com nome e estado", () => {
    const onChange = vi.fn();
    render(<ViewSwitcher value="grid" onChange={onChange} options={[{ id: "grid", icon: "grid", label: "Cartões" }, { id: "list", icon: "list", label: "Lista" }]} />);
    expect(screen.getByRole("button", { name: "Cartões" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("chips: remover um a um, limpar tudo e sumir sem chips", () => {
    const remove = vi.fn();
    const clear = vi.fn();
    const { rerender } = render(<FilterChips chips={[{ id: "s", label: "Estado: Ativas", onRemove: remove }]} onClear={clear} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro: Estado: Ativas" }));
    expect(remove).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(clear).toHaveBeenCalled();
    rerender(<FilterChips chips={[]} onClear={clear} />);
    expect(screen.queryByRole("list", { name: "Filtros aplicados" })).toBeNull();
  });
});
