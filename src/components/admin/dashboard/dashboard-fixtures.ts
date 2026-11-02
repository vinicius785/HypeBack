/**
 * Dados de teste do Dashboard, tipados pelo contrato (`admin-platform.types.ts`). Só os testes importam este arquivo.
 * Os números são todos diferentes entre si: um teste acha o cartão certo pelo valor.
 */
import type {
  AdminActivityEvent,
  AdminAlert,
  AdminFigure,
  AdminFigureKind,
  AdminFigureUnit,
  AdminOverview,
} from "@/shared/admin-platform.types";

export function figure(
  value: number | null,
  kind: AdminFigureKind,
  definition: string,
  unit: AdminFigureUnit = "count",
): AdminFigure {
  return { value, unit, kind, definition };
}

const unavailable = (unit: AdminFigureUnit, definition: string): AdminFigure => figure(null, "unavailable", definition, unit);

export const OVERVIEW: AdminOverview = {
  period: { from: "2026-10-02", to: "2026-10-31" },
  generated_at: "2026-10-31T15:00:00.000Z",
  activity_window_days: 30,
  workspaces: {
    total: figure(50, "stock", "Definição de clientes."),
    active: figure(27, "derived", "Definição de clientes ativos."),
    inactive: figure(13, "derived", "Definição de clientes inativos (inclui quem nunca teve atividade)."),
    suspended: figure(5, "stock", "Definição de clientes suspensos."),
    archived: figure(4, "stock", "Definição de clientes arquivados."),
    new_in_period: figure(6, "realized", "Definição de novos clientes."),
    trial: unavailable("count", "Indisponível: o banco não tem conceito de teste, plano ou assinatura."),
  },
  users: {
    brand_total: figure(36, "stock", "Definição de usuários."),
    brand_new_in_period: figure(7, "realized", "Definição de novos usuários."),
    suspended: figure(3, "stock", "Definição de usuários suspensos."),
    recent_session: figure(17, "proxy", "Aproximação: sessão usada nos últimos 30 dias."),
    creators_total: figure(145, "stock", "Definição de criadores."),
  },
  campaigns: {
    total: figure(116, "stock", "Definição de campanhas."),
    published: figure(39, "stock", "Definição de publicadas."),
    finished: figure(49, "stock", "Definição de finalizadas."),
    draft: figure(28, "stock", "Definição de rascunhos."),
    created_in_period: figure(34, "realized", "Definição de campanhas criadas."),
  },
  creators: {
    total: figure(145, "stock", "Definição de criadores."),
    new_in_period: figure(9, "realized", "Definição de novos criadores."),
  },
  financial: {
    funded_in_period: figure(2_180_000, "realized", "Definição de aportes.", "brl_cents"),
    custody: figure(5_750_000, "stock", "Definição de custódia.", "brl_cents"),
    committed: figure(2_875_000, "committed", "Definição de comprometido.", "brl_cents"),
    released_in_period: figure(2_420_000, "realized", "Definição de liberado.", "brl_cents"),
    paid_pix_in_period: figure(745_000, "realized", "Definição de PIX pago.", "brl_cents"),
    pending_charges: figure(1_200_000, "stock", "Definição de cobranças pendentes.", "brl_cents"),
    platform_revenue: unavailable("brl_cents", "Indisponível: o banco não tem modelo de taxa ou comissão."),
  },
};

function alert(partial: Partial<AdminAlert> & Pick<AdminAlert, "id" | "kind" | "severity" | "title">): AdminAlert {
  return {
    code: partial.id.toUpperCase().replace(/[^A-Z]+/g, "_"),
    description: `Descrição de ${partial.title}.`,
    rule: `Regra de ${partial.title}.`,
    source: "tabela.coluna",
    count: 1,
    samples: [],
    link: null,
    ...partial,
  };
}

/** De propósito fora de ordem: alertas e sugestões misturados, gravidades embaralhadas. 8 itens (o painel mostra 6). */
export const ALERTS: AdminAlert[] = [
  alert({
    id: "s-inativos",
    kind: "suggestion",
    severity: "info",
    title: "Clientes sem atividade há mais de 30 dias",
    count: 17,
    link: { path: "/admin/workspaces", query: { activity: "inactive" } },
  }),
  alert({
    id: "a-cobrancas",
    kind: "alert",
    severity: "warning",
    title: "Cobranças PIX expiradas sem pagamento",
    count: 5,
    link: { path: "/admin/financial", query: { type: "charge" } },
  }),
  alert({
    id: "s-campanhas",
    kind: "suggestion",
    severity: "warning",
    title: "Campanhas publicadas sem nenhuma participação",
    count: 2,
    link: { path: "/admin/campaigns", query: { status: "published" } },
  }),
  alert({
    id: "a-saques",
    kind: "alert",
    severity: "critical",
    title: "Saques de criadores travados",
    count: 1,
    rule: "influencer_withdrawals com status pendente e requested_at anterior a 72 horas atrás.",
    link: { path: "/admin/financial", query: { type: "withdrawal" } },
  }),
  alert({
    id: "a-sem-dono",
    kind: "alert",
    severity: "warning",
    title: "Workspaces de marca sem proprietário",
    count: 3,
    link: { path: "/admin/workspaces" },
  }),
  alert({ id: "a-informativo", kind: "alert", severity: "info", title: "Alerta informativo sem destino", count: 2, link: null }),
  alert({
    id: "s-criadores",
    kind: "suggestion",
    severity: "info",
    title: "Criadores com cadastro incompleto há mais de 14 dias",
    count: 30,
    rule: "Limite escolhido por produto: 14 dias desde o cadastro, com dados mínimos faltando.",
    link: { path: "/admin/creators", query: { registration: "incomplete" } },
  }),
  alert({
    id: "a-transferencias",
    kind: "alert",
    severity: "critical",
    title: "Transferências PIX que falharam",
    count: 1,
    link: { path: "/admin/financial", query: { type: "transfer" } },
  }),
];

