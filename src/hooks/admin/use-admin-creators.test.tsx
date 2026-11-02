import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGetEnvelope: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGetEnvelope: client.adminGetEnvelope };
});

import { AdminApiError } from "@/lib/admin/admin-client";

import { adminKeys } from "./admin-query-keys";
import {
  ADMIN_CREATOR_NETWORKS,
  parseAdminCreatorsTab,
  useAdminCreatorDuplicates,
  useAdminCreatorInconsistencies,
  useAdminCreators,
  validateAdminCreatorsSearch,
} from "./use-admin-creators";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const META = { page: 1, per_page: 25, total: 1, total_pages: 1 };

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGetEnvelope.mockReset();
});

describe("parseAdminCreatorsTab", () => {
  it("só `duplicates` e `inconsistencies` mudam a aba; qualquer outra coisa é a de criadores", () => {
    expect(parseAdminCreatorsTab("duplicates")).toBe("duplicates");
    expect(parseAdminCreatorsTab("inconsistencies")).toBe("inconsistencies");
    expect(parseAdminCreatorsTab("creators")).toBe("creators");
    expect(parseAdminCreatorsTab("outra")).toBe("creators");
    expect(parseAdminCreatorsTab(undefined)).toBe("creators");
  });
});

describe("validateAdminCreatorsSearch: aba de criadores", () => {
  it("deixa passar os filtros do contrato e não escreve `tab`", () => {
    const search = validateAdminCreatorsSearch({
      page: "2",
      search: " ana ",
      network: "tiktok",
      registration: "incomplete",
      min_followers: "10000",
      created_from: "2026-01-01",
      created_to: "2026-10-31",
      sort_by: "followers",
      order: "asc",
    });
    expect(search).toEqual({
      page: 2,
      search: "ana",
      network: "tiktok",
      registration: "incomplete",
      min_followers: "10000",
      created_from: "2026-01-01",
      created_to: "2026-10-31",
      sort_by: "followers",
      order: "asc",
    });
    expect(search).not.toHaveProperty("tab");
  });

  it("UGC não é rede social: `network=ugc` (e qualquer rede fora das quatro) sai da busca", () => {
    expect(ADMIN_CREATOR_NETWORKS).not.toContain("ugc");
    expect(validateAdminCreatorsSearch({ network: "ugc" })).toEqual({});
    expect(validateAdminCreatorsSearch({ network: "twitter" })).toEqual({});
    expect(validateAdminCreatorsSearch({ network: "instagram_facebook" })).toEqual({ network: "instagram_facebook" });
  });

  it("tira cadastro, seguidores e datas que o servidor recusaria", () => {
    expect(validateAdminCreatorsSearch({ registration: "all" })).toEqual({});
    expect(validateAdminCreatorsSearch({ registration: "stub" })).toEqual({ registration: "stub" });
    expect(validateAdminCreatorsSearch({ min_followers: "-5" })).toEqual({});
    expect(validateAdminCreatorsSearch({ min_followers: "abc" })).toEqual({});
    expect(validateAdminCreatorsSearch({ min_followers: "0" })).toEqual({});
    expect(validateAdminCreatorsSearch({ min_followers: "99999999999" })).toEqual({});
    expect(validateAdminCreatorsSearch({ min_followers: "007" })).toEqual({ min_followers: "7" });
    expect(validateAdminCreatorsSearch({ created_from: "31/10/2026" })).toEqual({});
    expect(validateAdminCreatorsSearch({ sort_by: "email" })).toEqual({});
  });

  it("intervalo invertido: o fim acompanha o começo", () => {
    expect(validateAdminCreatorsSearch({ created_from: "2026-10-20", created_to: "2026-01-01" })).toEqual({
      created_from: "2026-10-20",
      created_to: "2026-10-20",
    });
  });

  it("não leva os parâmetros das outras abas", () => {
    expect(validateAdminCreatorsSearch({ reason: "email", confidence: "high" })).toEqual({});
  });
});

