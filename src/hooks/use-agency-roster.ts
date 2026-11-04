import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import {
  getAgencyRoster,
  inviteToRoster,
  removeFromRoster,
  setRosterExclusive,
  ROSTER_ERROR_MESSAGES,
  type RosterStatus,
} from "@/shared/services/agency-roster";

/** Mensagem para a pessoa: o código da API vira texto claro; o resto cai na mensagem do servidor. */
export function rosterErrorMessage(error: unknown, fallback: string): string {
  const e = error as { error?: string; message?: string; data?: { error?: string } } | null;
  const code = e?.error ?? e?.data?.error;
  if (code && ROSTER_ERROR_MESSAGES[code]) return ROSTER_ERROR_MESSAGES[code];
  return e?.message || fallback;
}

/** Elenco da agência (convidados e ativos; `status` filtra um estado). Só busca em workspace de agência. */
export function useAgencyRoster(status?: RosterStatus, options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceQueryKey();
  const isAgency = useIsAgencyWorkspace();
  return useQuery({
    queryKey: withWorkspaceKey(["agency-roster", status ?? "live"], workspaceId),
    queryFn: () => getAgencyRoster(status),
    enabled: options?.enabled !== false && isAgency && !!workspaceId,
  });
}

/** `user_id` do criador -> estado do vínculo vivo (`invited` | `active`), para marcar os cartões do catálogo. */
export function useRosterStatusMap(): ReadonlyMap<number, "invited" | "active"> {
  const { data } = useAgencyRoster();
  return useMemo(() => {
    const map = new Map<number, "invited" | "active">();
    for (const m of data ?? []) {
      if (m.status === "invited" || m.status === "active") map.set(m.creator.id, m.status);
    }
    return map;
  }, [data]);
}

function useInvalidateRoster() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["agency-roster"] });
}

export function useInviteToRoster() {
  const invalidate = useInvalidateRoster();
  return useMutation({ mutationFn: (userId: number) => inviteToRoster(userId), onSuccess: invalidate });
}

export function useRemoveFromRoster() {
  const invalidate = useInvalidateRoster();
  return useMutation({ mutationFn: (rosterId: string) => removeFromRoster(rosterId), onSuccess: invalidate });
}

export function useSetRosterExclusive() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: ({ rosterId, exclusive }: { rosterId: string; exclusive: boolean }) => setRosterExclusive(rosterId, exclusive),
    onSuccess: invalidate,
  });
}
