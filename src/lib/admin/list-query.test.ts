import { describe, expect, it } from "vitest";

import {
  activeFilterKeys,
  createAdminListSearchValidator,
  readAdminListState,
  stateToApiQuery,
  stateToSearch,
  type AdminListStateConfig,
} from "./list-query";

const config = {
  filterKeys: ["status", "activity", "created_from"],
  defaultFilters: { status: "" },
  sortKeys: ["created_at", "name", "volume"],
  defaultSortBy: "created_at",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig<"status" | "activity" | "created_from">;

describe("readAdminListState", () => {
  it("sem nada na URL: página 1, 25 por página, ordenação e filtros padrão", () => {
    expect(readAdminListState({}, config)).toEqual({
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      order: "desc",
      filters: { status: "", activity: "", created_from: "" },
    });
  });

  it("lê o que o roteador entrega (números já parseados) e valida tudo", () => {
    const state = readAdminListState(
      { page: 3, per_page: 50, search: "  acme  ", sort_by: "name", order: "asc", status: "suspended", activity: "never" },
      config,
    );
    expect(state).toMatchObject({ page: 3, perPage: 50, search: "acme", sortBy: "name", order: "asc" });
    expect(state.filters).toEqual({ status: "suspended", activity: "never", created_from: "" });
  });

  it("a URL é entrada de usuário: valores inválidos voltam ao padrão", () => {
    const state = readAdminListState(
      { page: "abc", per_page: 7, sort_by: "senha_hash", order: "sideways", search: { x: 1 } },
      config,
    );
    expect(state.page).toBe(1);
    expect(state.perPage).toBe(25);
    expect(state.sortBy).toBe("created_at");
    expect(state.order).toBe("desc");
    expect(state.search).toBe("");
  });

  it("página negativa, zero ou decimal não passa", () => {
    expect(readAdminListState({ page: 0 }, config).page).toBe(1);
    expect(readAdminListState({ page: -2 }, config).page).toBe(1);
    expect(readAdminListState({ page: "2.5" }, config).page).toBe(1);
    expect(readAdminListState({ page: "4" }, config).page).toBe(4);
  });

  it("a busca é aparada e limitada a 100 caracteres (limite do contrato)", () => {
    expect(readAdminListState({ search: "x".repeat(300) }, config).search).toHaveLength(100);
    expect(readAdminListState({ search: "   " }, config).search).toBe("");
  });

  it("busca numérica (o roteador devolve número para '123') continua sendo texto", () => {
    expect(readAdminListState({ search: 12345678000199 }, config).search).toBe("12345678000199");
  });

  it("filtros aceitam CSV e o padrão preenche o que falta", () => {
    const state = readAdminListState({ status: "active,suspended" }, { ...config, defaultFilters: { status: "all" } });
    expect(state.filters.status).toBe("active,suspended");
    expect(readAdminListState({}, { ...config, defaultFilters: { status: "all" } }).filters.status).toBe("all");
  });

  it("prefixo separa várias listas na mesma tela", () => {
    const members = { ...config, prefix: "m_" };
    const state = readAdminListState({ m_page: 2, page: 9, m_search: "ana" }, members);
    expect(state.page).toBe(2);
    expect(state.search).toBe("ana");
  });
});

describe("stateToSearch (o que vai para a URL)", () => {
  it("valores padrão não vão para a URL", () => {
    expect(stateToSearch(readAdminListState({}, config), config)).toEqual({});
  });

  it("só o que foge do padrão", () => {
    const state = readAdminListState({ page: 2, per_page: 100, search: "acme", sort_by: "volume", order: "asc", status: "archived" }, config);
    expect(stateToSearch(state, config)).toEqual({
      page: 2,
      per_page: 100,
      search: "acme",
      sort_by: "volume",
      order: "asc",
      status: "archived",
    });
  });

  it("filtro igual ao padrão sai da URL", () => {
    const withDefault = { ...config, defaultFilters: { status: "all" } };
    const state = readAdminListState({ status: "all" }, withDefault);
    expect(stateToSearch(state, withDefault)).toEqual({});
  });
});

describe("stateToApiQuery (o que vai para a API)", () => {
  it("sempre manda page e per_page; sort_by e order só com ordenação", () => {
    const query = stateToApiQuery(readAdminListState({}, config), config);
    expect(query).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });

  it("manda busca e filtros ativos, com os nomes do contrato", () => {
    const state = readAdminListState({ search: "acme", status: "suspended", activity: "never", created_from: "2026-10-01", page: 2 }, config);
    expect(stateToApiQuery(state, config)).toEqual({
      page: 2,
      per_page: 25,
      search: "acme",
      sort_by: "created_at",
      order: "desc",
      status: "suspended",
      activity: "never",
      created_from: "2026-10-01",
    });
  });

  it("sem ordenação padrão, não manda sort_by", () => {
    const query = stateToApiQuery(readAdminListState({}, { filterKeys: ["status"] }), { filterKeys: ["status"] });
    expect(query).toEqual({ page: 1, per_page: 25 });
  });
});

describe("activeFilterKeys", () => {
  it("conta só filtros fora do padrão (não a busca, a página nem a ordenação)", () => {
    const state = readAdminListState({ search: "x", page: 3, sort_by: "name", status: "suspended", activity: "" }, config);
    expect(activeFilterKeys(state, config)).toEqual(["status"]);
    expect(activeFilterKeys(readAdminListState({}, config), config)).toEqual([]);
  });
});

describe("createAdminListSearchValidator (validateSearch da rota)", () => {
  const validate = createAdminListSearchValidator(config);

  it("devolve só os campos válidos e diferentes do padrão", () => {
    expect(validate({ page: "2", per_page: 25, status: "suspended", lixo: "x" })).toEqual({ page: 2, status: "suspended" });
    expect(validate({})).toEqual({});
  });

  it("descarta ordenação fora da lista branca", () => {
    expect(validate({ sort_by: "password_hash" })).toEqual({});
  });
});
