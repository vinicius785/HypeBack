import type { CampaignFormData } from "@/shared/types";
import type { CampaignDetail, UpdateCampaignData } from "@/shared/services/campaign";
import type { CampaignPhaseUpsertPayload, CreatePhaseData } from "@/shared/services/phase";
import { unformatNumber, currencyToNumber } from "@/shared/utils/masks";
import { aggregateImageRightsPeriodMonths } from "@/shared/utils/campaign-image-rights";

/** Opcionais no PUT: omitir = manter no servidor (api-backoffice-update-campaign.md). */
const OPTIONAL_PUT_KEYS: (keyof UpdateCampaignData)[] = [
  "payment_method_details",
  "secondary_niches",
  "benefits",
  "segment_min_followers",
  "segment_state",
  "segment_city",
  "segment_genders",
  "image_rights_period",
];

function isEqualApiValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqualApiValue(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) {
      if (!isEqualApiValue(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

export function toPublishTimeForApi(postTime: string | undefined): string | undefined {
  const t = (postTime ?? "").trim();
  if (!t) return undefined;
  const segments = t.split(":");
  if (segments.length === 2) return `${t}:00`;
  return t;
}

function isPersistedPhaseId(id: string | undefined): boolean {
  if (!id || id === "1" || id.startsWith("temp-")) return false;
  return id.length >= 8;
}

export function formPhaseToCreatePhaseData(
  phase: CampaignFormData["phases"][number]
): CreatePhaseData {
  const formatsByNetwork: {
    [key: string]: { type: string; options: Array<{ type: string; quantity: number; price?: number }> };
  } = {};

  phase.formats.forEach((format) => {
    const network = format.socialNetwork || "instagram";
    if (!formatsByNetwork[network]) {
      formatsByNetwork[network] = {
        type: network,
        options: [],
      };
    }
    const option: { type: string; quantity: number; price?: number } = {
      type: format.contentType || "post",
      quantity: parseInt(format.quantity, 10) || 1,
    };
    if (format.price) {
      const priceNum = currencyToNumber(format.price);
      if (priceNum > 0) option.price = Math.round(priceNum * 100);
    }
    formatsByNetwork[network].options.push(option);
  });

  const publish_time = toPublishTimeForApi(phase.postTime);
  const row: CreatePhaseData = {
    objective: phase.objective,
    post_date: phase.postDate,
    requires_product_receipt: phase.requiresProductReceipt === true,
    formats: Object.values(formatsByNetwork).length > 0 ? Object.values(formatsByNetwork) : [],
    files: phase.files && phase.files.trim() ? [phase.files.trim()] : undefined,
  };
  if (publish_time) {
    row.publish_time = publish_time;
  }
  return row;
}

/** `phases` no PUT da campanha: ordem do formulário, `id` só em fases já persistidas. */
export function buildPhasesPayloadFromForm(
  formData: CampaignFormData
): CampaignPhaseUpsertPayload[] {
  return [...formData.phases]
    .filter((p) => p.objective && p.postDate)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((phase) => {
      const payload = formPhaseToCreatePhaseData(phase);
      const id = isPersistedPhaseId(phase.id) ? phase.id : undefined;
      return id ? { ...payload, id } : payload;
    });
}

/**
 * Monta campos de campanha (sem `phases`) a partir do formulário.
 * Usado no snapshot e no submit antes do merge de pagamento.
 */
export function buildCampaignUpdatePayloadFromForm(
  formData: CampaignFormData
): UpdateCampaignData {
  const subnicheIds = formData.subniches
    ? formData.subniches.split(",").filter(Boolean).map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id))
    : [];
  const mainNicheIds = formData.mainNiche
    ? formData.mainNiche.split(",").filter(Boolean).map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id))
    : [];
  // Enviar todos os nichos (raiz + filhos) no campo secondary_niches
  const secondary_niches = [...new Set([...mainNicheIds, ...subnicheIds])];

  const buildPaymentDetails = () => {
    const bonusLine = formData.benefitsBonus?.trim()
      ? `Bônus: ${formData.benefitsBonus.trim()}`
      : "";

    const withBonus = (text: string) =>
      [bonusLine, text].filter(Boolean).join("\n\n");

    const baseDetails: { amount?: number; currency?: string; description?: string } = {};

    switch (formData.paymentType) {
      case "fixed":
        if (formData.paymentFixedAmount) {
          baseDetails.amount = currencyToNumber(formData.paymentFixedAmount);
          baseDetails.currency = "BRL";
          baseDetails.description = withBonus("Pagamento fixo por influenciador");
        }
        break;
      case "swap":
        if (formData.paymentSwapItem && formData.paymentSwapMarketValue) {
          baseDetails.description = withBonus(
            `${formData.paymentSwapItem} - Valor de mercado: ${formData.paymentSwapMarketValue}`,
          );
          baseDetails.amount = currencyToNumber(formData.paymentSwapMarketValue);
          baseDetails.currency = "BRL";
        }
        break;
      case "cpa":
        if (formData.paymentCpaActions && formData.paymentCpaValue) {
          baseDetails.description = withBonus(
            `Ações que geram CPA: ${formData.paymentCpaActions} - Valor: ${formData.paymentCpaValue}`,
          );
          baseDetails.amount = currencyToNumber(formData.paymentCpaValue);
          baseDetails.currency = "BRL";
        }
        break;
      case "cpm":
        if (formData.paymentCpmValue) {
          baseDetails.amount = currencyToNumber(formData.paymentCpmValue);
          baseDetails.currency = "BRL";
          if (bonusLine) baseDetails.description = bonusLine;
        }
        break;
      case "price":
        break;
      default:
        break;
    }

    return baseDetails;
  };

  return {
    title: formData.title,
    description: formData.description,
    objective: formData.generalObjective || "awareness",
    secondary_niches,
    max_influencers: parseInt(unformatNumber(formData.influencersCount), 10) || 0,
    payment_method: formData.paymentType || "fixed",
    payment_method_details: buildPaymentDetails(),
    benefits: Array.isArray(formData.benefits)
      ? formData.benefits.filter((item) => item.trim() !== "")
      : formData.benefits
        ? [formData.benefits].filter((item) => item.trim() !== "")
        : [],
    rules_does: Array.isArray(formData.whatToDo)
      ? formData.whatToDo.filter((item) => item.trim() !== "")
      : formData.whatToDo
        ? [formData.whatToDo].filter((item) => item.trim() !== "")
        : [],
    rules_does_not: Array.isArray(formData.whatNotToDo)
      ? formData.whatNotToDo.filter((item) => item.trim() !== "")
      : formData.whatNotToDo
        ? [formData.whatNotToDo].filter((item) => item.trim() !== "")
        : [],
    segment_min_followers: formData.minFollowers
      ? parseInt(unformatNumber(formData.minFollowers), 10)
      : undefined,
    segment_state: formData.state ? formData.state.split(",").filter(Boolean) : undefined,
    segment_city: formData.city ? formData.city.split(",").filter(Boolean) : undefined,
    segment_genders:
      formData.gender && formData.gender !== "all" ? [formData.gender] : undefined,
    image_rights_period: aggregateImageRightsPeriodMonths(formData.phases),
  };
}

