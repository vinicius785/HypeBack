import { describe, expect, it } from "vitest";

import { readAdminListState, stateToApiQuery, stateToSearch } from "@/lib/admin/list-query";

import {
  ADMIN_USERS_KIND_OPTIONS,
  ADMIN_USERS_LIST_CONFIG,
  ADMIN_USERS_STATUS_OPTIONS,
} from "./admin-users-config";
import { DAY, HOUR, NOW, NOW_ISO, ago } from "./admin-users-test-data";
import {
  LAST_SESSION_EXPLANATION,
  approxSessionText,
  formatPhone,
  formatTimeOfDay,
  sessionClientText,
  userKindText,
  workspaceRoleText,
} from "./admin-users-format";

describe("vocabulário", () => {
  it("tipo da conta nas palavras do produto; tipo novo do backend aparece como veio", () => {
    expect(userKindText("brand")).toBe("Marca");
    expect(userKindText("agency")).toBe("Agência");
    expect(userKindText("admin")).toBe("Administrador");
    expect(userKindText("creator")).toBe("Criador");
    expect(userKindText("support")).toBe("support");
  });

  it("papel no workspace pelo vocabulário do kit; papel novo aparece como veio", () => {
    expect(workspaceRoleText("owner")).toBe("Proprietário");
    expect(workspaceRoleText("financeiro")).toBe("Financeiro");
    expect(workspaceRoleText("estagiario")).toBe("estagiario");
  });

  it("onde a sessão está aberta: backoffice e app; valor novo aparece como veio", () => {
    expect(sessionClientText("backoffice")).toBe("Backoffice (navegador)");
    expect(sessionClientText("mobile-app")).toBe("App (celular)");
    expect(sessionClientText("tv")).toBe("tv");
  });
});

describe("approxSessionText (última sessão da lista)", () => {
  it("sempre diz 'aprox.' antes do tempo", () => {
    expect(approxSessionText(ago(3 * HOUR), NOW)?.text).toBe("aprox. há 3 horas");
  });

  it("agora, ontem e depois de 30 dias a data", () => {
    expect(approxSessionText(ago(5_000), NOW)?.text).toBe("aprox. agora");
    expect(approxSessionText(ago(DAY), NOW)?.text).toBe("aprox. ontem");
    expect(approxSessionText(ago(40 * DAY), NOW)?.text).toBe("aprox. 21/09/2026");
  });

  it("sem sessão (ou data inválida): nada, para a tela mostrar '—'", () => {
    expect(approxSessionText(null, NOW)).toBeNull();
    expect(approxSessionText(undefined, NOW)).toBeNull();
    expect(approxSessionText("não é data", NOW)).toBeNull();
  });

  it("a explicação fala da margem, da sessão aberta e de sumir ao sair", () => {
    expect(LAST_SESSION_EXPLANATION).toMatch(/±5 minutos/);
    expect(LAST_SESSION_EXPLANATION).toMatch(/sessão ainda aberta/);
    expect(LAST_SESSION_EXPLANATION).toMatch(/sai do app/);
  });
});

describe("formatPhone", () => {
  it("celular e fixo com DDD", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("1133445566")).toBe("(11) 3344-5566");
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("com o código do país", () => {
    expect(formatPhone("+5511987654321")).toBe("+55 (11) 98765-4321");
    expect(formatPhone("551133445566")).toBe("+55 (11) 3344-5566");
  });

  it("formato desconhecido aparece como veio; vazio vira null", () => {
    expect(formatPhone("+1 415 555 0100")).toBe("+1 415 555 0100");
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("")).toBeNull();
    expect(formatPhone("   ")).toBeNull();
    expect(formatPhone(null)).toBeNull();
  });
});

describe("configuração da lista", () => {
  it("o padrão da tela é o padrão da API: sem mexer, nada vai para a URL nem para a consulta", () => {
    const state = readAdminListState({}, ADMIN_USERS_LIST_CONFIG);
    expect(state.filters.status).toBe("active,suspended");
    expect(state.filters.kind).toBe("brand");
    expect(stateToSearch(state, ADMIN_USERS_LIST_CONFIG)).toEqual({});
    expect(stateToApiQuery(state, ADMIN_USERS_LIST_CONFIG)).toEqual({
      page: 1,
      per_page: 25,
      sort_by: "created_at",
      order: "desc",
    });
  });

  it("filtros fora do padrão vão com os nomes do contrato", () => {
    const state = readAdminListState(
      { status: "all", kind: "creator", workspace_id: "ws-1", created_from: "2026-10-01", created_to: "2026-10-31", sort_by: "last_session" },
      ADMIN_USERS_LIST_CONFIG,
    );
    expect(stateToApiQuery(state, ADMIN_USERS_LIST_CONFIG)).toEqual({
      page: 1,
      per_page: 25,
      sort_by: "last_session",
      order: "desc",
      status: "all",
      kind: "creator",
      workspace_id: "ws-1",
      created_from: "2026-10-01",
      created_to: "2026-10-31",
    });
  });

  it("ordenação só aceita as chaves do contrato", () => {
    expect(readAdminListState({ sort_by: "password" }, ADMIN_USERS_LIST_CONFIG).sortBy).toBe("created_at");
    expect(readAdminListState({ sort_by: "name" }, ADMIN_USERS_LIST_CONFIG).sortBy).toBe("name");
  });

  it("segmentado de estado: o primeiro é o padrão da API e 'Todos' inclui os excluídos", () => {
    expect(ADMIN_USERS_STATUS_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["active,suspended", "Ativos e suspensos"],
      ["active", "Ativos"],
      ["suspended", "Suspensos"],
      ["pending", "Em cadastro"],
      ["deleted", "Excluídos"],
      ["all", "Todos"],
    ]);
  });

  it("tipo: Marca é o padrão; Criadores e Todos", () => {
    expect(ADMIN_USERS_KIND_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["brand", "Marca"],
      ["creator", "Criadores"],
      ["all", "Todos"],
    ]);
  });

  it("o relógio dos testes é o do mock do Admin", () => {
    expect(NOW_ISO).toBe("2026-10-31T15:00:00.000Z");
  });
});

describe("formatTimeOfDay", () => {
  it("só a hora, no fuso de São Paulo (o dia vai no cabeçalho do grupo)", () => {
    expect(formatTimeOfDay("2026-10-30T13:30:00.000Z")).toBe("10:30");
    // 01:30 UTC ainda é 22:30 do dia anterior em São Paulo
    expect(formatTimeOfDay("2026-10-31T01:30:00.000Z")).toBe("22:30");
  });

  it("instante ausente ou inválido vira '—'", () => {
    expect(formatTimeOfDay(null)).toBe("—");
    expect(formatTimeOfDay("não é data")).toBe("—");
  });
});
