import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { CampaignFormData } from "@/shared/types";

/**
 * Mantém `brandRequired` (o campo Marca) igual ao tipo do workspace A CADA mudança, e não só na montagem.
 * O contexto do workspace pode ainda estar carregando quando a tela abre (recarregar a página, abrir direto pelo
 * link): antes o valor nascia `false` e o campo Marca sumia até recarregar de novo.
 */
export function useSyncBrandRequired(isAgency: boolean, setFormData: Dispatch<SetStateAction<CampaignFormData>>): void {
  useEffect(() => {
    setFormData((prev) => (prev.brandRequired === isAgency ? prev : { ...prev, brandRequired: isAgency }));
  }, [isAgency, setFormData]);
}
