import type { CampaignPhase } from "@/shared/types";
import { unformatNumber } from "@/shared/utils/masks";

/** Considera `includeImageRights !== false` como Sim (padrão). */
export function aggregateImageRightsPeriodMonths(
  phases: CampaignPhase[]
): number {
  const nums = phases
    .filter((p) => p.includeImageRights !== false)
    .map((p) => parseInt(unformatNumber(p.imageRightsPeriod || "0"), 10) || 0);
  return nums.length > 0 ? Math.max(0, ...nums) : 0;
}
