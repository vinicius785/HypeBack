/** Respostas de exemplo tipadas pelo contrato (`admin-platform.types.ts`) para os testes de Campanhas. */
import type { AdminListResult } from "@/lib/admin/admin-client";
import type {
  AdminCampaignDetail,
  AdminCampaignListItem,
  AdminFigure,
  AdminPageMeta,
} from "@/shared/admin-platform.types";

export const BUDGET_DEFINITION =
  "Indisponível: o banco não guarda orçamento da campanha. O valor comprometido é o substituto honesto.";

export const UNAVAILABLE_BUDGET: AdminFigure = {
  value: null,
  unit: "brl_cents",
  kind: "unavailable",
  definition: BUDGET_DEFINITION,
};

export function makeCampaign(overrides: Partial<AdminCampaignListItem> = {}): AdminCampaignListItem {
  return {
    id: "ca3b0000-0000-4000-8000-000000000006",
    title: "Festival Café Serra Verde",
    banner: null,
    status: "published",
    payment_method: "fixed",
    created_at: "2026-10-12T15:00:00.000Z",
    workspace: { id: "7a1e0000-0000-4000-8000-000000000002", name: "Café Serra Verde", status: "active" },
    workspace_owner: { user_id: 30, name: "Ana Santana", email: "ana.santana@serraverde.test" },
    max_influencers: 10,
    participants: { total: 12, participating: 8 },
    deliveries_published: 3,
    pending_actions: 2,
    committed_cents: 6_500_012,
    released_cents: 120_050,
    budget: UNAVAILABLE_BUDGET,
    ...overrides,
  };
}

export const SECOND_CAMPAIGN = makeCampaign({
  id: "ca3b0000-0000-4000-8000-000000000003",
  title: "Novidades da temporada",
  status: "finished",
  payment_method: "swap",
  created_at: "2026-08-01T12:00:00.000Z",
  workspace: { id: "7a1e0000-0000-4000-8000-000000000004", name: "Aurora Beauty Studio", status: "suspended" },
  workspace_owner: null,
  participants: { total: 3, participating: 0 },
  deliveries_published: 0,
  pending_actions: 0,
  committed_cents: 0,
  released_cents: 0,
});

export const CAMPAIGN_DEFINITIONS: Record<string, string> = {
  workspace_owner: 'Não existe "responsável pela campanha" no banco: este é o dono do workspace.',
  participants: "Total = todas as participações; em andamento = os 14 estados que ocupam vaga.",
  deliveries_published: 'Conteúdos com status "publicado".',
  pending_actions: "Participações aguardando ação do time do cliente.",
  committed_cents: "Reservas em aberto desta campanha (influencer_balance_entries com status reserved).",
  released_cents: 'Valor liberado a criadores desta campanha (pending_release + available + withdrawn). Não é "pago via PIX".',
  budget: BUDGET_DEFINITION,
};

export function pageOf<T>(data: T[], meta: Partial<AdminPageMeta> = {}): AdminListResult<T> {
  return {
    data,
    meta: { page: 1, per_page: 25, total: data.length, total_pages: data.length > 0 ? 1 : 0, ...meta },
  };
}

export function makeCampaignDetail(overrides: Partial<AdminCampaignDetail> = {}): AdminCampaignDetail {
  return {
    ...makeCampaign(),
    description: "Campanha de lançamento de produto da Café Serra Verde.\nOs criadores recebem o briefing.",
    objective: "Lançamento de produto",
    registration_deadline: "2026-11-20",
    mural_active: true,
    steps: [
      { order: 2, objective: "Publicação do conteúdo", publish_date: "2026-11-15T15:00:00.000Z" },
      { order: 1, objective: "Roteiro e aprovação", publish_date: "2026-10-18T15:00:00.000Z" },
      { order: 3, objective: "Relatório final", publish_date: null },
    ],
    participations_by_status: {
      approved: 3,
      awaiting_content: 2,
      awaiting_content_approval: 1,
      published: 2,
      completed: 1,
      mystery_status: 1,
    },
    figures: {
      committed: {
        value: 6_500_012,
        unit: "brl_cents",
        kind: "committed",
        definition: "Reservas em aberto desta campanha. É compromisso, não pagamento.",
      },
      released: {
        value: 120_050,
        unit: "brl_cents",
        kind: "realized",
        definition: 'Valor liberado a criadores desta campanha. Não é "pago via PIX".',
      },
      paid_pix: {
        value: 0,
        unit: "brl_cents",
        kind: "realized",
        definition: "Parte do liberado que já virou PIX concluído.",
      },
    },
    ...overrides,
  };
}
