import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/http-client";

export type AgencyBrandStatus = "active" | "archived";

/** Marca de uma agência (`/backoffice/agency/brands`). */
export interface AgencyBrand {
  id: string;
  name: string;
  photo: string | null;
  description: string | null;
  /** Cadastro da marca (mesmos campos de um workspace); `null` quando não preenchido. */
  niche_id: number | null;
  legal_name: string | null;
  tax_id: string | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  unit: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: AgencyBrandStatus;
  campaigns_count: number;
  created_at: string;
}

export interface AgencyBrandInput {
  name: string;
  photo?: string | null;
  description?: string | null;
  niche_id?: number | null;
  legal_name?: string | null;
  /** Só dígitos (14). */
  tax_id?: string | null;
  /** Só dígitos (8). */
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  /** Sigla de 2 letras. */
  state?: string | null;
}

/** Tipos e tamanho aceitos pela API para a logo (a mesma regra da foto do workspace). */
export const BRAND_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const BRAND_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Códigos de erro que a API devolve para marcas (campo `error` da resposta). */
export const AGENCY_BRAND_ERROR_MESSAGES: Record<string, string> = {
  BRAND_NAME_TAKEN: "Já existe uma marca ativa com esse nome nesta agência.",
  AGENCY_ONLY: "Marcas existem só em workspaces de agência.",
  BRAND_REQUIRED: "Escolha a marca da campanha.",
  BRAND_ARCHIVED: "Essa marca está arquivada.",
  BRAND_FORBIDDEN: "Você não tem acesso a essa marca.",
  BRAND_NOT_IN_AGENCY: "Essa marca não pertence a esta agência.",
  BRAND_LOCKED: "A marca só pode ser trocada enquanto a campanha é rascunho.",
};

export function getAgencyBrands(): Promise<AgencyBrand[]> {
  return apiGet<AgencyBrand[]>("/agency/brands");
}

export function createAgencyBrand(input: AgencyBrandInput): Promise<AgencyBrand> {
  return apiPost<AgencyBrand>("/agency/brands", input);
}

export function updateAgencyBrand(brandId: string, input: Partial<AgencyBrandInput>): Promise<AgencyBrand> {
  return apiPut<AgencyBrand>(`/agency/brands/${brandId}`, input);
}

export function setAgencyBrandStatus(brandId: string, status: AgencyBrandStatus): Promise<AgencyBrand> {
  return apiPatch<AgencyBrand>(`/agency/brands/${brandId}/status`, { status });
}

/** Envia a logo da marca (multipart). Devolve a marca com a nova foto. */
export async function uploadAgencyBrandPhoto(brandId: string, file: File): Promise<AgencyBrand> {
  const form = new FormData();
  form.append("photo", file);
  const workspaceId = getWorkspaceId();
  const res = await fetch(getApiUrl(`/agency/brands/${brandId}/photo`), {
    method: "POST",
    headers: {
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      ...(workspaceId ? { "Workspace-Id": workspaceId } : {}),
    },
    body: form,
  });
  const body = (await res.json().catch(() => null)) as { data?: AgencyBrand; message?: string } | null;
  if (!res.ok || !body?.data) {
    throw new Error(body?.message || "Não foi possível enviar a logo.");
  }
  return body.data;
}
