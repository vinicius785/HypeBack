/**
 * Ligação das rotas de Usuários: o id de cada rota, o `validateSearch` (o que a URL pode carregar) e a tela de
 * cada uma. Fica em `src/test` e não ao lado das rotas: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: (id: string) => (options: Record<string, unknown>) => ({
      id,
      options,
      useParams: () => ({ userId: "9" }),
    }),
  };
});

import { Outlet } from "@tanstack/react-router";

import { AdminUserDetailScreen, validateAdminUserSearch } from "@/components/admin/users/admin-user-detail";
import { AdminUsersList } from "@/components/admin/users/admin-users-list";
import { Route as DetailRoute } from "@/screens/(private)/(admin)/admin.users.$userId";
import { Route as IndexRoute } from "@/screens/(private)/(admin)/admin.users.index";
import { Route as LayoutRoute } from "@/screens/(private)/(admin)/admin.users";

type MockRoute = {
  id: string;
  options: { component: unknown; validateSearch?: (raw: Record<string, unknown>) => Record<string, unknown> };
};

const layout = LayoutRoute as unknown as MockRoute;
const index = IndexRoute as unknown as MockRoute;
const detail = DetailRoute as unknown as MockRoute;

describe("rotas de Usuários", () => {
  it("os ids são os que o gerador de rotas espera (a árvore de rotas não muda)", () => {
    expect(layout.id).toBe("/(private)/(admin)/admin/users");
    expect(index.id).toBe("/(private)/(admin)/admin/users/");
    expect(detail.id).toBe("/(private)/(admin)/admin/users/$userId");
  });

  it("o layout é só um Outlet", () => {
    expect(layout.options.component).toBe(Outlet);
  });

  it("a lista é a tela da lista", () => {
    expect(index.options.component).toBe(AdminUsersList);
  });

  it("o detalhe é a tela do detalhe e valida a aba da URL", () => {
    expect(typeof detail.options.component).toBe("function");
    expect(detail.options.validateSearch).toBe(validateAdminUserSearch);
    expect(AdminUserDetailScreen).toBeTypeOf("function");
  });
});

describe("URL da lista (validateSearch)", () => {
  const validate = (raw: Record<string, unknown>) => (index.options.validateSearch as (r: Record<string, unknown>) => Record<string, unknown>)(raw);

  it("o que não mexe no padrão não aparece na URL", () => {
    expect(validate({})).toEqual({});
    expect(validate({ status: "active,suspended", sort_by: "created_at", order: "desc", page: 1, per_page: 25 })).toEqual({});
  });

  it("filtros, busca, ordenação e página, com os nomes do contrato (e números como números)", () => {
    expect(
      validate({
        status: "suspended",
          workspace_id: "7a1e0000-0000-4000-8000-000000000002",
        created_from: "2026-10-01",
        created_to: "2026-10-31",
        search: "  ana  ",
        sort_by: "last_session",
        order: "asc",
        page: "3",
        per_page: "50",
      }),
    ).toEqual({
      status: "suspended",
      workspace_id: "7a1e0000-0000-4000-8000-000000000002",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
      search: "ana",
      sort_by: "last_session",
      order: "asc",
      page: 3,
      per_page: 50,
    });
  });

  it("a barra de endereço é entrada de usuário: ordenação fora do contrato, página inválida e tamanho estranho caem no padrão", () => {
    expect(validate({ sort_by: "password", page: "abc", per_page: "7", order: "sideways" })).toEqual({});
  });

  it("chaves que não são da lista (por exemplo `tab`) não passam", () => {
    expect(validate({ tab: "sessions", lixo: "x" })).toEqual({});
  });
});
