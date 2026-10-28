import { apiGet, apiPost, apiPut } from "@/lib/http-client";
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type {
  CampaignContract,
  ContractType,
  ContractVariable,
  WorkspaceContractDefaults,
} from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Payload do POST `/campaigns/:id/contracts/send`.
 *
 * Convenções do backend (DTO `SendContractDto`):
 *  - `campaign_user_id`: public_id (UUID) de `campaign_users`, NÃO `users.id`.
 *  - `expiration_at`: ISO 8601 (não `expires_at`).
 *  - Campos da marca são FLAT (não aninhados em `brand`) e condicionais via
 *    `@ValidateIf(contract_type === 'platform')` — só obrigatórios no modo padrão.
 *  - `brand_cnpj`: aceita 14 dígitos (sem máscara) ou 18 com máscara.
 *  - `representative_cpf`: aceita 11 dígitos (sem máscara) ou 14 com máscara.
 */
export interface SendContractTemplateData {
  campaign_user_id: string;
  contract_type: ContractType;
  template_id?: string;
  expiration_at?: string;
  representative_email: string;
  witness_1_email: string;
  witness_2_email: string;
  /** Obrigatórios quando `contract_type === "platform"`. */
  brand_legal_name?: string;
  brand_cnpj?: string;
  brand_address?: string;
  representative_name?: string;
  representative_cpf?: string;
}

/**
 * Payload do upload próprio (multipart) — `contract_type` sempre `"custom"`.
 * Os campos da marca NÃO são exigidos: substituição de variáveis é feita pelo
 * próprio arquivo enviado.
 */
export interface UploadCustomContractData {
  campaign_user_id: string;
  file: File;
  expiration_at?: string;
  representative_email: string;
  witness_1_email: string;
  witness_2_email: string;
}

// ---------------------------------------------------------------------------
// Listagem / status
// ---------------------------------------------------------------------------

/** GET /campaigns/:id/contracts — lista contratos da campanha (filtros opcionais). */
export async function getCampaignContracts(
  campaignId: string,
  filters?: { status?: string; influencer_id?: string },
): Promise<CampaignContract[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.influencer_id) params.append("influencer_id", filters.influencer_id);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<CampaignContract[] | null>(
    `/campaigns/${campaignId}/contracts${query}`,
  );
  return data ?? [];
}

/** GET /campaigns/:id/contracts/:cid — status detalhado de um contrato. */
export async function getContractStatus(
  campaignId: string,
  contractId: string,
): Promise<CampaignContract> {
  return apiGet<CampaignContract>(
    `/campaigns/${campaignId}/contracts/${contractId}`,
  );
}

// ---------------------------------------------------------------------------
// Templates da plataforma
// ---------------------------------------------------------------------------

/** GET /contracts/templates — templates padrão cadastrados na plataforma. */
export async function getContractTemplates(): Promise<ContractTemplate[]> {
  const data = await apiGet<ContractTemplate[] | null>("/contracts/templates");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Envio / reenvio / upload
// ---------------------------------------------------------------------------

/**
 * POST /campaigns/:id/contracts/send — envia contrato padrão para o influenciador.
 * O e-mail do influenciador é resolvido pelo backend (cadastro do app mobile),
 * por isso não vai no payload.
 */
export async function sendContractTemplate(
  campaignId: string,
  data: SendContractTemplateData,
): Promise<CampaignContract> {
  return apiPost<CampaignContract>(
    `/campaigns/${campaignId}/contracts/send`,
    data,
  );
}

/**
 * POST /campaigns/:id/contracts/upload — upload de PDF/DOCX com substituição
 * de variáveis. Multipart porque carrega o arquivo binário.
 */
export async function uploadCustomContract(
  campaignId: string,
  data: UploadCustomContractData,
): Promise<CampaignContract> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("campaign_user_id", data.campaign_user_id);
  formData.append("contract_type", "custom");
  formData.append("representative_email", data.representative_email);
  formData.append("witness_1_email", data.witness_1_email);
  formData.append("witness_2_email", data.witness_2_email);
  if (data.expiration_at) formData.append("expiration_at", data.expiration_at);

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contracts/upload`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: formData,
    },
  );

  if (!request.ok) {
    let message = "Falha no upload do contrato";
    try {
      const body = await request.json();
      message = body?.message ?? body?.error ?? message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  const json = await request.json();
  return (json.data !== undefined ? json.data : json) as CampaignContract;
}

/** POST /campaigns/:id/contracts/:cid/resend — reenvia envelope existente. */
export async function resendContract(
  campaignId: string,
  contractId: string,
): Promise<void> {
  await apiPost<void>(
    `/campaigns/${campaignId}/contracts/${contractId}/resend`,
  );
}

/**
 * GET /campaigns/:id/contracts/:cid/download — retorna o PDF combinado assinado.
 * Dispara o download diretamente no browser (sem manter Blob em memória).
 */
export async function downloadSignedContract(
  campaignId: string,
  contractId: string,
  filename?: string,
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contracts/${contractId}/download`),
    {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
    },
  );

  if (!request.ok) {
    throw new Error(`Falha ao baixar contrato (${request.status})`);
  }

  const blob = await request.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `contrato-${contractId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Libera o objeto URL no próximo tick — manter sincrono pode cancelar o download em alguns browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---------------------------------------------------------------------------
// Variáveis e defaults do workspace
// ---------------------------------------------------------------------------

/** GET /contracts/variables — variáveis disponíveis para substituição no upload. */
export async function getContractVariables(): Promise<ContractVariable[]> {
  const data = await apiGet<ContractVariable[] | null>("/contracts/variables");
  return data ?? [];
}

/** GET /workspaces/:id/contract-defaults — defaults pré-preenchidos no modal. */
export async function getWorkspaceContractDefaults(
  workspaceId: string,
): Promise<WorkspaceContractDefaults> {
  return apiGet<WorkspaceContractDefaults>(
    `/workspaces/${workspaceId}/contract-defaults`,
  );
}

/** PUT /workspaces/:id/contract-defaults — upsert dos defaults após envio bem-sucedido. */
export async function upsertWorkspaceContractDefaults(
  workspaceId: string,
  payload: WorkspaceContractDefaults,
): Promise<WorkspaceContractDefaults> {
  return apiPut<WorkspaceContractDefaults>(
    `/workspaces/${workspaceId}/contract-defaults`,
    payload,
  );
}
