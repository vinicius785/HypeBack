/**
 * Consultas e estado de URL das campanhas globais do Admin (`/admin/campaigns`).
 *
 * A lista é a do contrato (`AdminCampaignListQuery`): busca, status, modalidade de pagamento, workspace, período de
 * criação e ordenação, tudo na URL. O que vem da URL é revalidado em `validateAdminCampaignsSearch`: um valor
 * fora do contrato (status inventado, data inexistente, workspace que não é UUID) sai da busca em vez de virar um
 * filtro que a tela não mostra ou uma consulta que o servidor recusa com 400.
 */
import type { UseQueryResult } from "@tanstack/react-query";

import { adminPath, adminPost, type AdminListResult, type AdminQuery } from "@/lib/admin/admin-client";
import {
  createAdminListSearchValidator,
  type AdminListSearch,
  type AdminListStateConfig,
} from "@/lib/admin/list-query";
import type {
  AdminCampaignDeleteBody,
  AdminCampaignDetail,
  AdminCampaignListItem,
  AdminCampaignStatus,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { useAdminItem, useAdminList } from "./use-admin-queries";

export const ADMIN_CAMPAIGN_STATUSES = ["draft", "published", "finished"] as const satisfies readonly AdminCampaignStatus[];

export type AdminCampaignFilterKey = "status" | "payment_method" | "workspace_id" | "created_from" | "created_to";

export const ADMIN_CAMPAIGN_LIST_CONFIG = {
  filterKeys: ["status", "payment_method", "workspace_id", "created_from", "created_to"],
  /** Ordenações do contrato (`sort_by`). */
  sortKeys: ["created_at", "title", "creators", "committed", "released"],
  defaultSortBy: "created_at",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig<AdminCampaignFilterKey>;

export type AdminCampaignsSearch = AdminListSearch<AdminCampaignFilterKey>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `YYYY-MM-DD` de um dia que existe (31/02 não existe). */
function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const baseValidator = createAdminListSearchValidator(ADMIN_CAMPAIGN_LIST_CONFIG);

/**
 * `validateSearch` da rota da lista: o objeto de busca só leva valores que a tela e o servidor entendem.
 *
 * O roteador junta a busca crua da URL com o que o validador devolve (`{ ...crua, ...validada }`), então um valor
 * recusado precisa voltar como `undefined` de propósito: tirar a chave do objeto deixaria o valor da URL passar.
 */
export function validateAdminCampaignsSearch(raw: Record<string, unknown>): AdminCampaignsSearch {
  const search = { ...baseValidator(raw) };
  const refuse = (key: AdminCampaignFilterKey) => {
    search[key] = undefined;
  };
  if (!search.status || !(ADMIN_CAMPAIGN_STATUSES as readonly string[]).includes(search.status)) refuse("status");
  if (!search.workspace_id || !UUID.test(search.workspace_id)) refuse("workspace_id");
  if (!search.created_from || !isCivilDate(search.created_from)) refuse("created_from");
  if (!search.created_to || !isCivilDate(search.created_to)) refuse("created_to");
  // Intervalo invertido (digitado na URL): o fim acompanha o começo, como nos campos de data.
  if (search.created_from && search.created_to && search.created_from > search.created_to) {
    search.created_to = search.created_from;
  }
  return search;
}

/** `GET /admin/campaigns`: a página da lista, no formato `{ data, meta }`. */
export function useAdminCampaigns(params: AdminQuery): UseQueryResult<AdminListResult<AdminCampaignListItem>, unknown> {
  return useAdminList<AdminCampaignListItem>({ resource: "campaigns", path: "/admin/campaigns", params });
}

/** `GET /admin/campaigns/:campaignId` (public_id). */
export function useAdminCampaign(campaignId: string): UseQueryResult<AdminCampaignDetail, unknown> {
  return useAdminItem<AdminCampaignDetail>({
    resource: "campaigns",
    id: campaignId,
    path: adminPath`/admin/campaigns/${campaignId}`,
    enabled: campaignId !== "",
  });
}

/**
 * Exclui a campanha para sempre (`POST /admin/campaigns/:campaignId/delete`, corpo com `reason` e `confirm_title`).
 * A `Idempotency-Key` é uma por intenção. No sucesso saem do cache a lista e o detalhe da campanha, as campanhas do
 * workspace, a trilha de auditoria, o feed de atividades e os números da visão geral.
 */
export function useAdminDeleteCampaign(campaignId: string) {
  return useAdminMutation<{ id: string; title: string }, AdminCampaignDeleteBody>({
    mutationFn: (body, idempotencyKey) =>
      adminPost<{ id: string; title: string }>(adminPath`/admin/campaigns/${campaignId}/delete`, body, { idempotencyKey }),
    invalidate: [
      adminKeys.resource("campaigns"),
      adminKeys.resource("workspaces"),
      adminKeys.resource("audit-log"),
      adminKeys.resource("activity"),
      adminKeys.of("overview"),
    ],
  });
}
