import { apiGet, apiPost } from "@/lib/http-client";

export type PerformanceLevel = "excellent" | "good" | "average" | "poor";

export interface EvaluationRecord {
  id: string;
  rating: number;
  feedback: string;
  performance: PerformanceLevel;
  would_work_again: boolean;
  created_at: string;
}

export interface BrandEvaluationRecord {
  id: string;
  rating: number;
  feedback: string;
  would_work_again: boolean;
  created_at: string;
}

export interface CreateEvaluationDto {
  rating: number;
  feedback: string;
  performance: PerformanceLevel;
  would_work_again: boolean;
}

function is404(e: unknown): boolean {
  return e instanceof Error && e.message.includes("(404)");
}

export async function getInfluencerEvaluation(
  campaignId: string,
  influencerId: string
): Promise<EvaluationRecord | null> {
  try {
    return await apiGet<EvaluationRecord>(
      `/campaigns/${campaignId}/users/${influencerId}/evaluation`
    );
  } catch (e) {
    if (is404(e)) return null;
    throw e;
  }
}

export async function createInfluencerEvaluation(
  campaignId: string,
  influencerId: string,
  dto: CreateEvaluationDto
): Promise<EvaluationRecord> {
  return apiPost<EvaluationRecord>(
    `/campaigns/${campaignId}/users/${influencerId}/evaluation`,
    dto
  );
}

export async function getBrandEvaluation(
  campaignId: string,
  influencerId: string
): Promise<BrandEvaluationRecord | null> {
  try {
    return await apiGet<BrandEvaluationRecord>(
      `/campaigns/${campaignId}/users/${influencerId}/brand-evaluation`
    );
  } catch (e) {
    if (is404(e)) return null;
    throw e;
  }
}
