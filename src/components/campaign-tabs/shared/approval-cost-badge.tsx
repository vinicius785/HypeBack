import { Icon } from "@/components/ui/icon";

import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { fmtBRL } from "./prices-utils";

interface ApprovalCostBadgeProps {
  /**
   * Custo de aprovação em centavos (BRL).
   *  - `null` → indeterminado (ex.: price mode sem prices definidos; falta backend).
   *  - número → exibido em formato BRL.
   */
  costCents: number | null;
  /**
   * Quando `true`, este card alone caberia no saldo. Quando `false`, mostra
   * estado de "Saldo insuficiente". `undefined` → ainda calculando.
   */
  canApprove?: boolean;
  /** Motivo do bloqueio (usado como tooltip). Geralmente "Saldo insuficiente". */
  reason?: string | null;
  /** Skeleton enquanto os dados de saldo/custo carregam. */
  isLoading?: boolean;
}

/**
 * Badge exibida no card mostrando o custo de aprovação em BRL.
 *
 * Sem dependência de blockchain — opera só com centavos BRL (do dict de
 * prices do influenciador ou do form de preço fixo da campanha) e com o
 * saldo real do workspace (`/balance/workspace/{id}`).
 *
 * Estados:
 *  - `isLoading` → skeleton
 *  - `costCents === null` → "A definir" (caller já decidiu que não há cálculo possível)
 *  - `canApprove === false` → badge vermelha "Saldo insuficiente" + tooltip
 *  - resto → badge azul com o valor formatado
 */
export function ApprovalCostBadge({
  costCents,
  canApprove,
  reason,
  isLoading,
}: ApprovalCostBadgeProps) {
  const { influencer_values_read } = useWorkspacePermissions();

  // Custo de aprovação deriva do preço do criador → oculto sem permissão de
  // ver valores. O bloqueio de aprovação por saldo continua sendo aplicado
  // pelo componente pai (disableApprove) e pelo backend.
  if (!influencer_values_read) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-primary-50">
        <span className="text-xs font-medium text-primary-700">
          Custo de aprovação
        </span>
        <span className="skeleton h-4 w-20 rounded" />
      </div>
    );
  }

  const blocked = canApprove === false;
  const wrapperClass = blocked
    ? "flex items-center justify-between rounded-xl bg-danger-50"
    : "flex items-center justify-between rounded-xl bg-primary-50";
  const textClass = blocked ? "text-danger-700" : "text-primary-700";
  const valueText =
    costCents == null ? "A definir" : fmtBRL(costCents);

  return (
    <div
      className={wrapperClass}
      title={blocked ? (reason ?? "Saldo insuficiente") : undefined}
    >
      <span className={`flex items-center gap-1.5 text-xs font-medium ${textClass}`}>
        {blocked && <Icon name="TriangleAlert" size={14} color="#b91c1c" />}
        {blocked ? "Saldo insuficiente" : "Custo de aprovação"}
      </span>
      <span className={`text-base font-semibold tabular-nums ${textClass}`}>
        {valueText}
      </span>
    </div>
  );
}
