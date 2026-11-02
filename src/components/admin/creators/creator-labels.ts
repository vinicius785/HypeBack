/** Vocabulário da tela de criadores do Admin (rótulos pt-BR do contrato e opções dos filtros). */
import type { AdminAlertKind, AdminDuplicateReason } from "@/shared/admin-platform.types";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { ADMIN_CREATOR_NETWORKS } from "@/hooks/admin/use-admin-creators";
import type { AdminFilterOption } from "@/components/admin/platform";

/** UGC é um tipo de conteúdo, não uma rede social: nunca aparece como rede, nem na coluna nem no filtro. */
export function isUgcType(type: string): boolean {
  return type.trim().toLowerCase() === "ugc";
}

/** Nome da rede como o app o escreve (Instagram, Instagram / Facebook, TikTok, YouTube). */
export function networkLabel(type: string): string {
  return getNetworkLabel(type);
}

/** Ícone (mapa `I` do protótipo) de cada rede; rede que o mapa não conhece cai no ícone de link. */
export function networkIconName(type: string): string {
  const raw = type.toLowerCase();
  if (raw.includes("instagram")) return "instagram";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("youtube")) return "youtube";
  return "link";
}

/** `@usuario` sem duplicar o arroba que algumas redes já guardam no nome; sem usuário diz isso, em vez de um "@" solto. */
export function formatHandle(username: string): string {
  const handle = username.trim().replace(/^@+/, "");
  return handle ? `@${handle}` : "sem usuário";
}

export const NETWORK_FILTER_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todas" },
  ...ADMIN_CREATOR_NETWORKS.map((value) => ({ value, label: networkLabel(value) })),
];

/**
 * Cadastro, na linguagem do filtro e da etiqueta. "Conta externa" é o `stub` do contrato (criada por convite e nunca
 * assumida pela pessoa).
 */
export const REGISTRATION_FILTER_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todos" },
  { value: "complete", label: "Completo" },
  { value: "incomplete", label: "Incompleto" },
  { value: "stub", label: "Conta externa" },
];

export const EXTERNAL_ACCOUNT_LABEL = "Conta externa";
export const EXTERNAL_ACCOUNT_HELP = "Conta criada por convite e nunca assumida pela pessoa.";

/** Pisos do filtro de seguidores; um valor que veio da URL e não está aqui ganha a sua própria opção. */
const MIN_FOLLOWERS_PRESETS: readonly { value: string; label: string }[] = [
  { value: "1000", label: "1 mil" },
  { value: "5000", label: "5 mil" },
  { value: "10000", label: "10 mil" },
  { value: "50000", label: "50 mil" },
  { value: "100000", label: "100 mil" },
  { value: "500000", label: "500 mil" },
  { value: "1000000", label: "1 milhão" },
];

export function minFollowersOptions(current: string): AdminFilterOption[] {
  const options: { value: string; label: string }[] = [...MIN_FOLLOWERS_PRESETS];
  const n = Number(current);
  if (current && !options.some((o) => o.value === current) && Number.isFinite(n)) {
    options.push({ value: current, label: new Intl.NumberFormat("pt-BR").format(n) });
    options.sort((a, b) => Number(a.value) - Number(b.value));
  }
  return [{ value: "", label: "Qualquer" }, ...options];
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

export const DUPLICATE_REASON_LABEL: Record<AdminDuplicateReason, string> = {
  email: "E-mail",
  phone: "Telefone",
  document: "Documento",
  social_handle: "Rede social",
  identity_conflict: "Conflito de identidade",
};

export const DUPLICATE_REASON_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todos" },
  ...(Object.keys(DUPLICATE_REASON_LABEL) as AdminDuplicateReason[]).map((value) => ({
    value,
    label: DUPLICATE_REASON_LABEL[value],
  })),
];

export const DUPLICATE_CONFIDENCE_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todas" },
  { value: "high", label: "Alta" },
  { value: "possible", label: "Possível" },
];

/** O que cada nível de confiança quer dizer (comentário do contrato). */
export const DUPLICATE_CONFIDENCE_HELP = {
  high: "Alta: o valor em comum é idêntico depois de normalizado.",
  possible: "Possível: valor parecido ou sinal indireto, a confirmar.",
} as const;

// ---------------------------------------------------------------------------
// Inconsistências
// ---------------------------------------------------------------------------

export const INCONSISTENCY_KIND_LABEL: Record<AdminAlertKind, string> = {
  alert: "Alerta objetivo",
  suggestion: "Sugestão",
};

export const INCONSISTENCY_KIND_HELP: Record<AdminAlertKind, string> = {
  alert: "Fato objetivo armazenado no banco de dados.",
  suggestion: "Heurística: o critério foi escolhido pelo produto e pode não ser um problema de verdade.",
};
