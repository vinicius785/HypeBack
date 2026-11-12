import { describe, expect, it } from "vitest";

import type { AdminActivityEvent, AdminAlert, AdminOverview } from "@/shared/admin-platform.types";

import {
  activityLink,
  ATTENTION_LIMIT,
  buildDashboardAreas,
  dashboardPeriodRule,
  pickAttentionAlerts,
  type DashboardExtras,
  type DashboardStat,
} from "./dashboard-model";
import { ALERTS, EVENTS, figure, OVERVIEW } from "./dashboard-fixtures";

const RANGE = { from: "2026-10-02", to: "2026-10-31" };
const EXTRAS: DashboardExtras = {
  activeToday: { value: 42, capped: false },
  applications: { today: 5, last_7_days: 21, month_to_date: 55 },
};

/** `null` = a consulta ainda não respondeu (sem overview). */
function stats(overview: AdminOverview | null = OVERVIEW, extras: DashboardExtras = EXTRAS) {
  const areas = buildDashboardAreas(overview ?? undefined, RANGE, extras);
  const byId = new Map<string, DashboardStat>();
  for (const area of Object.values(areas)) for (const stat of area.stats) byId.set(stat.id, stat);
  return { areas, stat: (id: string) => byId.get(id)!, all: [...byId.values()] };
}

describe("buildDashboardAreas: os quatro cartões, cada um com dois números", () => {
  it("Clientes, Usuários, Criadores e Campanhas, nesta ordem; o dinheiro não está no Dashboard", () => {
    const { areas } = stats();
    expect(Object.values(areas).map((area) => area.title)).toEqual(["Clientes", "Usuários", "Criadores", "Campanhas"]);
    expect(areas).not.toHaveProperty("financial");
    for (const area of Object.values(areas)) expect(area.stats).toHaveLength(2);
    expect(areas.workspaces.stats.map((s) => s.label)).toEqual(["Clientes", "Ativos"]);
    expect(areas.users.stats.map((s) => s.label)).toEqual(["Usuários", "Ativos hoje"]);
    expect(areas.creators.stats.map((s) => s.label)).toEqual(["Criadores", "Criados no período"]);
    expect(areas.campaigns.stats.map((s) => s.label)).toEqual(["Publicadas", "Inscrições hoje"]);
  });

  it("os números do overview são o AdminFigure do contrato (tipo e definição), sem conta no meio", () => {
    const { stat } = stats();
    expect(stat("workspaces.total").figure).toBe(OVERVIEW.workspaces.total);
    expect(stat("workspaces.active").figure).toBe(OVERVIEW.workspaces.active);
    expect(stat("users.brand-total").figure).toBe(OVERVIEW.users.brand_total);
    expect(stat("creators.total").figure).toBe(OVERVIEW.creators.total);
    expect(stat("creators.new").figure).toBe(OVERVIEW.creators.new_in_period);
    expect(stat("campaigns.published").figure).toBe(OVERVIEW.campaigns.published);
  });

  it("'Ativos hoje' e 'Inscrições hoje' vêm de outras rotas: o valor entra como número, com a regra no 'i'", () => {
    const { stat } = stats();
    expect(stat("users.active-today").figure).toMatchObject({ value: 42, unit: "count", kind: "proxy" });
    expect(stat("users.active-today").figure?.definition).toMatch(/sessão aberta hoje/);
    expect(stat("campaigns.applications").figure).toMatchObject({ value: 5, unit: "count", kind: "realized" });
    expect(stat("campaigns.applications").figure?.definition).toMatch(/Convites da marca não contam/);
  });

  it("antes da resposta dessas rotas, os dois números ficam em branco (esqueleto), sem inventar zero", () => {
    const { stat } = stats(OVERVIEW, {});
    expect(stat("users.active-today").figure).toBeUndefined();
    expect(stat("campaigns.applications").figure).toBeUndefined();
    expect(stat("campaigns.applications").hint).toBeUndefined();
  });

  it("os cartões têm só o título: a regra do período mora em dashboardPeriodRule", () => {
    const { areas } = stats();
    for (const area of Object.values(areas)) expect(area).not.toHaveProperty("description");
  });
});

describe("dashboardPeriodRule: a regra do período numa frase por assunto", () => {
  it("diz o que segue o período e o que é a posição de agora", () => {
    const [follows, now] = dashboardPeriodRule(30);
    expect(follows).toMatch(/Seguem o período/);
    expect(now).toMatch(/agora/);
  });

  it("a janela de atividade acompanha o servidor; sem ela (carregando) não inventa número", () => {
    expect(dashboardPeriodRule(30).join(" ")).toContain("últimos 30 dias");
    expect(dashboardPeriodRule(45).join(" ")).toContain("últimos 45 dias");
    expect(dashboardPeriodRule(undefined).join(" ")).not.toMatch(/\d/);
  });
});

