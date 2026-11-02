import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => router.search,
  useNavigate: () => router.navigate,
}));

import type { AdminListStateConfig } from "@/lib/admin/list-query";

import { useAdminListQueryState, useAdminPageClamp } from "./use-admin-list-query-state";

const config = {
  filterKeys: ["status", "activity"],
  sortKeys: ["created_at", "name", "volume"],
  defaultSortBy: "created_at",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig<"status" | "activity">;

type NavigateArg = {
  to: string;
  replace: boolean;
  resetScroll: boolean;
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
};

/** Aplica a última navegação sobre a busca "de antes" e devolve o novo objeto de busca. */
function lastNavigation(prev: Record<string, unknown>) {
  const arg = router.navigate.mock.calls.at(-1)?.[0] as NavigateArg;
  return { replace: arg.replace, to: arg.to, resetScroll: arg.resetScroll, search: arg.search(prev) };
}

beforeEach(() => {
  router.navigate.mockReset();
  router.search = {};
});

describe("useAdminListQueryState", () => {
  it("lê página, busca, filtros e ordenação da URL e monta os parâmetros da API", () => {
    router.search = { page: 3, search: "acme", status: "suspended", sort_by: "volume", order: "asc" };
    const { result } = renderHook(() => useAdminListQueryState(config));

    expect(result.current.page).toBe(3);
    expect(result.current.search).toBe("acme");
    expect(result.current.filters).toEqual({ status: "suspended", activity: "" });
    expect(result.current.activeFilters).toEqual(["status"]);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.params).toEqual({
      page: 3,
      per_page: 25,
      search: "acme",
      sort_by: "volume",
      order: "asc",
      status: "suspended",
    });
  });

  it("os parâmetros ficam estáveis entre renders (não refaz a consulta à toa)", () => {
    router.search = { page: 2 };
    const { result, rerender } = renderHook(() => useAdminListQueryState({ ...config }));
    const first = result.current.params;
    rerender();
    expect(result.current.params).toBe(first);
  });

  it("trocar de página entra no histórico (push) e mantém o resto da URL", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setPage(4);

    const nav = lastNavigation({ status: "active", tab: "members" });
    expect(nav.replace).toBe(false);
    expect(nav.to).toBe(".");
    expect(nav.resetScroll).toBe(false);
    expect(nav.search).toEqual({ status: "active", tab: "members", page: 4 });
  });

  it("buscar substitui a entrada (replace) e volta para a página 1", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setSearch("  acme ");

    const nav = lastNavigation({ page: 5, status: "active" });
    expect(nav.replace).toBe(true);
    expect(nav.search).toEqual({ status: "active", search: "acme" });
    expect(nav.search).not.toHaveProperty("page");
  });

  it("mudar filtro volta para a página 1 e preserva chaves que não são da lista (aba)", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setFilter("status", "suspended");

    const nav = lastNavigation({ page: 3, tab: "resumo", search: "acme" });
    expect(nav.replace).toBe(true);
    expect(nav.search).toEqual({ tab: "resumo", search: "acme", status: "suspended" });
  });

  it("vários filtros de uma vez (intervalo de datas) saem num só salto", () => {
    const { result } = renderHook(() =>
      useAdminListQueryState({ filterKeys: ["created_from", "created_to"] } as const satisfies AdminListStateConfig<"created_from" | "created_to">),
    );
    result.current.setFilters({ created_from: "2026-10-01", created_to: "2026-10-31" });

    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(lastNavigation({ page: 2 }).search).toEqual({ created_from: "2026-10-01", created_to: "2026-10-31" });
  });

  it("filtro vazio sai da URL", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setFilter("status", "");
    expect(lastNavigation({ status: "suspended", page: 2 }).search).toEqual({});
  });

  it("duas mudanças seguidas não se atropelam: cada uma parte da URL de agora", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setFilter("status", "suspended");
    result.current.setFilter("activity", "never");

    const [first, second] = router.navigate.mock.calls.map((c) => c[0] as NavigateArg);
    const afterFirst = first.search({});
    expect(second.search(afterFirst)).toEqual({ status: "suspended", activity: "never" });
  });

  it("ordenar: coluna nova começa em asc (ou na ordem pedida); a mesma coluna alterna", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));

    result.current.toggleSort("name");
    expect(lastNavigation({}).search).toEqual({ sort_by: "name", order: "asc" });

    result.current.toggleSort("volume", "desc");
    expect(lastNavigation({}).search).toEqual({ sort_by: "volume" }); // desc é o padrão da lista: sai da URL

    result.current.toggleSort("name");
    expect(lastNavigation({ sort_by: "name", order: "asc" }).search).toEqual({ sort_by: "name" });
    expect(lastNavigation({ sort_by: "name", order: "desc" }).search).toEqual({ sort_by: "name", order: "asc" });
  });

  it("trocar a ordenação volta para a página 1", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setSort("name", "asc");
    expect(lastNavigation({ page: 4 }).search).not.toHaveProperty("page");
  });

  it("'Limpar filtros' zera os filtros e a página, mas mantém a busca digitada", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.clearFilters();
    expect(lastNavigation({ status: "suspended", activity: "never", search: "acme", page: 3, sort_by: "name" }).search).toEqual({
      search: "acme",
      sort_by: "name",
    });
  });

  it("reset volta tudo ao padrão", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.reset();
    expect(lastNavigation({ status: "suspended", search: "acme", page: 3, sort_by: "name", tab: "x" }).search).toEqual({ tab: "x" });
  });

  it("tamanho da página muda e volta para a página 1", () => {
    const { result } = renderHook(() => useAdminListQueryState(config));
    result.current.setPerPage(50);
    expect(lastNavigation({ page: 3 }).search).toEqual({ per_page: 50 });
  });

  it("prefixo: duas listas na mesma tela não se misturam", () => {
    router.search = { m_page: 2, c_page: 7 };
    const { result } = renderHook(() => useAdminListQueryState({ prefix: "m_" }));
    expect(result.current.page).toBe(2);
    result.current.setSearch("ana");
    expect(lastNavigation({ m_page: 2, c_page: 7 }).search).toEqual({ c_page: 7, m_search: "ana" });
  });
});

describe("useAdminPageClamp", () => {
  it("volta para a última página quando a atual passou do fim", () => {
    const setPage = vi.fn();
    renderHook(() => useAdminPageClamp(9, 3, setPage));
    expect(setPage).toHaveBeenCalledWith(3, { replace: true });
  });

  it("a correção troca a entrada do histórico (replace) em vez de empilhar: o Voltar não fica preso", () => {
    router.search = { page: 9 };
    const { result } = renderHook(() => {
      const state = useAdminListQueryState(config);
      useAdminPageClamp(state.page, 3, state.setPage);
      return state;
    });
    expect(result.current.page).toBe(9);
    const arg = router.navigate.mock.calls.at(-1)?.[0] as NavigateArg;
    expect(arg.replace).toBe(true);
    expect(arg.search({ page: 9 })).toMatchObject({ page: 3 });
  });

  it("não mexe quando a página existe, quando a lista está vazia ou antes da resposta", () => {
    const setPage = vi.fn();
    renderHook(() => useAdminPageClamp(2, 3, setPage));
    renderHook(() => useAdminPageClamp(5, 0, setPage));
    renderHook(() => useAdminPageClamp(5, undefined, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
