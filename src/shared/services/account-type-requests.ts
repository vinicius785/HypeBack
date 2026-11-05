import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import { buildApiError } from "@/lib/workspace-state/api-error";

export type AccountType = "brand" | "agency";
export type AccountTypeRequestStatus = "pending" | "approved" | "rejected";

/** Pedido de troca do tipo de conta (`GET /workspaces/:id/account-type-requests` e as rotas do Admin). */
export interface AccountTypeRequest {
  id: string;
  status: AccountTypeRequestStatus;
  current_type: AccountType;
  requested_type: AccountType;
  justification: string;
  requested_at: string;
  requested_by: { id: number | null; name: string | null; email: string | null };
  decided_at: string | null;
  decided_by: { id: number | null; name: string | null } | null;
  /** Motivo da rejeição (ou observação da aprovação). */
  decision_reason: string | null;
  workspace: { id: string; name: string; photo: string | null; account_type: AccountType };
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = { brand: "Marca", agency: "Agência" };
export const ACCOUNT_REQUEST_STATUS_LABEL: Record<AccountTypeRequestStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export const JUSTIFICATION_MIN = 10;
export const JUSTIFICATION_MAX = 1000;

const headers = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "Client-Type": "backoffice",
  Authorization: `Bearer ${getAuthToken()}`,
});

async function failure(request: Response, fallback: string): Promise<never> {
  const body = await request.json().catch(() => ({}));
  throw buildApiError(request.status, body, fallback);
}

/** Histórico de pedidos do workspace, do mais novo para o mais antigo. API sem a rota (404) = nenhum pedido. */
export async function listAccountTypeRequests(workspaceId: string): Promise<AccountTypeRequest[]> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/account-type-requests`), { headers: headers() });
  if (request.status === 404) return [];
  if (!request.ok) return failure(request, "Não foi possível carregar as solicitações.");
  const body = (await request.json().catch(() => ({}))) as { data?: unknown };
  return Array.isArray(body.data) ? (body.data as AccountTypeRequest[]) : [];
}

export async function createAccountTypeRequest(
  workspaceId: string,
  input: { requested_type: AccountType; justification: string },
): Promise<AccountTypeRequest> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/account-type-requests`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ requested_type: input.requested_type, justification: input.justification.trim() }),
  });
  if (!request.ok) return failure(request, "Não foi possível enviar a solicitação.");
  const body = (await request.json()) as { data: AccountTypeRequest };
  return body.data;
}