describe("buildDashboardAreas: para onde cada número leva (nomes de filtro do contrato)", () => {
  const { stat } = stats();

  it("cada número leva à sua lista, já filtrada quando o filtro existe", () => {
    expect(stat("workspaces.total").to).toEqual({ to: "/admin/workspaces" });
    expect(stat("workspaces.active").to).toEqual({ to: "/admin/workspaces", search: { status: "active", activity: "active" } });
    expect(stat("users.brand-total").to).toEqual({ to: "/admin/users" });
    expect(stat("creators.total").to).toEqual({ to: "/admin/creators" });
    expect(stat("creators.new").to).toEqual({ to: "/admin/creators" });
    expect(stat("campaigns.published").to).toEqual({ to: "/admin/campaigns", search: { status: "published" } });
    expect(stat("campaigns.applications").to).toEqual({ to: "/admin/campaigns" });
  });

  it("'Ativos hoje' não leva a lugar nenhum (não existe lista equivalente: a sessão é uma aproximação)", () => {
    expect(stat("users.active-today").to).toBeUndefined();
  });

  it("todo destino é uma rota do Admin", () => {
    const { all } = stats();
    for (const s of all) if (s.to) expect(s.to.to).toMatch(/^\/admin\/(workspaces|users|creators|campaigns)$/);
  });

  it("carregando (sem overview) os destinos já existem: o cartão em esqueleto continua clicável", () => {
    const { stat: loading } = stats(null);
    expect(loading("workspaces.active").to).toEqual({ to: "/admin/workspaces", search: { status: "active", activity: "active" } });
    expect(loading("workspaces.active").figure).toBeUndefined();
  });
});

describe("buildDashboardAreas: textos de apoio", () => {
  it("novos no período vira '+N no período', com a definição do número citado", () => {
    const { stat } = stats();
    expect(stat("workspaces.total").hint).toEqual({
      text: "+6 no período",
      label: "Novos clientes no período",
      definition: "Definição de novos clientes.",
      periodic: true,
    });
    expect(stat("users.brand-total").hint?.text).toBe("+7 no período");
  });

  it("nenhum novo no período diz isso em vez de '+0'", () => {
    const zero = { ...OVERVIEW, workspaces: { ...OVERVIEW.workspaces, new_in_period: figure(0, "realized", "x") } };
    expect(stats(zero).stat("workspaces.total").hint?.text).toBe("nenhum novo no período");
  });

  it("número de período indisponível ou ausente não vira texto", () => {
    const unavailable = { ...OVERVIEW, workspaces: { ...OVERVIEW.workspaces, new_in_period: figure(null, "unavailable", "x") } };
    expect(stats(unavailable).stat("workspaces.total").hint).toBeUndefined();
    expect(stats(null).stat("workspaces.total").hint).toBeUndefined();
  });

  it("ativos diz a janela do servidor; 'ativos hoje' diz '100 ou mais' quando a leitura bate no limite", () => {
    expect(stats().stat("workspaces.active").hint).toEqual({ text: "com atividade nos últimos 30 dias" });
    expect(stats(null).stat("workspaces.active").hint).toBeUndefined();
    expect(stats().stat("users.active-today").hint).toEqual({ text: "com sessão hoje" });
    expect(stats(OVERVIEW, { ...EXTRAS, activeToday: { value: 100, capped: true } }).stat("users.active-today").hint).toEqual({ text: "100 ou mais" });
  });

  it("publicadas diz de quantas campanhas; inscrições dizem 7 dias e o mês", () => {
    const { stat } = stats();
    expect(stat("campaigns.published").hint?.text).toMatch(/^de [\d.]+ campanhas$/);
    expect(stat("campaigns.applications").hint?.text).toBe("21 em 7 dias · 55 no mês");
  });

  it("os números que seguem o período estão marcados (viram esqueleto quando o período muda); os de posição não", () => {
    const { all } = stats();
    expect(all.filter((s) => s.periodic).map((s) => s.id)).toEqual(["creators.new"]);
  });
});

describe("buildDashboardAreas: resposta incompleta do servidor", () => {
  it("um grupo ausente deixa os números dele em branco, sem derrubar a tela", () => {
    const partial = { ...OVERVIEW, campaigns: undefined } as unknown as AdminOverview;
    const { stat } = stats(partial);
    expect(stat("campaigns.published").figure).toBeUndefined();
    expect(stat("campaigns.published").hint).toBeUndefined();
    expect(stat("workspaces.total").figure).toBe(OVERVIEW.workspaces.total);
  });
});

