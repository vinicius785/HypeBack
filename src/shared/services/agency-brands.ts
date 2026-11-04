import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/http-client";

export type AgencyBrandStatus = "active" | "archived";

/** Marca de uma agência (`/backoffice/agency/brands`). */
export interface AgencyBrand {
  id: string;
  name: string;
  photo: string | null;
  description: string | null;
  status: AgencyBrandStatus;
  campaigns_count: number;
  created_at: string;
}

export interface AgencyBrandInput {
  name: string;
  photo?: string | null;
  description?: string | null;
}

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
