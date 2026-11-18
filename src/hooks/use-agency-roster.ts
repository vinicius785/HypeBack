import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import {
  answerRosterCounter,
  deleteRosterChat,
  getAgencyRoster,
  getAvailableCreators,
  inviteToRoster,
  listRosterChat,
  removeFromRoster,
  sendRosterChat,
  setRosterExclusive,
  ROSTER_ERROR_MESSAGES,
  type RosterChatBody,
  type RosterCounterAnswer,
  type RosterStatus,
} from "@/shared/services/agency-roster";

/** Mensagem para a pessoa: o código da API vira texto claro; o resto cai na mensagem do servidor. */
export function rosterErrorMessage(error: unknown, fallback: string): string {
  const e = error as { error?: string; code?: string; bodyCode?: string; message?: string; data?: { error?: string } } | null;
  for (const code of [e?.bodyCode, e?.code, e?.error, e?.data?.error]) {
    if (code && ROSTER_ERROR_MESSAGES[code]) return ROSTER_ERROR_MESSAGES[code];
  }
  return e?.message || fallback;
}

/** A comissão foi recusada pela API (`invalid_commission`): o erro vai no campo da comissão, com o texto da própria API. */
export function isInvalidCommission(error: unknown): boolean {
  return (error as { bodyCode?: string } | null)?.bodyCode === "invalid_commission";
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

/** Criadores querendo agência, de 20 em 20. Fica sob `agency-roster`: convidar invalida o elenco e esta lista juntos. */
export function useAvailableCreators(query: string, options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceQueryKey();
  const isAgency = useIsAgencyWorkspace();
  return useInfiniteQuery({
    queryKey: withWorkspaceKey(["agency-roster", "available", query.trim()], workspaceId),
    queryFn: ({ pageParam }) => getAvailableCreators({ q: query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.page + 1 : undefined),
    enabled: options?.enabled !== false && isAgency && !!workspaceId,
  });
}

function useInvalidateRoster() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["agency-roster"] });
}

export function useInviteToRoster() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: ({ userId, commissionPercent }: { userId: number; commissionPercent: number }) => inviteToRoster(userId, commissionPercent),
    onSuccess: invalidate,
  });
}

/** Aceitar, recusar ou fazer nova oferta à proposta de comissão do criador. */
export function useAnswerRosterCounter() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: ({ rosterId, answer }: { rosterId: string; answer: RosterCounterAnswer }) => answerRosterCounter(rosterId, answer),
    onSuccess: invalidate,
  });
}

/** Tempo entre consultas da conversa: sem tempo real, a tela pergunta de ~8 em 8 segundos enquanto está aberta. */
export const ROSTER_CHAT_POLL_MS = 8_000;

export function useRosterChat(rosterId: string | null) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["agency-roster-chat", rosterId], workspaceId),
    queryFn: () => listRosterChat(rosterId as string),
    enabled: !!rosterId && !!workspaceId,
    refetchInterval: ROSTER_CHAT_POLL_MS,
    // A tela aberta é quem consulta; em segundo plano o React Query pausa.
    refetchIntervalInBackground: false,
  });
}

export function useRosterChatMutations(rosterId: string) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["agency-roster-chat"] });
  return {
    send: useMutation({ mutationFn: (body: RosterChatBody) => sendRosterChat(rosterId, body), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (messageId: string) => deleteRosterChat(rosterId, messageId), onSuccess: refresh }),
  };
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