describe("validateAdminCreatorsSearch: aba de duplicados", () => {
  it("leva a aba, o motivo, a confiança e a página, e só isso", () => {
    expect(
      validateAdminCreatorsSearch({
        tab: "duplicates",
        reason: "phone",
        confidence: "possible",
        page: 2,
        per_page: 25,
        // são da aba de criadores: não passam
        network: "tiktok",
        registration: "complete",
        sort_by: "name",
      }),
    ).toEqual({ tab: "duplicates", reason: "phone", confidence: "possible", page: 2, per_page: 25 });
  });

  it("motivo e confiança fora do contrato saem; 10 por página é o padrão da aba (não vai para a URL)", () => {
    expect(validateAdminCreatorsSearch({ tab: "duplicates", reason: "nome", confidence: "baixa" })).toEqual({ tab: "duplicates" });
    expect(validateAdminCreatorsSearch({ tab: "duplicates", per_page: 10 })).toEqual({ tab: "duplicates" });
    // 100 não é uma opção desta aba (10, 25, 50): volta ao padrão
    expect(validateAdminCreatorsSearch({ tab: "duplicates", per_page: 100 })).toEqual({ tab: "duplicates" });
  });
});

describe("validateAdminCreatorsSearch: aba de inconsistências", () => {
  it("só a aba (a lista não tem filtro nem página)", () => {
    expect(validateAdminCreatorsSearch({ tab: "inconsistencies", page: 3, search: "x", reason: "email" })).toEqual({
      tab: "inconsistencies",
    });
  });
});

describe("useAdminCreators / useAdminCreatorDuplicates", () => {
  it("consultam GET /admin/creators e GET /admin/creators/duplicates com os parâmetros da lista", async () => {
    client.adminList.mockResolvedValue({ data: [], meta: { ...META, total: 0, total_pages: 0 } });
    const { wrapper } = setup();
    const creatorParams = { page: 1, per_page: 25, network: "tiktok", sort_by: "followers", order: "desc" };
    const dupParams = { page: 2, per_page: 10, reason: "email" };

    const first = renderHook(() => useAdminCreators(creatorParams), { wrapper });
    const second = renderHook(() => useAdminCreatorDuplicates(dupParams), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess && second.result.current.isSuccess).toBe(true));

    expect(client.adminList).toHaveBeenCalledWith("/admin/creators", creatorParams, expect.anything());
    expect(client.adminList).toHaveBeenCalledWith("/admin/creators/duplicates", dupParams, expect.anything());
  });

  it("as duas listas têm chaves de cache diferentes mesmo com os mesmos parâmetros", async () => {
    client.adminList.mockResolvedValue({ data: [], meta: { ...META, total: 0, total_pages: 0 } });
    const { wrapper, queryClient } = setup();
    const params = { page: 1, per_page: 10 };

    renderHook(() => useAdminCreators(params), { wrapper });
    renderHook(() => useAdminCreatorDuplicates(params), { wrapper });
    await waitFor(() => expect(client.adminList).toHaveBeenCalledTimes(2));

    expect(queryClient.getQueryCache().find({ queryKey: adminKeys.list("creators", params) })).toBeDefined();
    expect(queryClient.getQueryCache().find({ queryKey: adminKeys.list("creators", params, ["duplicates"]) })).toBeDefined();
    expect(queryClient.getQueryCache().findAll({ queryKey: adminKeys.resource("creators") })).toHaveLength(2);
  });
});

describe("useAdminCreatorInconsistencies", () => {
  it("consulta GET /admin/creators/inconsistencies e guarda o `computed_at` junto da lista", async () => {
    client.adminGetEnvelope.mockResolvedValue({ data: [{ code: "X" }], meta: { computed_at: "2026-10-31T15:00:00.000Z" } });
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCreatorInconsistencies(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.adminGetEnvelope).toHaveBeenCalledWith("/admin/creators/inconsistencies", undefined, expect.anything());
    expect(result.current.data).toEqual({ items: [{ code: "X" }], computedAt: "2026-10-31T15:00:00.000Z" });
  });

  it("sem `meta` o horário fica nulo (a tela não o mostra)", async () => {
    client.adminGetEnvelope.mockResolvedValue({ data: [], meta: undefined });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminCreatorInconsistencies(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [], computedAt: null });
  });

  it("resposta que não é uma lista é erro de formato (não vira lista vazia)", async () => {
    client.adminGetEnvelope.mockResolvedValue({ data: { code: "X" }, meta: undefined });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminCreatorInconsistencies(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AdminApiError);
    expect(result.current.error).toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("não repete 4xx: a rota que o servidor ainda não tem falha uma vez só", async () => {
    client.adminGetEnvelope.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "x" }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminCreatorInconsistencies(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.adminGetEnvelope).toHaveBeenCalledTimes(1);
  });
});
