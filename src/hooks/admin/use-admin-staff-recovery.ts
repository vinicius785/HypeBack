/**
 * Código de recuperação de senha da equipe (`POST /admin/users/:userId/staff-recovery-code`).
 *
 * Exige o código de 6 dígitos do Google Authenticator de quem aprova (`approval_code`, uso único). O código de recuperação
 * sai UMA vez nesta resposta e é segredo: o resultado NÃO fica no cache do React Query (`gcTime: 0`), nem em storage, URL,
 * log ou analytics; o código do Authenticator digitado também não. Quem chama guarda o código só em estado local do diálogo e o descarta ao fechar.
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

/** Quem recebe o código e o código do Google Authenticator (6 dígitos) de quem aprova: o segundo fator da geração. */
export interface IssueStaffRecoveryInput {
  userId: number;
  approvalCode: string;
}

export function useIssueStaffRecoveryCode() {
  return useMutation<StaffRecoveryCode, unknown, IssueStaffRecoveryInput>({
    // Nada de guardar segredo no cache de mutações (nem o código gerado, nem o do Authenticator digitado).
    gcTime: 0,
    // Cada clique é uma intenção nova: gerar outro código invalida o anterior, então a chave nunca é reaproveitada.
    mutationFn: ({ userId, approvalCode }) =>
      adminPost<StaffRecoveryCode>(staffRecoveryCodePath(userId), { approval_code: approvalCode }, { idempotencyKey: newIdempotencyKey() }),
  });
}
