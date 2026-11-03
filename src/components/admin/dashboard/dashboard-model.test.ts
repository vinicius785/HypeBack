import { describe, expect, it } from "vitest";

import { formatBRLFromCents } from "@/lib/admin/format";
import type { AdminActivityEvent, AdminAlert, AdminOverview } from "@/shared/admin-platform.types";

import {
  activityLink,
  ATTENTION_LIMIT,
  buildDashboardAreas,
  dashboardPeriodRule,
  pickAttentionAlerts,
  type DashboardStat,
} from "./dashboard-model";
import { ALERTS, EVENTS, figure, OVERVIEW } from "./dashboard-fixtures";

const RANGE = { from: "2026-10-02", to: "2026-10-31" };

/** `null` = a consulta ainda não respondeu (sem overview). */
function stats(overview: AdminOverview | null = OVERVIEW) {
  const areas = buildDashboardAreas(overview ?? undefined, RANGE);
  const byId = new Map<string, DashboardStat>();
  for (const area of Object.values(areas)) for (const stat of area.stats) byId.set(stat.id, stat);
  return { areas, stat: (id: string) => byId.get(id)!, all: [...byId.values()] };
}

describe("buildDashboardAreas: o que cada painel mostra", () => {
  it("são cinco painéis, cada um com os seus números na ordem da tela", () => {
    const { areas } = stats();
    expect(Object.values(areas).map((area) => area.title)).toEqual(["Clientes", "Usuários", "Criadores", "Campanhas", "Dinheiro"]);
    expect(areas.workspaces.stats.map((s) => s.label)).toEqual(["Clientes", "Ativos", "Inativos", "Suspensos", "Arquivados", "Em teste"]);
    expect(areas.users.stats.map((s) => s.label)).toEqual(["Usuários", "Suspensos", "Sessão recente"]);
    expect(areas.creators.stats.map((s) => s.label)).toEqual(["Criadores"]);
    expect(areas.campaigns.stats.map((s) => s.label)).toEqual(["Campanhas", "Publicadas", "Finalizadas", "Rascunhos", "Criadas no período"]);
    expect(areas.financial.stats.map((s) => s.label)).toEqual([
      "Aportes no período",
      "Saldo em custódia",
      "Liberado a criadores no período",
      "Pago via PIX no período",
      "Cobranças pendentes",
      "Receita da plataforma",
    ]);
  });

  it("cada número é o AdminFigure do contrato (com o seu tipo e a sua definição), sem conta nenhuma no meio", () => {
    const { stat } = stats();
    expect(stat("workspaces.total").figure).toBe(OVERVIEW.workspaces.total);
    expect(stat("workspaces.active").figure).toBe(OVERVIEW.workspaces.active);
    expect(stat("workspaces.inactive").figure).toBe(OVERVIEW.workspaces.inactive);
    expect(stat("users.recent-session").figure).toBe(OVERVIEW.users.recent_session);
    expect(stat("creators.total").figure).toBe(OVERVIEW.creators.total);
    expect(stat("campaigns.created").figure).toBe(OVERVIEW.campaigns.created_in_period);
    expect(stat("financial.custody").figure).toBe(OVERVIEW.financial.custody);
    expect(stat("financial.paid-pix").figure).toBe(OVERVIEW.financial.paid_pix_in_period);
  });

  it("os painéis têm só o título: a regra do período saiu da descrição e mora em dashboardPeriodRule", () => {
    const { areas } = stats();
    for (const area of Object.values(areas)) expect(area).not.toHaveProperty("description");
  });
});

describe("dashboardPeriodRule: a regra do período numa frase por assunto", () => {
  it("diz o que segue o período e o que é a posição de agora", () => {
    const [follows, now] = dashboardPeriodRule(30);
    expect(follows).toMatch(/Seguem o período/);
    expect(follows).toMatch(/aportes/);
    expect(follows).toMatch(/PIX/);
    expect(now).toMatch(/agora/);
    expect(now).toMatch(/custódia/);
  });

  it("a janela de atividade acompanha o servidor; sem ela (carregando) não inventa número", () => {
    expect(dashboardPeriodRule(30).join(" ")).toContain("últimos 30 dias");
    expect(dashboardPeriodRule(45).join(" ")).toContain("últimos 45 dias");
    expect(dashboardPeriodRule(undefined).join(" ")).not.toMatch(/\d/);
  });
});

