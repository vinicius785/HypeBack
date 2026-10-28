/**
 * Backoffice — gerência de holds (livro-razão off-chain de hypepoints).
 *
 * Endpoints `/backoffice/blockchain/holds/*`. State machine:
 *   reserved → awaiting_release → available → withdrawn
 *   reserved → cancelled
 */
import { apiGet, apiPatch, apiPost } from "@/lib/http-client";

import type { TransferHypepointResult } from "./hypepoint";

export type HoldStatus =
  | "reserved"
  | "awaiting_release"
  | "available"
  | "withdrawn"
  | "cancelled";

export interface Hold {
  id: number;
  campaignUserId: number;
  userId: number;
  campaignId: number;
  tokenId: number;
  amount: string;
  amountFormatted: string;
  currency: string;
  status: HoldStatus;
  reservedAt: string;
  awaitingReleaseAt: string | null;
  releaseDueAt: string | null;
  availableAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  withdrawalTokenOperationId: number | null;
  reservedByUserId: number | null;
  notes: string | null;
  createdAt: string;
}

export interface ReserveHoldPayload {
  campaign_user_id: number;
  amount: string;
  notes?: string;
}

export interface ListHoldsFilters {
  user_id?: number;
  campaign_id?: number;
  campaign_user_id?: number;
  status?: HoldStatus;
  limit?: number;
}

export async function listHolds(filters: ListHoldsFilters = {}): Promise<Hold[]> {
  const params = new URLSearchParams();
  if (filters.user_id != null) params.set("user_id", String(filters.user_id));
  if (filters.campaign_id != null)
    params.set("campaign_id", String(filters.campaign_id));
  if (filters.campaign_user_id != null)
    params.set("campaign_user_id", String(filters.campaign_user_id));
  if (filters.status) params.set("status", filters.status);
  if (filters.limit != null) params.set("limit", String(filters.limit));

  const qs = params.toString();
  const path = `/blockchain/holds${qs ? `?${qs}` : ""}`;
  const res = await apiGet<{ holds: Hold[] }>(path);
  return res.holds;
}

export async function getHold(holdId: number): Promise<Hold> {
  const res = await apiGet<{ hold: Hold }>(`/blockchain/holds/${holdId}`);
  return res.hold;
}

export async function reserveHold(payload: ReserveHoldPayload): Promise<Hold> {
  const res = await apiPost<{ hold: Hold }>(
    "/blockchain/holds/reserve",
    payload,
  );
  return res.hold;
}

export async function markAwaitingRelease(holdId: number): Promise<Hold> {
  const res = await apiPatch<{ hold: Hold }>(
    `/blockchain/holds/${holdId}/awaiting-release`,
  );
  return res.hold;
}

export async function markAvailable(
  holdId: number,
  opts: { force?: boolean } = {},
): Promise<Hold> {
  const res = await apiPatch<{ hold: Hold }>(
    `/blockchain/holds/${holdId}/available`,
    { force: opts.force ?? false },
  );
  return res.hold;
}

export async function cancelHold(
  holdId: number,
  reason?: string,
): Promise<Hold> {
  const res = await apiPatch<{ hold: Hold }>(
    `/blockchain/holds/${holdId}/cancel`,
    { reason },
  );
  return res.hold;
}

export async function withdrawHold(
  holdId: number,
): Promise<{ hold: Hold; transfer: TransferHypepointResult }> {
  return apiPost<{ hold: Hold; transfer: TransferHypepointResult }>(
    `/blockchain/holds/${holdId}/withdraw`,
  );
}

export async function releaseExpired(): Promise<{
  updated: number;
  ids: number[];
}> {
  return apiPost<{ updated: number; ids: number[] }>(
    "/blockchain/holds/release-expired",
  );
}
