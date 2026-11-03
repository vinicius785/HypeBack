import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import { AdminRefreshButton } from "@/components/admin/platform";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_FINANCIAL_RESOURCE } from "@/hooks/admin/use-admin-financial";

/**
 * "Atualizar" do Financeiro: refaz as consultas da aba aberta (todas as do recurso `financial`). Só o ícone: vai
 * no fim da barra de filtros das listas e, na visão geral (sem barra), ao lado do seletor de período.
 */
export function FinancialRefreshButton() {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: adminKeys.resource(ADMIN_FINANCIAL_RESOURCE) }) > 0;
  return (
    <AdminRefreshButton
      iconOnly
      loading={fetching}
      onClick={() => void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_FINANCIAL_RESOURCE) })}
    />
  );
}
