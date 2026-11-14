/**
 * Operação Escudo (`/admin/security/shield`): estado, o que ficou retido e as três ações (ativar, encerrar, liberar).
 * As rotas do Escudo são isentas do `X-Shield-Code`: aqui o código vai NO CORPO, digitado na janela de cada ação, e não é
 * guardado (nem em cache, nem em armazenamento, nem em log).
 */
import { useQueryClient } from "@tanstack/react-query";

import { adminPostPlain } from "@/lib/admin/admin-client";
import type { ShieldActivateBody, ShieldHeld, ShieldReleaseBody, ShieldReleased, ShieldStatus } from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useMutation } from "@tanstack/react-query";
import { ADMIN_SECURITY_RESOURCE, useCanUseSecurity } from "./use-admin-security";
import { useAdminItem } from "./use-admin-queries";

const BASE = "/admin/security/shield";

/** O estado se atualiza a cada 60 s (o React Query pausa enquanto a aba está escondida). */
export const SHIELD_REFRESH_MS = 60_000;

/** `GET shield`. Só o administrador da plataforma consulta. */
export function useShield() {
  const canUse = useCanUseSecurity();
  return useAdminItem<ShieldStatus>({
    resource: ADMIN_SECURITY_RESOURCE,
    scope: ["shield"],
    path: BASE,
    enabled: canUse,
    staleTime: 15_000,
    refetchInterval: SHIELD_REFRESH_MS,
  });
}

/** `GET shield/held`: contas em análise e saques em espera (aparece mesmo com o Escudo desligado). */
export function useShieldHeld() {
  const canUse = useCanUseSecurity();
  return useAdminItem<ShieldHeld>({
    resource: ADMIN_SECURITY_RESOURCE,
    scope: ["shield-held"],
    path: `${BASE}/held`,
    enabled: canUse,
    staleTime: 15_000,
  });
}

function useShieldMutation<TData, TBody>(path: string) {
  const queryClient = useQueryClient();
  return useMutation<TData, unknown, TBody>({
    mutationFn: (body) => adminPostPlain<TData>(path, body),
    // Qualquer ação do Escudo muda o estado, as retenções, os alertas e o sino: recarrega a segurança toda. Contas e
    // saques liberados também mudam as listas de Pessoas.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_SECURITY_RESOURCE) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.resource("users") });
    },
  });
}

export function useActivateShield() {
  return useShieldMutation<ShieldStatus, ShieldActivateBody>(`${BASE}/activate`);
}

export function useDeactivateShield() {
  return useShieldMutation<ShieldStatus, { code: string }>(`${BASE}/deactivate`);
}

export function useReleaseShield() {
  return useShieldMutation<ShieldReleased, ShieldReleaseBody>(`${BASE}/release`);
}
