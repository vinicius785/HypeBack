/**
 * Notificações em tempo real do sininho (namespace socket `/notifications`).
 *
 * O backend emite `notification:new` para a sala do usuário sempre que uma linha
 * é inserida em `notifications` (trigger pg_notify → listener → socket). Ao
 * receber, revalidamos a query do sininho — reaproveita o fetch REST existente,
 * então título/contador/deep-link ficam consistentes sem duplicar shape.
 *
 * O polling de fallback em `use-notifications` continua ativo caso o socket caia.
 * Auth via Bearer no handshake, igual ao `use-live-socket`.
 */
import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

import { getAuthToken } from "@/lib/utils/api";

function getSocketBaseUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL as string;
  return serverUrl.replace(/\/api\/backoffice\/?$/, "");
}

export function useNotificationsSocket(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = getAuthToken();
    if (!token) return;

    const socket: Socket = io(`${getSocketBaseUrl()}/notifications`, {
      auth: { token: `Bearer ${token}` },
      reconnectionAttempts: 10,
    });

    const refresh = () => {
      // Prefixo → invalida a query do sininho de todos os workspaces em cache.
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("notification:new", refresh);

    return () => {
      socket.off("notification:new", refresh);
      socket.disconnect();
    };
  }, [enabled, queryClient]);
}
