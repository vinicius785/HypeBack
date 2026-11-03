/** Respostas de exemplo tipadas pelo contrato (`admin-platform.types.ts`) para os testes do Financeiro. */
import type { AdminFeedResult, AdminListResult } from "@/lib/admin/admin-client";
import type {
  AdminFigure,
  AdminWorkspaceListItem,
  AdminFigureKind,
  AdminFinancialByWorkspaceRow,
  AdminFinancialFigures,
  AdminFinancialMovement,
  AdminFinancialSummary,
  AdminPageMeta,
} from "@/shared/admin-platform.types";

export const CAFE_ID = "7a1e0000-0000-4000-8000-000000000002";
export const AURORA_ID = "7a1e0000-0000-4000-8000-000000000004";

export const DEFINITIONS = {
  funded_total: "Soma das cobranças PIX pagas (asaas_charges com paid_at), todo o histórico.",
  custody: "Soma do saldo em custódia dos workspaces (workspace_balances.balance_cents), agora.",
  platform_revenue: "Indisponível: o banco não tem modelo de taxa ou comissão da plataforma.",
  drift: "workspace_balances.committed_cents menos a soma das reservas do ledger ligadas a campanhas.",
} as const;

export function money(value: number | null, kind: AdminFigureKind, definition = "Regra de cálculo de teste."): AdminFigure {
  return { value, unit: "brl_cents", kind, definition };
}

