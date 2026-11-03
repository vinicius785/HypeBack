import { describe, expect, it } from "vitest";

import { readAdminListState, stateToApiQuery } from "@/lib/admin/list-query";

import {
  ASSIGNABLE_ROLES,
  availableActions,
  sanitizeWorkspaceListSearch,
  validateWorkspaceListSearch,
  WORKSPACE_ACTIVITY_OPTIONS,
  WORKSPACE_DELETED_STATUS,
  WORKSPACE_LIST_CONFIG,
  WORKSPACE_LIST_FILTERS,
  WORKSPACE_STATUS_OPTIONS,
} from "./workspace-constants";
import { canFor } from "./test-support";

describe("availableActions (o menu Ações segue `detail.can`)", () => {
  it("ativo: suspender, arquivar, excluir", () => {
    expect(availableActions(canFor("active"))).toEqual(["suspend", "archive", "delete"]);
  });

  it("suspenso: reativar, arquivar, excluir", () => {
    expect(availableActions(canFor("suspended"))).toEqual(["reactivate", "archive", "delete"]);
  });

  it("arquivado: desarquivar, excluir", () => {
    expect(availableActions(canFor("archived"))).toEqual(["unarchive", "delete"]);
  });

  it("excluído: só restaurar", () => {
    expect(availableActions(canFor("deleted"))).toEqual(["restore"]);
  });

  it("o que o servidor não permite não aparece, mesmo que o estado pareça permitir", () => {
    expect(availableActions({ ...canFor("active"), delete: false })).toEqual(["suspend", "archive"]);
  });
});

describe("papéis atribuíveis", () => {
  it("'Personalizado' fica de fora: o contrato do Admin não traz as permissões dele", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("custom");
    expect(ASSIGNABLE_ROLES).toContain("owner");
  });
});

describe("estado da lista na URL", () => {
  it("sem nada na URL, os padrões do servidor: nenhum filtro vai para a API, só a ordenação explícita", () => {
    const state = readAdminListState({}, WORKSPACE_LIST_CONFIG);
    expect(stateToApiQuery(state, WORKSPACE_LIST_CONFIG)).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(state.filters.kind).toBe("brand");
  });

  it("filtros fora do padrão vão para a API com os nomes do contrato", () => {
    const state = readAdminListState(
      { status: "suspended", activity: "never", kind: "all", created_from: "2026-10-01", created_to: "2026-10-31", sort_by: "volume", order: "asc", page: 3 },
      WORKSPACE_LIST_CONFIG,
    );
    expect(stateToApiQuery(state, WORKSPACE_LIST_CONFIG)).toEqual({
      page: 3,
      per_page: 25,
      sort_by: "volume",
      order: "asc",
      status: "suspended",
      activity: "never",
      kind: "all",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
    });
  });
});

describe("sanitizeWorkspaceListSearch (a barra de endereço é entrada de usuário)", () => {
  it("estado: CSV vale sem os itens inválidos; 'all' vence; sem nenhum válido sai", () => {
    expect(sanitizeWorkspaceListSearch({ status: "active,suspended" }).status).toBe("active,suspended");
    expect(sanitizeWorkspaceListSearch({ status: "active,bogus,active" }).status).toBe("active");
    expect(sanitizeWorkspaceListSearch({ status: "bogus" })).not.toHaveProperty("status");
    expect(sanitizeWorkspaceListSearch({ status: "active,all" }).status).toBe("all");
  });

  it("atividade e tipo desconhecidos saem", () => {
    expect(sanitizeWorkspaceListSearch({ activity: "dormant", kind: "enterprise" })).toEqual({});
    expect(sanitizeWorkspaceListSearch({ activity: "inactive", kind: "orphan" })).toEqual({ activity: "inactive", kind: "orphan" });
  });

  it("data que não existe sai", () => {
    expect(sanitizeWorkspaceListSearch({ created_from: "2026-02-30", created_to: "ontem" })).toEqual({});
    expect(sanitizeWorkspaceListSearch({ created_from: "2026-10-01" })).toEqual({ created_from: "2026-10-01" });
  });

  it("validateSearch completo: ordenação fora da lista branca cai no padrão e o padrão sai da URL", () => {
    expect(validateWorkspaceListSearch({ sort_by: "password", kind: "brand", status: "suspended" })).toEqual({ status: "suspended" });
  });
});

describe("WORKSPACE_STATUS_OPTIONS (segmento de estado)", () => {
  it("'Todos' é o padrão do servidor (sem o parâmetro) e não inclui os excluídos; Ativos, Suspensos e Arquivados mantêm os valores da URL", () => {
    const byValue = Object.fromEntries(WORKSPACE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
    expect(byValue).toEqual({ "": "Todos", active: "Ativos", suspended: "Suspensos", archived: "Arquivados" });
  });

  it("'Excluídos' é o quinto estado e sai do segmento: o valor da URL continua `deleted`", () => {
    expect(WORKSPACE_STATUS_OPTIONS.map((o) => o.value)).not.toContain(WORKSPACE_DELETED_STATUS);
    expect(WORKSPACE_DELETED_STATUS).toBe("deleted");
    expect(sanitizeWorkspaceListSearch({ status: "deleted" }).status).toBe("deleted");
  });
});

describe("WORKSPACE_LIST_FILTERS (vocabulário dos filtros)", () => {
  it("'Atividade' virou 'Uso recente' com os mesmos valores de URL, e as respostas não repetem 'Ativos'", () => {
    const filter = WORKSPACE_LIST_FILTERS.find((f) => f.kind === "select" && f.key === "activity");
    expect(filter).toMatchObject({ label: "Uso recente" });
    expect(WORKSPACE_ACTIVITY_OPTIONS.map((o) => o.value)).toEqual(["", "active", "inactive", "never"]);
    expect(WORKSPACE_ACTIVITY_OPTIONS.map((o) => o.label)).not.toContain("Ativos");
  });
});
