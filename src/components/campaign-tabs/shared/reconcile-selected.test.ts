import { describe, it, expect } from "vitest";
import { reconcileSelectedById } from "./reconcile-selected";

interface Item {
  id: string;
  status: string;
  counter?: number | null;
}

describe("reconcileSelectedById", () => {
  // Este é o teste que teria pego o bug: após uma contraproposta, a lista
  // refetchada traz o status/valores novos, mas o modal mantinha o snapshot.
  it("retorna a versão fresca (valores atualizados) quando o id casa", () => {
    const prev: Item = { id: "1", status: "price_countered", counter: 5000 };
    const list: Item[] = [
      { id: "1", status: "price_proposed", counter: null },
      { id: "2", status: "applications" },
    ];
    const result = reconcileSelectedById(prev, list);
    expect(result).toBe(list[0]);
    expect(result?.status).toBe("price_proposed");
    expect(result?.counter).toBeNull();
  });

  it("mantém o snapshot atual quando o item some da lista (refetch em voo)", () => {
    const prev: Item = { id: "9", status: "price_countered" };
    const list: Item[] = [{ id: "1", status: "applications" }];
    expect(reconcileSelectedById(prev, list)).toBe(prev);
  });

  it("mantém o snapshot quando a lista está vazia", () => {
    const prev: Item = { id: "1", status: "price_proposed" };
    expect(reconcileSelectedById(prev, [])).toBe(prev);
  });

  it("retorna null quando não há seleção", () => {
    expect(reconcileSelectedById<Item>(null, [{ id: "1", status: "x" }])).toBeNull();
  });

  it("casa ids numéricos", () => {
    const prev = { id: 2, status: "old" };
    const list = [
      { id: 1, status: "a" },
      { id: 2, status: "new" },
    ];
    expect(reconcileSelectedById(prev, list)?.status).toBe("new");
  });
});