export function makeFigures(overrides: Partial<AdminFinancialFigures> = {}): AdminFinancialFigures {
  return {
    funded_total: money(123_456_789, "realized", DEFINITIONS.funded_total),
    funded_in_period: money(5_000_050, "realized"),
    custody: money(98_765_432, "stock", DEFINITIONS.custody),
    committed: money(12_345_600, "committed"),
    free_balance: money(86_419_832, "derived"),
    in_grace: money(250_075, "stock"),
    available_to_withdraw: money(80_000, "stock"),
    released_in_period: money(1_500_000, "realized"),
    released_total: money(7_654_321, "realized"),
    paid_pix_in_period: money(900_000, "realized"),
    paid_pix_total: money(4_321_000, "realized"),
    withdrawals_in_flight: money(45_000, "stock"),
    pending_charges: money(300_000, "stock"),
    platform_revenue: money(null, "unavailable", DEFINITIONS.platform_revenue),
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<AdminFinancialSummary> = {}): AdminFinancialSummary {
  return {
    period: { from: "2026-10-02", to: "2026-10-31" },
    generated_at: "2026-10-31T15:00:00.000Z",
    figures: makeFigures(),
    reconciliation: {
      committed_vs_reserved_drift: money(25_000, "derived", DEFINITIONS.drift),
      unattributed_reserved: money(0, "committed"),
    },
    ...overrides,
  };
}

export function makeMovement(overrides: Partial<AdminFinancialMovement> = {}): AdminFinancialMovement {
  return {
    id: "charge:11111111-1111-4111-8111-111111111111",
    occurred_at: "2026-10-30T22:30:00.000Z",
    type: "charge",
    direction: "in",
    status: "paid",
    status_label: "Pago",
    amount_cents: 100_000,
    kind: "realized",
    workspace: { id: CAFE_ID, name: "Café Serra Verde" },
    campaign: null,
    user: null,
    origin: { type: "asaas_charge", id: "11111111-1111-4111-8111-111111111111", external_id: "pay_8a7b6c5d" },
    description: "Aporte via PIX confirmado",
    ...overrides,
  };
}

/** Um saque (saída) sem workspace, com criador. */
export const WITHDRAWAL_MOVEMENT: AdminFinancialMovement = makeMovement({
  id: "withdrawal:77",
  occurred_at: "2026-10-30T13:00:00.000Z",
  type: "withdrawal",
  direction: "out",
  status: "pending",
  status_label: "Saque solicitado",
  amount_cents: 45_050,
  kind: "stock",
  workspace: null,
  user: { user_id: 1002, name: "Vanessa Mendes" },
  origin: { type: "withdrawal", id: "77", external_id: null },
  description: "Saque via PIX solicitado pelo criador",
});

/** Um lançamento interno (só mudou de bolso), com campanha e criador. */
export const LEDGER_MOVEMENT: AdminFinancialMovement = makeMovement({
  id: "entry:22222222-2222-4222-8222-222222222222",
  occurred_at: "2026-10-29T12:00:00.000Z",
  type: "ledger_entry",
  direction: "internal",
  status: "reserved",
  status_label: "Reservado",
  amount_cents: 30_000,
  kind: "committed",
  campaign: { id: "ca3b0000-0000-4000-8000-000000000006", title: "Festival Café Serra Verde" },
  user: { user_id: 1003, name: "Bruno Carvalho" },
  origin: { type: "balance_entry", id: "22222222-2222-4222-8222-222222222222", external_id: null },
  description: "Reserva para o criador na campanha",
});

export function feedPage<T>(data: T[], next: string | null = null): AdminFeedResult<T> {
  return { data, meta: { next_cursor: next, has_more: next !== null } };
}

export function pageMeta(partial: Partial<AdminPageMeta> = {}): AdminPageMeta {
  return { page: 1, per_page: 25, total: 0, total_pages: 0, ...partial };
}

export function listPage<T>(data: T[], partial: Partial<AdminPageMeta> = {}): AdminListResult<T> {
  return { data, meta: pageMeta({ total: data.length, total_pages: data.length > 0 ? 1 : 0, ...partial }) };
}

export const CAFE_ROW: AdminFinancialByWorkspaceRow = {
  workspace: { id: CAFE_ID, name: "Café Serra Verde" },
  funded_cents: 2_500_000,
  custody_cents: 1_234_567,
  committed_cents: 500_000,
  released_cents: 750_000,
  paid_pix_cents: 0,
};

export const AURORA_ROW: AdminFinancialByWorkspaceRow = {
  workspace: { id: AURORA_ID, name: "Aurora Beauty Studio" },
  funded_cents: 100_000,
  custody_cents: 0,
  committed_cents: 0,
  released_cents: 0,
  paid_pix_cents: 250_000,
};

export const UNASSIGNED_ROW: AdminFinancialByWorkspaceRow = {
  workspace: null,
  funded_cents: 0,
  custody_cents: 0,
  committed_cents: 12_345,
  released_cents: 0,
  paid_pix_cents: 0,
};

export const BY_WORKSPACE_DEFINITIONS: Record<string, string> = {
  funded_cents: "Aportes pagos no período.",
  custody_cents: "Saldo em custódia agora (não depende do período).",
  committed_cents: "Comprometido agora (não depende do período).",
  released_cents: "Liberado a criadores no período.",
  paid_pix_cents: "PIX concluído no período.",
};

/** Um workspace como a busca do seletor (`GET /admin/workspaces`) o devolve. */
export const CAFE_WORKSPACE_ITEM: AdminWorkspaceListItem = {
  id: CAFE_ID,
  name: "Café Serra Verde",
  photo: null,
  tax_id: null,
  kind: "brand",
  status: "active",
  status_changed_at: null,
  owner: { user_id: 9, name: "Bernardo Medeiros Moraes", email: "bernardo@cafeserraverde.com.br" },
  owners_count: 1,
  created_at: "2025-03-10T12:00:00.000Z",
  activity: { state: "active", last_activity_at: "2026-10-29T12:00:00.000Z", window_days: 30 },
  last_session_at: null,
  members_count: 4,
  campaigns_count: 3,
  published_campaigns_count: 1,
  creators_count: 5,
  funded_cents: 1_000_000,
  custody_cents: 250_000,
};

/** O que `GET /admin/workspaces/:id` devolve para o seletor resolver o nome de um id da URL (só o nome importa). */
export const CAFE_WORKSPACE_DETAIL = { id: CAFE_ID, name: "Café Serra Verde" };
