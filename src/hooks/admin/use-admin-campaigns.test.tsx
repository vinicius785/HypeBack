import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGet: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet };
});

import { adminKeys } from "./admin-query-keys";
import {
  ADMIN_CAMPAIGN_LIST_CONFIG,
  useAdminCampaign,
  useAdminCampaigns,
  validateAdminCampaignsSearch,
} from "./use-admin-campaigns";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const META = { page: 1, per_page: 25, total: 1, total_pages: 1 };

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
});

describe("validateAdminCampaignsSearch", () => {
  it("deixa passar o que a tela e o contrato entendem", () => {
    const raw = {
      page: "3",
      per_page: 50,
      search: "  café ",
      status: "published",
      payment_method: "fixed",
      workspace_id: "7a1e0000-0000-4000-8000-000000000002",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
      sort_by: "committed",
      order: "asc",
    };
    expect(validateAdminCampaignsSearch(raw)).toEqual({
      page: 3,
      per_page: 50,
      search: "café",
      status: "published",
      payment_method: "fixed",
      workspace_id: "7a1e0000-0000-4000-8000-000000000002",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
      sort_by: "committed",
      order: "asc",
    });
  });

  it("não escreve o que é o padrão (URL curta): página 1, 25 por página, criação decrescente", () => {
    expect(validateAdminCampaignsSearch({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" })).toEqual({});
  });

  it("tira o que o servidor recusaria ou que a tela não conseguiria mostrar", () => {
    expect(validateAdminCampaignsSearch({ status: "archived" })).toEqual({});
    // CSV é válido para a API, mas o controle segmentado não tem como mostrá-lo: sai, em vez de filtrar às escondidas.
    expect(validateAdminCampaignsSearch({ status: "draft,published" })).toEqual({});
    expect(validateAdminCampaignsSearch({ workspace_id: "não-é-uuid" })).toEqual({});
    expect(validateAdminCampaignsSearch({ created_from: "2026-02-31", created_to: "ontem" })).toEqual({});
    expect(validateAdminCampaignsSearch({ sort_by: "budget" })).toEqual({});
  });

  it("intervalo invertido: o fim acompanha o começo (como nos campos de data)", () => {
    expect(validateAdminCampaignsSearch({ created_from: "2026-10-20", created_to: "2026-10-01" })).toEqual({
      created_from: "2026-10-20",
      created_to: "2026-10-20",
    });
  });

  it("um código de pagamento que o app não conhece passa (o filtro mostra o que está valendo)", () => {
    expect(validateAdminCampaignsSearch({ payment_method: "to_be_agreed" })).toEqual({ payment_method: "to_be_agreed" });
  });

  it("a configuração usa as ordenações e os filtros do contrato", () => {
    expect(ADMIN_CAMPAIGN_LIST_CONFIG.filterKeys).toEqual(["status", "payment_method", "workspace_id", "created_from", "created_to"]);
    expect(ADMIN_CAMPAIGN_LIST_CONFIG.sortKeys).toEqual(["created_at", "title", "creators", "committed", "released"]);
  });
});

describe("useAdminCampaigns", () => {
  it("consulta GET /admin/campaigns com os parâmetros da lista e devolve { data, meta }", async () => {
    const result = { data: [{ id: "c1" }], meta: META };
    client.adminList.mockResolvedValue(result);
    const { wrapper } = setup();
    const params = { page: 2, per_page: 25, status: "draft", sort_by: "title", order: "asc" };

    const { result: hook } = renderHook(() => useAdminCampaigns(params), { wrapper });
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));

    expect(client.adminList).toHaveBeenCalledWith("/admin/campaigns", params, expect.objectContaining({ signal: expect.anything() }));
    expect(hook.current.data).toEqual(result);
  });

  it("a chave de cache é a de lista do recurso `campaigns` (invalidável por adminKeys.resource)", async () => {
    client.adminList.mockResolvedValue({ data: [], meta: { ...META, total: 0, total_pages: 0 } });
    const { wrapper, queryClient } = setup();
    const params = { page: 1, per_page: 25 };

    const { result } = renderHook(() => useAdminCampaigns(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryCache().find({ queryKey: adminKeys.list("campaigns", params) })).toBeDefined();
    expect(queryClient.getQueryCache().findAll({ queryKey: adminKeys.resource("campaigns") })).toHaveLength(1);
  });
});

describe("useAdminCampaign", () => {
  it("consulta GET /admin/campaigns/:id com o id escapado (um id estranho nunca vira outro caminho)", async () => {
    client.adminGet.mockResolvedValue({ id: "x" });
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCampaign("a/b?c"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.adminGet).toHaveBeenCalledWith("/admin/campaigns/a%2Fb%3Fc", undefined, expect.anything());
  });

  it("sem id nem consulta", () => {
    const { wrapper } = setup();
    renderHook(() => useAdminCampaign(""), { wrapper });
    expect(client.adminGet).not.toHaveBeenCalled();
  });
});
