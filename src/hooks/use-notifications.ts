import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markChatNotificationsAsRead,
  type Notification,
} from "@/shared/services/notifications";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

/**
 * Hook para buscar notificações do usuário
 */
export function useNotifications() {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["notifications"], workspaceId),
    queryFn: getNotifications,
    enabled: !!workspaceId,
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Refetch a cada minuto
  });
}

/**
 * Hook para marcar notificação como lida
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      // Invalidar queries de notificações para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Hook para marcar todas as notificações como lidas
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      // Invalidar queries de notificações para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Marca as notificações de chat de uma conversa como lidas (#19: sino não
 * limpava ao ler a mensagem). Best-effort — falha não pode travar o chat.
 */
export function useMarkChatNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markChatNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Hook para obter contagem de notificações não lidas
 */
export function useUnreadNotificationsCount(): number {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter((n: Notification) => !n.read_at).length;
}
