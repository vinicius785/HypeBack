import type { AdminNotificationTarget } from "@/shared/types";

/**
 * Destino de uma notificação: a tela que o app abre quando a pessoa toca na push ou no sino. Os nomes de `screen` são
 * contrato com o app (não renomear); os rótulos são só para quem usa o painel.
 */
export const TARGET_SCREENS_PLAIN = [
  { value: "home", label: "Início" },
  { value: "campaigns", label: "Campanhas" },
  { value: "community", label: "Comunidade (Para você)" },
  { value: "community_content", label: "Conteúdos" },
  { value: "community_groups", label: "Grupos" },
  { value: "profile", label: "Perfil" },
  { value: "wallet", label: "Carteira" },
  { value: "media_kit", label: "Mídia kit" },
  { value: "social_networks", label: "Redes sociais" },
  { value: "campaign_history", label: "Histórico de campanhas" },
  { value: "support", label: "Suporte" },
  { value: "chats", label: "Conversas" },
  { value: "notifications", label: "Notificações" },
  { value: "calendar", label: "Calendário" },
  { value: "evaluations", label: "Avaliações" },
] as const;

/** Telas que pedem um id: de qual campo vem e como o campo se chama no formulário. */
export const TARGET_SCREENS_WITH_ID = [
  { value: "campaign_detail", label: "Detalhe da campanha", field: "campaign_id" },
  { value: "campaign_chat", label: "Chat da campanha", field: "campaign_id" },
  { value: "campaign_script", label: "Roteiro da campanha", field: "campaign_id" },
  { value: "campaign_content", label: "Conteúdo da campanha", field: "campaign_id" },
  { value: "campaign_invitation", label: "Convite da campanha", field: "campaign_id" },
  { value: "community_group", label: "Um grupo da comunidade", field: "group_id" },
  { value: "community_post", label: "Uma publicação da comunidade", field: "post_id" },
] as const;

export type TargetIdField = (typeof TARGET_SCREENS_WITH_ID)[number]["field"];

export const EXTERNAL_URL_SCREEN = "external_url";

const ID_FIELD_LABEL: Record<TargetIdField, string> = {
  campaign_id: "Campanha",
  group_id: "Id do grupo",
  post_id: "Id da publicação",
};

export function targetIdFieldLabel(field: TargetIdField): string {
  return ID_FIELD_LABEL[field];
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ALLOWED_HOSTS = new Set(["hypeapp.com.br", "www.hypeapp.com.br", "api-v2.hypeapp.com.br"]);

export function isValidTargetId(value: string): boolean {
  return ID_PATTERN.test(value.trim());
}

/** Link do destino: só https dos domínios da Hype, sem usuário nem senha. Vazio é inválido (o campo é obrigatório nesta opção). */
export function targetUrlError(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Informe o link.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Link inválido. Use https://… completo.";
  }
  if (url.protocol !== "https:") return "Só links https são aceitos.";
  if (url.username || url.password) return "O link não pode ter usuário nem senha.";
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return "Só links de hypeapp.com.br, www.hypeapp.com.br ou api-v2.hypeapp.com.br.";
  return null;
}

export interface TargetDraft {
  /** "" = lista de notificações (não manda destino). */
  screen: string;
  id: string;
  commentId: string;
  url: string;
}

export const EMPTY_TARGET_DRAFT: TargetDraft = { screen: "", id: "", commentId: "", url: "" };

export function targetDraftError(draft: TargetDraft): string | null {
  if (!draft.screen) return null;
  if (draft.screen === EXTERNAL_URL_SCREEN) return targetUrlError(draft.url);
  const withId = TARGET_SCREENS_WITH_ID.find((s) => s.value === draft.screen);
  if (withId) {
    if (!draft.id.trim()) return withId.field === "campaign_id" ? "Escolha a campanha." : "Informe o id.";
    if (!isValidTargetId(draft.id)) return "Id inválido: use letras, números, “-” e “_” (até 64).";
    if (draft.screen === "community_post" && draft.commentId.trim() && !isValidTargetId(draft.commentId)) return "Id do comentário inválido.";
  }
  return null;
}

/** O que vai no corpo do POST: `null` quando fica o padrão (lista de notificações). */
export function buildTarget(draft: TargetDraft): AdminNotificationTarget | null {
  if (!draft.screen || targetDraftError(draft)) return null;
  if (draft.screen === EXTERNAL_URL_SCREEN) return { version: 1, screen: "external_url", url: draft.url.trim() };
  const withId = TARGET_SCREENS_WITH_ID.find((s) => s.value === draft.screen);
  if (withId) {
    const target: Record<string, unknown> = { version: 1, screen: withId.value, [withId.field]: draft.id.trim() };
    if (draft.screen === "community_post" && draft.commentId.trim()) target.comment_id = draft.commentId.trim();
    return target as unknown as AdminNotificationTarget;
  }
  return { version: 1, screen: draft.screen } as AdminNotificationTarget;
}

/** Do destino guardado de volta para o formulário (Duplicar). Destino que esta versão não conhece volta para o padrão. */
export function draftFromTarget(target: AdminNotificationTarget | null | undefined): TargetDraft {
  if (!target) return EMPTY_TARGET_DRAFT;
  const t = target as unknown as Record<string, string | undefined>;
  if (target.screen === EXTERNAL_URL_SCREEN) return { ...EMPTY_TARGET_DRAFT, screen: target.screen, url: t.url ?? "" };
  const withId = TARGET_SCREENS_WITH_ID.find((s) => s.value === target.screen);
  if (withId) return { ...EMPTY_TARGET_DRAFT, screen: withId.value, id: t[withId.field] ?? "", commentId: t.comment_id ?? "" };
  if (TARGET_SCREENS_PLAIN.some((s) => s.value === target.screen)) return { ...EMPTY_TARGET_DRAFT, screen: target.screen };
  return EMPTY_TARGET_DRAFT;
}

/** Texto para mostrar o destino (detalhe, prévia). */
export function describeTarget(target: AdminNotificationTarget | null | undefined): string {
  if (!target) return "Lista de notificações";
  const t = target as unknown as Record<string, string | undefined>;
  if (target.screen === EXTERNAL_URL_SCREEN) return `Link: ${t.url ?? ""}`;
  const withId = TARGET_SCREENS_WITH_ID.find((s) => s.value === target.screen);
  if (withId) return `${withId.label} · ${t[withId.field] ?? "—"}`;
  return TARGET_SCREENS_PLAIN.find((s) => s.value === target.screen)?.label ?? target.screen;
}