const WS = { id: "7a1e0000-0000-4000-8000-000000000043", name: "Surf Shop Onda Perfeita" };

function event(partial: Partial<AdminActivityEvent> & Pick<AdminActivityEvent, "id" | "occurred_at" | "kind" | "title">): AdminActivityEvent {
  return { source: "derived", actor: null, workspace: null, target: null, reason: null, ...partial };
}

/** Do mais novo ao mais antigo, 9 eventos (a tela mostra 8). Horários relativos a 2026-10-31T15:00:00Z. */
export const EVENTS: AdminActivityEvent[] = [
  event({
    id: "action:38",
    occurred_at: "2026-10-31T14:30:00.000Z",
    kind: "admin_action",
    source: "platform_admin_action_log",
    title: "Workspace suspenso: Aurora Beauty Studio",
    actor: { user_id: 1, name: "Marina Albuquerque" },
    workspace: { id: "7a1e0000-0000-4000-8000-000000000004", name: "Aurora Beauty Studio" },
    target: { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000004", label: "Aurora Beauty Studio" },
    reason: "Pagamento em disputa com o financeiro; aguardando retorno do cliente.",
  }),
  event({
    id: "withdrawal:5043",
    occurred_at: "2026-10-31T14:00:00.000Z",
    kind: "withdrawal_paid",
    title: "Saque de R$ 200,00 pago a Diana Santana",
    actor: { user_id: 1099, name: "Diana Santana" },
    workspace: { id: "7a1e0000-0000-4000-8000-000000000054", name: "Tapioca da Praça" },
    target: { type: "withdrawal", id: "5043", label: "R$ 200,00" },
  }),
  event({
    id: "member:ws43:9",
    occurred_at: "2026-10-31T13:00:00.000Z",
    kind: "member_joined",
    title: 'Bernardo Medeiros Moraes entrou em "Surf Shop Onda Perfeita" como Proprietário',
    actor: { user_id: 9, name: "Bernardo Medeiros Moraes" },
    workspace: WS,
    target: { type: "user", id: "9", label: "Bernardo Medeiros Moraes" },
  }),
  event({
    id: "charge:c1",
    occurred_at: "2026-10-31T12:00:00.000Z",
    kind: "charge_paid",
    title: 'Aporte de R$ 100,00 confirmado em "Energia Solar Sol Pleno"',
    workspace: { id: "7a1e0000-0000-4000-8000-000000000040", name: "Energia Solar Sol Pleno" },
    target: { type: "charge", id: "c1", label: "R$ 100,00" },
  }),
  event({
    id: "campaign:camp1",
    occurred_at: "2026-10-30T15:00:00.000Z",
    kind: "campaign_created",
    title: 'Campanha "Festival Café Serra Verde" criada em "Café Serra Verde"',
    actor: { user_id: 20, name: "Paula Serra" },
    workspace: { id: "7a1e0000-0000-4000-8000-000000000002", name: "Café Serra Verde" },
    target: { type: "campaign", id: "ca3b0000-0000-4000-8000-000000000006", label: "Festival Café Serra Verde" },
  }),
  event({
    id: "workspace:ws17",
    occurred_at: "2026-10-28T15:00:00.000Z",
    kind: "workspace_created",
    title: 'Workspace "Óticas Visão Clara" criado',
    actor: { user_id: 21, name: "Rui Visão" },
    workspace: { id: "7a1e0000-0000-4000-8000-000000000017", name: "Óticas Visão Clara" },
    target: { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000017", label: "Óticas Visão Clara" },
  }),
  event({
    id: "action:37",
    occurred_at: "2026-10-27T15:00:00.000Z",
    kind: "admin_action",
    source: "platform_admin_action_log",
    title: "Membro adicionado: Larissa Ribeiro",
    actor: { user_id: 1, name: "Marina Albuquerque" },
    workspace: { id: "7a1e0000-0000-4000-8000-000000000002", name: "Café Serra Verde" },
    target: { type: "workspace_member", id: "3", label: "Larissa Ribeiro" },
    reason: "Pedido do cliente por e-mail.",
  }),
  event({
    id: "charge:c2",
    occurred_at: "2026-10-26T15:00:00.000Z",
    kind: "charge_paid",
    title: 'Aporte de R$ 150,00 confirmado em "Floricultura Jardim Secreto"',
    target: { type: "charge", id: "c2", label: "R$ 150,00" },
  }),
  event({
    id: "charge:c3",
    occurred_at: "2026-10-25T15:00:00.000Z",
    kind: "charge_paid",
    title: 'Aporte de R$ 300,00 confirmado em "Padaria Pão Dourado"',
    workspace: { id: "7a1e0000-0000-4000-8000-000000000007", name: "Padaria Pão Dourado" },
    target: { type: "charge", id: "c3", label: "R$ 300,00" },
  }),
];
