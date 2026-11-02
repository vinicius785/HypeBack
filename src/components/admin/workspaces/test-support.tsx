/**
 * Apoio dos testes do módulo Workspaces: roteador falso (a URL de verdade, sem o TanStack), roteamento das
 * chamadas ao cliente do Admin por caminho e fixtures tipadas pelo contrato. Não é carregado fora dos testes.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useSyncExternalStore, type AnchorHTMLAttributes, type ReactElement, type ReactNode } from "react";
import type { Mock } from "vitest";

import { AdminApiError, type AdminQuery } from "@/lib/admin/admin-client";
import type {
  AdminActivityEvent,
  AdminAuditLogEntry,
  AdminCampaignListItem,
  AdminFigure,
  AdminFinancialFigures,
  AdminFinancialMovement,
  AdminListResponse,
  AdminWorkspaceActionAvailability,
  AdminWorkspaceDetail,
  AdminWorkspaceFinancial,
  AdminWorkspaceImpact,
  AdminWorkspaceListItem,
  AdminWorkspaceMember,
  AdminWorkspaceStatus,
} from "@/shared/admin-platform.types";

// ---------------------------------------------------------------------------
// Roteador falso
// ---------------------------------------------------------------------------

type Search = Record<string, unknown>;
interface NavigateOptions {
  to?: string;
  replace?: boolean;
  search?: Search | ((previous: Search) => Search);
}

const listeners = new Set<() => void>();
const state = { search: {} as Search, navigations: [] as NavigateOptions[] };

function emit() {
  for (const listener of listeners) listener();
}

function navigate(options: NavigateOptions) {
  state.navigations.push(options);
  state.search = typeof options.search === "function" ? options.search(state.search) : (options.search ?? state.search);
  emit();
}

/** A URL do teste: `fakeRouter.set({ status: "archived" })` antes de montar; `fakeRouter.search` depois de clicar. */
export const fakeRouter = {
  set(search: Search = {}) {
    state.search = search;
    state.navigations = [];
    emit();
  },
  get search(): Search {
    return state.search;
  },
  get navigations(): NavigateOptions[] {
    return state.navigations;
  },
};

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  params?: Record<string, string | number>;
  search?: Record<string, unknown>;
  children?: ReactNode;
};

/** Use em `vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock())`. */
export function routerModuleMock() {
  return {
    Link: ({ to, params, search, children, ...rest }: LinkProps) => {
      let href = to;
      for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, String(value));
      const query = new URLSearchParams(Object.entries(search ?? {}).map(([k, v]) => [k, String(v)])).toString();
      return (
        <a href={query ? `${href}?${query}` : href} {...rest}>
          {children}
        </a>
      );
    },
    useSearch: () =>
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => state.search,
      ),
    useNavigate: () => navigate,
  };
}

// ---------------------------------------------------------------------------
// Cliente do Admin falso
// ---------------------------------------------------------------------------

type Handler = ((query: AdminQuery | undefined) => unknown) | object | string | number | boolean | null | undefined;

