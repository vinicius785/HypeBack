import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  cancelAdminNotification,
  createAdminNotification,
  estimateAdminAudience,
  fetchAdminCampaignLookup,
  fetchAdminNotificationDetail,
  fetchAdminNotificationsList,
  type AdminNotificationsListParams,
} from "@/shared/services/admin-notifications";
import type {
  AdminAudienceFilter,
  AdminNotificationCreatePayload,
} from "@/shared/types";

export const adminNotificationKeys = {
  all: ["admin", "notifications"] as const,
  list: (params: AdminNotificationsListParams) =>
    ["admin", "notifications", "list", params] as const,
  detail: (id: string) => ["admin", "notifications", "detail", id] as const,
  estimate: (audience: AdminAudienceFilter) =>
    ["admin", "notifications", "estimate", audience] as const,
};

export function useAdminNotificationsList(
  params: AdminNotificationsListParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: adminNotificationKeys.list(params),
    queryFn: () => fetchAdminNotificationsList(params),
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminNotificationDetail(
  id: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: adminNotificationKeys.detail(id ?? ""),
    queryFn: () => fetchAdminNotificationDetail(id as string),
    enabled: (options.enabled ?? true) && !!id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Estimativa de audiência é manual (acionada pelo botão "Calcular audiência"
 * no form). Usamos mutation em vez de query pra ter controle explícito do
 * disparo — não queremos refetch automático ao mudar filtros.
 */
export function useEstimateAdminAudience() {
  return useMutation({
    mutationFn: (audience: AdminAudienceFilter) =>
      estimateAdminAudience(audience),
  });
}

export function useCreateAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminNotificationCreatePayload) =>
      createAdminNotification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.all });
    },
  });
}

export function useAdminCampaignLookup(
  search: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["admin", "notifications", "campaign-lookup", search] as const,
    queryFn: () => fetchAdminCampaignLookup(search),
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useCancelAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAdminNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.all });
    },
  });
}
