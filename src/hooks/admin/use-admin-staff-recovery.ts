/**
 * Código de recuperação de senha da equipe (`POST /admin/users/:userId/staff-recovery-code`).
 *
 * O código sai UMA vez nesta resposta e é segredo: o resultado NÃO fica no cache do React Query (`gcTime: 0`), nem em
 * storage, URL, log ou analytics. Quem chama guarda o código só em estado local do diálogo e o descarta ao fechar.
 */
import { useMutation } from "@tanstack/react-query";

import { adminPath, adminPost, newIdempotencyKey } from "@/lib/admin/admin-client";

export interface StaffRecoveryCode {
  /** `XXXX-XXXX-XXXX`. Segredo: só para mostrar uma vez. */
  code: string;
  expires_in_minutes: number;
  user: { id: number; name: string; email: string };
}

export function staffRecoveryCodePath(userId: number): string {
  return adminPath`/admin/users/${userId}/staff-recovery-code`;
}

export function useIssueStaffRecoveryCode() {
  return useMutation<StaffRecoveryCode, unknown, number>({
    // Nada de guardar o segredo no cache de mutações depois que o diálogo o recebe.
    gcTime: 0,
    // Cada clique é uma intenção nova: gerar outro código invalida o anterior, então a chave nunca é reaproveitada.
    mutationFn: (userId) => adminPost<StaffRecoveryCode>(staffRecoveryCodePath(userId), undefined, { idempotencyKey: newIdempotencyKey() }),
  });
}
