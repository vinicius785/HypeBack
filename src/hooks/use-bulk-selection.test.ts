import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBulkSelection } from "./use-bulk-selection";

describe("useBulkSelection", () => {
  const items = ["a", "b", "c"];

  it("inicia sem itens selecionados", () => {
    const { result } = renderHook(() => useBulkSelection(items));
    expect(result.current.selected.size).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("toggle seleciona e desseleciona um item", () => {
    const { result } = renderHook(() => useBulkSelection(items));

    act(() => result.current.toggle("a"));
    expect(result.current.selected.has("a")).toBe(true);
    expect(result.current.isSelected("a")).toBe(true);

    act(() => result.current.toggle("a"));
    expect(result.current.selected.has("a")).toBe(false);
  });

  it("toggleAll seleciona todos quando nenhum está selecionado", () => {
    const { result } = renderHook(() => useBulkSelection(items));

    act(() => result.current.toggleAll());
    expect(result.current.selected.size).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("toggleAll desseleciona todos quando todos estão selecionados", () => {
    const { result } = renderHook(() => useBulkSelection(items));

    act(() => result.current.toggleAll()); // seleciona todos
    act(() => result.current.toggleAll()); // desseleciona todos
    expect(result.current.selected.size).toBe(0);
  });

  it("clear esvazia a seleção", () => {
    const { result } = renderHook(() => useBulkSelection(items));

    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });

  it("isAllSelected é false com lista vazia", () => {
    const { result } = renderHook(() => useBulkSelection([]));
    expect(result.current.isAllSelected).toBe(false);
  });
});