describe("pickAttentionAlerts", () => {
  const titles = (list: AdminAlert[]) => list.map((a) => a.title);

  it("alertas de verdade primeiro (do mais grave ao menos), depois as sugestões; no máximo 6", () => {
    expect(ATTENTION_LIMIT).toBe(6);
    expect(titles(pickAttentionAlerts(ALERTS))).toEqual([
      "Saques de criadores travados", // alerta crítico (ordem do servidor entre iguais)
      "Transferências PIX que falharam", // alerta crítico
      "Cobranças PIX expiradas sem pagamento", // alerta atenção
      "Workspaces de marca sem proprietário", // alerta atenção
      "Alerta informativo sem destino", // alerta informativo
      "Campanhas publicadas sem nenhuma participação", // sugestão atenção: a primeira sugestão
    ]);
  });

  it("com poucos alertas de verdade, as sugestões completam, também da mais grave à menos", () => {
    const few = ALERTS.filter((a) => a.id === "a-saques" || a.kind === "suggestion");
    expect(titles(pickAttentionAlerts(few))).toEqual([
      "Saques de criadores travados",
      "Campanhas publicadas sem nenhuma participação",
      "Clientes sem atividade há mais de 30 dias",
      "Criadores com cadastro incompleto há mais de 14 dias",
    ]);
  });

  it("empate de tipo e gravidade mantém a ordem do servidor", () => {
    const same = [ALERTS[3], ALERTS[7]]; // dois críticos: saques, transferências
    expect(titles(pickAttentionAlerts(same))).toEqual(["Saques de criadores travados", "Transferências PIX que falharam"]);
    expect(titles(pickAttentionAlerts([...same].reverse()))).toEqual(["Transferências PIX que falharam", "Saques de criadores travados"]);
  });

  it("respeita o limite pedido e não mexe na lista original", () => {
    const original = [...ALERTS];
    expect(pickAttentionAlerts(ALERTS, 2)).toHaveLength(2);
    expect(pickAttentionAlerts(ALERTS, 0)).toEqual([]);
    expect(ALERTS).toEqual(original);
  });

  it("valor novo do backend (tipo ou gravidade desconhecidos) vai para o fim, sem quebrar", () => {
    const odd = { ...ALERTS[3], id: "x", title: "Tipo novo", kind: "outro" } as unknown as AdminAlert;
    const oddSeverity = { ...ALERTS[3], id: "y", title: "Gravidade nova", severity: "fatal" } as unknown as AdminAlert;
    const picked = pickAttentionAlerts([odd, oddSeverity, ALERTS[1]]);
    expect(titles(picked)).toEqual(["Cobranças PIX expiradas sem pagamento", "Gravidade nova", "Tipo novo"]);
  });

  it("lista vazia dá lista vazia", () => {
    expect(pickAttentionAlerts([])).toEqual([]);
  });
});

describe("activityLink", () => {
  const base = EVENTS[0];
  const make = (partial: Partial<AdminActivityEvent>): AdminActivityEvent => ({ ...base, ...partial });

  it("alvo que é workspace, campanha ou usuário leva ao detalhe dele", () => {
    expect(activityLink(make({ target: { type: "workspace", id: "ws-1", label: "X" } }))).toEqual({
      to: "/admin/workspaces/$workspaceId",
      params: { workspaceId: "ws-1" },
    });
    expect(activityLink(make({ target: { type: "campaign", id: "camp-1", label: "X" } }))).toEqual({
      to: "/admin/campaigns/$campaignId",
      params: { campaignId: "camp-1" },
    });
    expect(activityLink(make({ target: { type: "user", id: "9", label: "X" } }))).toEqual({
      to: "/admin/users/$userId",
      params: { userId: "9" },
    });
  });

  it("alvo sem tela de detalhe (aporte, saque, vínculo de membro) leva ao workspace do evento, se houver", () => {
    const workspace = { id: "ws-2", name: "Y" };
    for (const type of ["charge", "withdrawal", "workspace_member"]) {
      expect(activityLink(make({ target: { type, id: "1", label: "X" }, workspace }))).toEqual({
        to: "/admin/workspaces/$workspaceId",
        params: { workspaceId: "ws-2" },
      });
    }
  });

  it("sem alvo navegável e sem workspace, não leva a lugar nenhum", () => {
    expect(activityLink(make({ target: { type: "charge", id: "1", label: "X" }, workspace: null }))).toBeUndefined();
    expect(activityLink(make({ target: null, workspace: null }))).toBeUndefined();
  });

  it("alvo vazio (id em branco) não vira link quebrado", () => {
    expect(activityLink(make({ target: { type: "workspace", id: "", label: null }, workspace: null }))).toBeUndefined();
  });

  it("sem alvo mas com workspace, leva ao workspace", () => {
    expect(activityLink(make({ target: null, workspace: { id: "ws-3", name: "Z" } }))).toEqual({
      to: "/admin/workspaces/$workspaceId",
      params: { workspaceId: "ws-3" },
    });
  });
});
