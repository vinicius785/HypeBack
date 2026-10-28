/**
 * Pricing per (campaign_step × social_network) — modalidade `fixed`.
 *
 * Endpoints `/backoffice/blockchain/pricing/*`. Compõe com:
 *   - holds.ts (auto-reserve cria hold após approve)
 *   - hypepoint.ts (saldo da admin é a constraint)
 */
import { apiGet, apiPatch, apiPost } from "@/lib/http-client";

import type { Hold } from "./holds";

export interface StepNetworkBreakdown {
  stepNetworkId: number;
  socialNetworkId: number;
  networkType: string;
  networkName: string;
  priceWei: string;
  priceFormatted: string;
}

export interface StepBreakdown {
  stepId: number;
  order: number;
  objective: string;
  publishDate: string | null;
  networks: StepNetworkBreakdown[];
}

export interface CampaignPricing {
  campaignId: number;
  campaignPublicId: string;
  title: string;
  paymentMethod: string;
  hasGranularPricing: boolean;
  legacyAmountDetails: Record<string, any> | null;
  steps: StepBreakdown[];
  totalMaxWei: string;
  totalMaxFormatted: string;
}

export interface InfluencerQuoteRow {
  stepNetworkId: number;
  stepId: number;
  socialNetworkId: number;
  networkType: string;
  networkName: string;
  priceWei: string;
  priceFormatted: string;
  included: boolean;
}

export interface InfluencerQuote {
  campaignUserId: number;
  userId: number;
  campaignId: number;
  campaignPublicId: string;
  paymentMethod: string;
  status: string;
  selectedProfileIds: number[];
  breakdown: InfluencerQuoteRow[];
  totalIncludedWei: string;
  totalIncludedFormatted: string;
  totalAllWei: string;
  totalAllFormatted: string;
  currency: string;
  decimals: number;
}

export interface PreflightItem {
  campaignUserId: number;
  userId: number | null;
  campaignId: number | null;
  paymentMethod: string | null;
  currentStatus: string | null;
  estimatedAmountWei: string;
  estimatedAmountFormatted: string;
  canApprove: boolean;
  reason: string | null;
}

export interface PreflightResult {
  items: PreflightItem[];
  totals: {
    requiredWei: string;
    requiredFormatted: string;
    adminFreeWei: string;
    adminFreeFormatted: string;
    adminOnChainWei: string;
    adminOnChainFormatted: string;
    activeHoldsWei: string;
    activeHoldsFormatted: string;
  };
  currency: string;
  decimals: number;
  allCanApprove: boolean;
}

export async function getCampaignPricing(
  campaignPublicId: string,
): Promise<CampaignPricing> {
  const res = await apiGet<{ pricing: CampaignPricing }>(
    `/blockchain/pricing/campaigns/${campaignPublicId}`,
  );
  return res.pricing;
}

export async function getInfluencerQuote(
  campaignUserId: number,
): Promise<InfluencerQuote> {
  const res = await apiGet<{ quote: InfluencerQuote }>(
    `/blockchain/pricing/campaign-users/${campaignUserId}/quote`,
  );
  return res.quote;
}

export async function setStepNetworkPrice(
  stepNetworkId: number,
  priceHuman: string,
): Promise<{
  id: number;
  campaignStepId: number;
  socialNetworkId: number;
  priceWei: string;
  priceFormatted: string;
  currency: string;
}> {
  const res = await apiPatch<{
    stepNetworkPrice: {
      id: number;
      campaignStepId: number;
      socialNetworkId: number;
      priceWei: string;
      priceFormatted: string;
      currency: string;
    };
  }>(`/blockchain/pricing/step-networks/${stepNetworkId}/price`, {
    price: priceHuman,
  });
  return res.stepNetworkPrice;
}

export async function preflightApproval(
  campaignUserIds: number[],
): Promise<PreflightResult> {
  const res = await apiPost<{ preflight: PreflightResult }>(
    "/blockchain/pricing/preflight-approval",
    { campaign_user_ids: campaignUserIds },
  );
  return res.preflight;
}

export async function autoReserveAfterApproval(
  campaignUserId: number,
): Promise<Hold> {
  const res = await apiPost<{ hold: Hold }>(
    `/blockchain/pricing/campaign-users/${campaignUserId}/auto-reserve`,
  );
  return res.hold;
}
