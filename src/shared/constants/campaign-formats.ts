/**
 * Vocabulário canônico da CRIAÇÃO DE CAMPANHA: redes, objetivos de fase e
 * formatos de conteúdo por rede.
 *
 * Fonte ÚNICA de verdade para os steps do formulário (5 e 6) e para a tela de
 * revisão (7). Ao adicionar/alterar uma rede, objetivo ou formato, edite SÓ
 * este arquivo — os steps derivam tudo daqui.
 *
 * NÃO confundir com o vocabulário do INFLUENCIADOR em
 * `campaign-tabs/shared/prices-utils.ts` (`CAMPAIGN_FORMAT_FALLBACKS` /
 * `FORMAT_LABELS`), que mapeia os preços do criador e diverge de propósito
 * (ver feedback `vocab-formatos-per-network`).
 */

import { getNetworkLabel } from "./network-labels";

export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Redes disponíveis na criação de campanha (subset curado do produto).
 * Os rótulos derivam do mapa canônico `NETWORK_LABELS` — não duplicar texto.
 */
const CAMPAIGN_NETWORK_VALUES = ["instagram", "tiktok", "youtube", "ugc"] as const;

export const CAMPAIGN_SOCIAL_NETWORKS: SelectOption[] = CAMPAIGN_NETWORK_VALUES.map(
  (value) => ({ value, label: getNetworkLabel(value) }),
);

/** Objetivos selecionáveis por fase da campanha. */
export const PHASE_OBJECTIVE_OPTIONS: SelectOption[] = [
  { label: "Awareness", value: "awareness" },
  { label: "Engajamento", value: "engagement" },
  { label: "Conversão", value: "conversion" },
  { label: "Alcance", value: "reach" },
  { label: "Educação", value: "education" },
];

/** Formatos de conteúdo por rede, na ordem de exibição no formulário. */
export const CONTENT_TYPES_BY_NETWORK: Record<string, SelectOption[]> = {
  instagram: [
    { label: "Post", value: "post" },
    { label: "Reels", value: "reels" },
    { label: "Stories", value: "stories" },
  ],
  tiktok: [
    { label: "Vídeos", value: "video" },
    { label: "LIVE", value: "live" },
  ],
  youtube: [
    { label: "Vídeo dedicado até 10 minutos", value: "video_dedicated" },
    { label: "Inserção até 60 segundos", value: "insertion" },
    { label: "Pré-roll ou End-roll até 15 segundos", value: "preroll_endroll" },
    { label: "Shorts", value: "shorts" },
    { label: "LIVE", value: "live" },
  ],
  ugc: [
    { label: "Imagem", value: "image" },
    { label: "Vídeo até 1 minuto", value: "video_1min" },
    { label: "Vídeo até 10 minutos", value: "video_10min" },
    { label: "Vídeo até 1 hora", value: "video_1hour" },
  ],
};

/** Opções de formato para uma rede; lista vazia se a rede for desconhecida. */
export function getContentTypesForNetwork(network: string | undefined | null): SelectOption[] {
  if (!network) return [];
  return CONTENT_TYPES_BY_NETWORK[network.toLowerCase()] ?? [];
}

/**
 * Mapa plano `value → label` derivado de `CONTENT_TYPES_BY_NETWORK`.
 * `live` repete em tiktok/youtube com o mesmo rótulo ("LIVE"), então achatar
 * não perde informação.
 */
const FLAT_CONTENT_TYPE_LABELS: Record<string, string> = Object.values(
  CONTENT_TYPES_BY_NETWORK,
).reduce<Record<string, string>>((acc, options) => {
  for (const { value, label } of options) acc[value] = label;
  return acc;
}, {});

/** Rótulo de um formato pelo `value` (fallback: o próprio value). */
export function getContentTypeLabel(value: string | undefined | null): string {
  if (!value) return "";
  return FLAT_CONTENT_TYPE_LABELS[value] ?? value;
}

/**
 * Rótulo de um formato considerando a rede. Use quando a rede é conhecida —
 * mais preciso caso surjam colisões de `value` entre redes no futuro.
 */
export function getContentTypeLabelForNetwork(
  network: string | undefined | null,
  value: string | undefined | null,
): string {
  if (!value) return "";
  const match = getContentTypesForNetwork(network).find((o) => o.value === value);
  return match?.label ?? getContentTypeLabel(value);
}

/** Rótulo de uma rede pelo `value`, delegando ao mapa canônico `NETWORK_LABELS`. */
export function getCampaignNetworkLabel(value: string | undefined | null): string {
  return getNetworkLabel(value);
}

/** Rótulo de um objetivo de fase pelo `value` (fallback: o próprio value). */
export function getPhaseObjectiveLabel(value: string | undefined | null): string {
  if (!value) return "";
  return PHASE_OBJECTIVE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