/** Se o form não montou `payment_method_details`, reutiliza o do servidor. */
export function mergePaymentDetailsWithServer(
  fromForm: UpdateCampaignData,
  server: CampaignDetail
): UpdateCampaignData {
  const merged: UpdateCampaignData = { ...fromForm };
  const pmd = fromForm.payment_method_details ?? {};
  const pmdMeaningful =
    pmd.amount != null ||
    (typeof pmd.description === "string" && pmd.description.trim() !== "");

  if (!pmdMeaningful && server.payment_method_details) {
    merged.payment_method_details = { ...server.payment_method_details };
  }
  return merged;
}

/**
 * Corpo do PUT alinhado à API: sempre os obrigatórios; opcionais e `phases` só se mudaram
 * (omitir preserva no servidor; `phases` omitido não altera fases).
 */
export function buildPutCampaignUpdateBody(params: {
  baseline: UpdateCampaignData;
  nextMerged: UpdateCampaignData;
  baselinePhases: CampaignPhaseUpsertPayload[];
  nextPhases: CampaignPhaseUpsertPayload[];
}): UpdateCampaignData {
  const { baseline, nextMerged, baselinePhases, nextPhases } = params;

  const out: UpdateCampaignData = {
    title: nextMerged.title,
    description: nextMerged.description,
    objective: nextMerged.objective,
    max_influencers: nextMerged.max_influencers,
    payment_method: nextMerged.payment_method,
    rules_does: nextMerged.rules_does,
    rules_does_not: nextMerged.rules_does_not,
  };

  for (const key of OPTIONAL_PUT_KEYS) {
    if (!isEqualApiValue(baseline[key], nextMerged[key])) {
      (out as Record<string, unknown>)[key as string] = nextMerged[key];
    }
  }

  if (!isEqualApiValue(baselinePhases, nextPhases)) {
    out.phases = nextPhases;
  }

  return out;
}
