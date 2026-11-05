/**
 * Suporte no Admin: lista com filtros e contagens (`meta.counts`), detalhe com a conversa, mudança de status/prioridade/
 * responsável e resposta (ou nota interna). Rotas: `/admin/support/tickets`.
 */
import { adminPatch, adminPath, adminPost } from "@/lib/admin/admin-client";
import type {
  SupportCounts,
  SupportMessage,
  SupportPriority,
  SupportSource,
  SupportStatus,
  SupportStatusFilter,
  SupportTicket,
  SupportTicketDetail,
  SupportCategory,
} from "@/shared/services/admin-support";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { useAdminItem, useAdminList } from "./use-admin-queries";

export const ADMIN_SUPPORT_RESOURCE = "support-tickets";

export interface SupportListParams {
  status: SupportStatusFilter;
  source?: SupportSource;
  priority?: SupportPriority;
  assigned?: "me" | "none";
  q?: string;
  page: number;
  per_page: number;
}

export function useAdminSupportTickets(params: SupportListParams) {
  return useAdminList<SupportTicket>({ resource: ADMIN_SUPPORT_RESOURCE, path: "/admin/support/tickets", params: { ...params }, refetchInterval: 60_000 });
}

/** As contagens vêm dentro do `meta` da lista (ausentes em API antiga). */
export function supportCounts(meta: unknown): SupportCounts | null {
  const counts = (meta as { counts?: SupportCounts } | undefined)?.counts;
  return counts && counts.by_status && counts.by_source ? counts : null;
}

export function useAdminSupportTicket(ticketId: string | null) {
  return useAdminItem<SupportTicketDetail>({
    resource: ADMIN_SUPPORT_RESOURCE,
    id: ticketId ?? "",
    path: ticketId ? adminPath`/admin/support/tickets/${ticketId}` : "",
    enabled: !!ticketId,
  });
}

const AFTER_CHANGE = [adminKeys.resource(ADMIN_SUPPORT_RESOURCE), adminKeys.resource("audit-log")] as const;

export interface SupportPatch {
  status?: SupportStatus;
  priority?: SupportPriority;
  category?: SupportCategory;
  assignee_id?: number | null;
}

export function useAdminUpdateSupportTicket(ticketId: string) {
  return useAdminMutation<SupportTicket, SupportPatch>({
    mutationFn: (body, idempotencyKey) => adminPatch<SupportTicket>(adminPath`/admin/support/tickets/${ticketId}`, body, { idempotencyKey }),
    invalidate: AFTER_CHANGE,
  });
}

export interface SupportMessageInput {
  body: string;
  kind: "reply" | "note";
  status?: SupportStatus;
}

export function useAdminSendSupportMessage(ticketId: string) {
  return useAdminMutation<SupportMessage, SupportMessageInput>({
    mutationFn: (body, idempotencyKey) => adminPost<SupportMessage>(adminPath`/admin/support/tickets/${ticketId}/messages`, body, { idempotencyKey }),
    invalidate: AFTER_CHANGE,
  });
}
