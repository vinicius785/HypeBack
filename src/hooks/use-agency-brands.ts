import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import {
  createAgencyBrand,
  getAgencyBrands,
  setAgencyBrandStatus,
  uploadAgencyBrandPhoto,
  updateAgencyBrand,
  type AgencyBrandInput,
  type AgencyBrandStatus,
} from "@/shared/services/agency-brands";

/** `true` quando o workspace selecionado é de agência (a API antiga não manda o tipo: vale `brand`). */
export function useIsAgencyWorkspace(): boolean {
  return useWorkspaceContext().selectedWorkspace?.account_type === "agency";
}

/** Marcas que a pessoa enxerga na agência. Só busca em workspace de agência (nos outros a API responde 403). */
export function useAgencyBrands(options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceQueryKey();
  const isAgency = useIsAgencyWorkspace();
  return useQuery({
    queryKey: withWorkspaceKey(["agency-brands"], workspaceId),
    queryFn: getAgencyBrands,
    enabled: options?.enabled !== false && isAgency && !!workspaceId,
  });
}

function useInvalidateBrands() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["agency-brands"] });
    // O contador de campanhas e o selo da marca nas campanhas dependem das marcas.
    void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  };
}

export function useCreateAgencyBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({ mutationFn: (input: AgencyBrandInput) => createAgencyBrand(input), onSuccess: invalidate });
}

export function useUpdateAgencyBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: ({ brandId, input }: { brandId: string; input: Partial<AgencyBrandInput> }) =>
      updateAgencyBrand(brandId, input),
    onSuccess: invalidate,
  });
}

export function useSetAgencyBrandStatus() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: ({ brandId, status }: { brandId: string; status: AgencyBrandStatus }) =>
      setAgencyBrandStatus(brandId, status),
    onSuccess: invalidate,
  });
}

export function useUploadAgencyBrandPhoto() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: ({ brandId, file }: { brandId: string; file: File }) => uploadAgencyBrandPhoto(brandId, file),
    onSuccess: invalidate,
  });
}