describe("buildDashboardAreas: para onde cada número leva (nomes de filtro do contrato)", () => {
  const { stat } = stats();

  it("clientes", () => {
    expect(stat("workspaces.total").to).toEqual({ to: "/admin/workspaces" });
    expect(stat("workspaces.active").to).toEqual({ to: "/admin/workspaces", search: { status: "active", activity: "active" } });
    expect(stat("workspaces.inactive").to).toEqual({ to: "/admin/workspaces", search: { status: "active", activity: "inactive" } });
    expect(stat("workspaces.suspended").to).toEqual({ to: "/admin/workspaces", search: { status: "suspended" } });
    expect(stat("workspaces.archived").to).toEqual({ to: "/admin/workspaces", search: { status: "archived" } });
  });

  it("usuários e criadores", () => {
    expect(stat("users.brand-total").to).toEqual({ to: "/admin/users" });
    expect(stat("users.suspended").to).toEqual({ to: "/admin/users", search: { status: "suspended" } });
    expect(stat("creators.total").to).toEqual({ to: "/admin/creators" });
  });

  it("campanhas: por situação, e 'criadas no período' leva o período como created_from/created_to", () => {
    expect(stat("campaigns.total").to).toEqual({ to: "/admin/campaigns" });
    expect(stat("campaigns.published").to).toEqual({ to: "/admin/campaigns", search: { status: "published" } });
    expect(stat("campaigns.finished").to).toEqual({ to: "/admin/campaigns", search: { status: "finished" } });
    expect(stat("campaigns.draft").to).toEqual({ to: "/admin/campaigns", search: { status: "draft" } });
    expect(stat("campaigns.created").to).toEqual({
      to: "/admin/campaigns",
      search: { created_from: "2026-10-02", created_to: "2026-10-31" },
    });
  });

  it("dinheiro: tudo vai ao Financeiro; o que segue o período leva from/to, a posição de agora não leva", () => {
    expect(stat("financial.funded").to).toEqual({
      to: "/admin/financial",
      search: { type: "charge", from: "2026-10-02", to: "2026-10-31" },
    });
    expect(stat("financial.custody").to).toEqual({ to: "/admin/financial" });
    expect(stat("financial.released").to).toEqual({
      to: "/admin/financial",
      search: { type: "ledger_entry", from: "2026-10-02", to: "2026-10-31" },
    });
    expect(stat("financial.paid-pix").to).toEqual({
      to: "/admin/financial",
      search: { type: "transfer", from: "2026-10-02", to: "2026-10-31" },
    });
    expect(stat("financial.pending").to).toEqual({ to: "/admin/financial", search: { type: "charge" } });
  });

  it("número 'não apurado' e a sessão recente (aproximação sem filtro equivalente) não levam a lugar nenhum", () => {
    expect(stat("workspaces.trial").to).toBeUndefined();
    expect(stat("financial.revenue").to).toBeUndefined();
    expect(stat("users.recent-session").to).toBeUndefined();
  });

  it("todo destino é uma rota do Admin", () => {
    const { all } = stats();
    for (const s of all) if (s.to) expect(s.to.to).toMatch(/^\/admin\/(workspaces|users|creators|campaigns|financial)$/);
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
    expect(stat("creators.total").hint?.text).toBe("+9 no período");
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

  it("o comprometido aparece como PARTE da custódia (não soma), com a sua definição", () => {
    const hint = stats().stat("financial.custody").hint;
    expect(hint?.text).toBe(`dos quais ${formatBRLFromCents(2_875_000)} comprometidos`);
    expect(hint?.text).toContain("28.750,00");
    expect(hint?.label).toBe("Comprometido");
    expect(hint?.definition).toBe("Definição de comprometido.");
    expect(hint?.periodic).toBeUndefined();
  });

  it("liberado a criadores diz que vai ao saldo do criador e nunca se chama 'pago'; só o PIX concluído é 'pago'", () => {
    const { all, stat } = stats();
    expect(stat("financial.released").hint?.text).toBe("vai ao saldo do criador");
    const paidWording = all.filter((s) => /pag[oa]/i.test(`${s.label} ${s.hint?.text ?? ""}`));
    expect(paidWording.map((s) => s.id)).toEqual(["financial.paid-pix"]);
  });

  it("a sessão recente diz a janela do servidor", () => {
    expect(stats().stat("users.recent-session").hint).toEqual({ text: "últimos 30 dias" });
    expect(stats(null).stat("users.recent-session").hint).toBeUndefined();
  });

  it("os números que seguem o período estão marcados (viram esqueleto quando o período muda); os de posição não", () => {
    const { all } = stats();
    expect(all.filter((s) => s.periodic).map((s) => s.id)).toEqual([
      "campaigns.created",
      "financial.funded",
      "financial.released",
      "financial.paid-pix",
    ]);
  });
});

describe("buildDashboardAreas: resposta incompleta do servidor", () => {
  it("um grupo ausente deixa os números dele em branco, sem derrubar a tela", () => {
    const partial = { ...OVERVIEW, financial: undefined } as unknown as AdminOverview;
    const { stat } = stats(partial);
    expect(stat("financial.custody").figure).toBeUndefined();
    expect(stat("financial.custody").hint).toBeUndefined();
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
