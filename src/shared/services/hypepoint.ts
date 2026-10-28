/**
 * Hypepoint API client — endpoints de `/backoffice/blockchain/hypepoint/*`.
 *
 * Cobre:
 *  - GET  /info        → metadados consolidados (DB + on-chain)
 *  - GET  /balance     → saldo da admin wallet
 *  - GET  /operations  → histórico paginado
 *  - POST /transfer    → debita admin para user (custodial) ou endereço externo
 */
import { apiGet, apiPost } from "@/lib/http-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HypepointInfo {
  id: number;
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  managerFactoryAddress: string | null;
  deployTxHash: string | null;
  isPaused: boolean;
  workspaceId: number | null;
  createdAt: string;
  totalSupply: string;
  totalSupplyFormatted: string;
  onChainPaused: boolean;
  owner: string | null;
}

export interface HypepointBalance {
  tokenId: number;
  tokenAddress: string;
  chainId: number;
  symbol: string;
  decimals: number;
  walletAddress: string;
  raw: string;
  formatted: string;
}

export type HypepointOperationStatus = "pending" | "confirmed" | "failed";

export interface HypepointOperation {
  operationId: number;
  opType: string;
  status: HypepointOperationStatus;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string;
  chainId: number;
  txHash: string | null;
  blockNumber: string | null;
  errorMessage: string | null;
  tokenId: number | null;
  walletId: number | null;
  campaignUserId: number | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface TransferHypepointPayload {
  to_user_id?: number;
  to_address?: string;
  amount: string;
  campaign_user_id?: number;
  idempotency_key?: string;
}

export interface TransferHypepointResult {
  operationId: number;
  paymentId: number | null;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  toUserId: number | null;
  amount: string;
  amountFormatted: string;
  symbol: string;
  chainId: number;
  status: HypepointOperationStatus;
  explorerUrl: string | null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function getHypepointInfo(): Promise<HypepointInfo> {
  const res = await apiGet<{ token: HypepointInfo }>(
    "/blockchain/hypepoint/info",
  );
  return res.token;
}

export async function getHypepointBalance(): Promise<HypepointBalance> {
  const res = await apiGet<{ balance: HypepointBalance }>(
    "/blockchain/hypepoint/balance",
  );
  return res.balance;
}

export async function listHypepointOperations(
  limit = 20,
): Promise<HypepointOperation[]> {
  const res = await apiGet<{ operations: HypepointOperation[] }>(
    `/blockchain/hypepoint/operations?limit=${limit}`,
  );
  return res.operations;
}

export async function transferHypepoint(
  payload: TransferHypepointPayload,
): Promise<TransferHypepointResult> {
  const res = await apiPost<{ operation: TransferHypepointResult }>(
    "/blockchain/hypepoint/transfer",
    payload,
  );
  return res.operation;
}