/** Responde às leituras por caminho. Caminho sem resposta cai em "recurso indisponível" (404 de rota). */
export function routeReads(mock: Mock, table: Record<string, Handler>) {
  mock.mockImplementation(async (path: string, query?: AdminQuery) => {
    if (!(path in table)) {
      throw new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: `sem rota de teste: ${path}` });
    }
    const handler = table[path];
    return typeof handler === "function" ? (handler as (q?: AdminQuery) => unknown)(query) : handler;
  });
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return new AdminApiError({ status, code, message, details });
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Promessa que o teste resolve na hora que quiser (rede lenta). */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      // `retry` é política de cada hook; o atraso entre tentativas encolhe para o teste não esperar segundos.
      queries: { retryDelay: 1, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const WS_ID = "7a1e0000-0000-4000-8000-000000000002";
export const NOW_ISO = "2026-10-31T15:00:00.000Z";

export function listMeta(total: number, page = 1, perPage = 25, definitions?: Record<string, string>) {
  return { page, per_page: perPage, total, total_pages: total === 0 ? 0 : Math.ceil(total / perPage), definitions };
}

export function listOf<T>(data: T[], total = data.length, page = 1, perPage = 25, definitions?: Record<string, string>): AdminListResponse<T> {
  return { data, meta: listMeta(total, page, perPage, definitions) };
}

export function makeListItem(over: Partial<AdminWorkspaceListItem> = {}): AdminWorkspaceListItem {
  return {
    id: WS_ID,
    name: "Café Serra Verde",
    photo: null,
    tax_id: "11222333000181",
    kind: "brand",
    status: "active",
    status_changed_at: null,
    owner: { user_id: 11, name: "Helena Prado", email: "helena@serraverde.com.br" },
    owners_count: 1,
    created_at: "2025-03-12T13:00:00.000Z",
    activity: { state: "active", last_activity_at: "2026-10-28T15:00:00.000Z", window_days: 30 },
    last_session_at: "2026-10-30T15:00:00.000Z",
    members_count: 6,
    campaigns_count: 8,
    published_campaigns_count: 2,
    creators_count: 41,
    funded_cents: 123456789,
    custody_cents: 4500050,
    ...over,
  };
}

export function canFor(status: AdminWorkspaceStatus): AdminWorkspaceActionAvailability {
  const none = { update: false, suspend: false, reactivate: false, archive: false, unarchive: false, delete: false, restore: false };
  switch (status) {
    case "active":
      return { ...none, update: true, suspend: true, archive: true, delete: true };
    case "suspended":
      return { ...none, update: true, reactivate: true, archive: true, delete: true };
    case "archived":
      return { ...none, update: true, unarchive: true, delete: true };
    case "deleted":
      return { ...none, restore: true };
  }
}

export function makeDetail(status: AdminWorkspaceStatus = "active", over: Partial<AdminWorkspaceDetail> = {}): AdminWorkspaceDetail {
  return {
    id: WS_ID,
    name: "Café Serra Verde",
    photo: null,
    description: "Cafés especiais da Serra Verde.",
    niche: { id: 4, name: "Alimentação" },
    kind: "brand",
    legal_name: "Serra Verde Cafés Ltda",
    tax_id: "11222333000181",
    address: {
      postal_code: "01310100",
      street: "Avenida Paulista",
      street_number: "1578",
      unit: "Sala 4",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    },
    created_at: "2025-03-12T13:00:00.000Z",
    lifecycle: {
      status,
      suspended_at: null,
      archived_at: null,
      deleted_at: null,
      status_changed_at: status === "active" ? null : "2026-10-20T12:00:00.000Z",
      status_reason: status === "active" ? null : "Cobrança em aberto",
      status_changed_by: status === "active" ? null : { user_id: 1, name: "Marina Albuquerque" },
    },
    owners: [{ user_id: 11, name: "Helena Prado", email: "helena@serraverde.com.br" }],
    activity: { state: "active", last_activity_at: "2026-10-28T15:00:00.000Z", window_days: 30 },
    last_session_at: "2026-10-30T15:00:00.000Z",
    counts: { members: 6, campaigns: 8, published_campaigns: 2, creators: 41 },
    money: { funded_cents: 123456789, custody_cents: 4500050, committed_cents: 1200025 },
    can: canFor(status),
    ...over,
  };
}

export function makeMember(over: Partial<AdminWorkspaceMember> = {}): AdminWorkspaceMember {
  return {
    user_id: 11,
    name: "Helena Prado",
    email: "helena@serraverde.com.br",
    photo: null,
    role: "owner",
    has_custom_permissions: false,
    joined_at: "2025-03-12T13:00:00.000Z",
    user_status: "active",
    is_platform_admin: false,
    last_session_at: "2026-10-30T15:00:00.000Z",
    ...over,
  };
}

export function makeCampaign(over: Partial<AdminCampaignListItem> = {}): AdminCampaignListItem {
  return {
    id: "ca3b0000-0000-4000-8000-000000000006",
    title: "Festival Café Serra Verde",
    banner: null,
    status: "published",
    payment_method: "fixed",
    created_at: "2026-09-10T12:00:00.000Z",
    workspace: { id: WS_ID, name: "Café Serra Verde", status: "active" },
    workspace_owner: { user_id: 11, name: "Helena Prado", email: "helena@serraverde.com.br" },
    max_influencers: 20,
    participants: { total: 12, participating: 5 },
    deliveries_published: 3,
    pending_actions: 1,
    committed_cents: 250000,
    released_cents: 80000,
    budget: figure("unavailable", null, "brl_cents", "Indisponível: o banco não guarda orçamento."),
    ...over,
  };
}

export function figure(
  kind: AdminFigure["kind"],
  value: number | null,
  unit: AdminFigure["unit"] = "brl_cents",
  definition = `Definição de teste (${kind}).`,
): AdminFigure {
  return { value, unit, kind, definition };
}

export function makeFinancial(over: Partial<AdminFinancialFigures> = {}): AdminWorkspaceFinancial {
  return {
    workspace: { id: WS_ID, name: "Café Serra Verde" },
    period: { from: "2026-10-02", to: "2026-10-31" },
    figures: {
      funded_total: figure("realized", 123456789),
      funded_in_period: figure("realized", 2500000),
      custody: figure("stock", 4500050),
      committed: figure("committed", 1200025),
      free_balance: figure("derived", 3300025),
      in_grace: figure("stock", 100000),
      available_to_withdraw: figure("stock", 50000),
      released_in_period: figure("realized", 800000),
      released_total: figure("realized", 9000000),
      paid_pix_in_period: figure("realized", 700000),
      paid_pix_total: figure("realized", 8500000),
      withdrawals_in_flight: figure("stock", 30000),
      pending_charges: figure("stock", 150000),
      platform_revenue: figure("unavailable", null, "brl_cents", "Indisponível: o banco não tem modelo de taxa."),
      ...over,
    },
  };
}

export function makeMovement(over: Partial<AdminFinancialMovement> = {}): AdminFinancialMovement {
  return {
    id: "charge:aa11",
    occurred_at: "2026-10-28T15:30:00.000Z",
    type: "charge",
    direction: "in",
    status: "paid",
    status_label: "Paga",
    amount_cents: 250000,
    kind: "realized",
    workspace: { id: WS_ID, name: "Café Serra Verde" },
    campaign: { id: "ca3b0000-0000-4000-8000-000000000006", title: "Festival Café Serra Verde" },
    user: null,
    origin: { type: "asaas_charge", id: "aa11-origem", external_id: "pay_123" },
    description: "Aporte via PIX",
    ...over,
  };
}

export function makeEvent(over: Partial<AdminActivityEvent> = {}): AdminActivityEvent {
  return {
    id: "campaign:ca3b",
    occurred_at: "2026-10-28T15:30:00.000Z",
    kind: "campaign_created",
    source: "derived",
    title: 'Campanha "Festival Café Serra Verde" criada',
    actor: { user_id: 11, name: "Helena Prado" },
    workspace: { id: WS_ID, name: "Café Serra Verde" },
    target: null,
    reason: null,
    ...over,
  };
}

export function makeAuditEntry(over: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry {
  return {
    id: 7,
    created_at: "2026-10-28T15:30:00.000Z",
    action: "workspace.suspend",
    action_label: "Workspace suspenso",
    actor: { user_id: 1, name: "Marina Albuquerque", email: "marina@hype.com.br", role: "admin" },
    target: { type: "workspace", id: WS_ID, label: "Café Serra Verde" },
    workspace: { id: WS_ID, name: "Café Serra Verde" },
    reason: "Cobrança em aberto",
    before_state: { status: "active" },
    after_state: { status: "suspended" },
    impact: null,
    ip: "203.0.113.10",
    ...over,
  };
}

export function makeImpact(over: Partial<AdminWorkspaceImpact> = {}): AdminWorkspaceImpact {
  return {
    workspace: { id: WS_ID, name: "Café Serra Verde", status: "active" },
    computed_at: NOW_ISO,
    counts: {
      members: 6,
      campaigns_total: 8,
      campaigns_draft: 3,
      campaigns_published: 2,
      campaigns_finished: 3,
      participations: 90,
      creators: 41,
      contracts: 12,
      charges_total: 20,
      charges_pending: 1,
      withdrawals_in_flight: 2,
      ledger_entries: { reserved: 4, pending_release: 2, available: 0, withdrawn: 7, cancelled: 0 },
    },
    money: {
      custody_cents: 4500050,
      committed_cents: 1200025,
      funded_total_cents: 123456789,
      pending_charges_cents: 150000,
      reserved_entries_cents: 1200025,
      released_not_withdrawn_cents: 150000,
      withdrawals_in_flight_cents: 30000,
    },
    blockers: [],
    warnings: [{ code: "MEMBERS_LOSE_ACCESS", message: "6 pessoas da equipe do cliente perdem o acesso ao workspace." }],
    consequences: {
      suspend: ["O time do cliente perde todo o acesso até a reativação.", "O dinheiro não para: aportes e saques continuam."],
      archive: ["O time do cliente passa a ver o workspace somente em modo leitura.", "É reversível: dá para desarquivar."],
      delete: ["O workspace some para o time do cliente (exclusão lógica).", "Só a plataforma pode restaurá-lo."],
    },
    can: { delete: true },
    impact_token: "token-1",
    impact_token_expires_at: "2099-01-01T00:00:00.000Z",
    ...over,
  };
}
