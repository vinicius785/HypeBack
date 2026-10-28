import { apiGet, apiPost } from "@/lib/http-client";

export interface WorkspaceBalance {
  balance_cents: number;
  committed_cents: number;
  available_cents: number;
}

export interface TopUpResult {
  charge_id: string;
  amount_cents: number;
  amount: string;
  pix_qr_code: string;
  pix_copy_paste: string;
  expires_at: string;
  status: "pending";
}

export async function getWorkspaceBalance(workspaceId: string): Promise<WorkspaceBalance> {
  return apiGet<WorkspaceBalance>(`/balance/workspace/${workspaceId}`);
}

export async function topUpWorkspace(
  workspaceId: string,
  amount_cents: number,
): Promise<TopUpResult> {
  return apiPost<TopUpResult>(`/balance/workspace/${workspaceId}/top-up`, { amount_cents });
}

// Disponível apenas em ambiente sandbox — retorna 403 em produção
export async function simulatePayment(workspaceId: string): Promise<void> {
  return apiPost<void>(`/balance/workspace/${workspaceId}/simulate-payment`);
}
