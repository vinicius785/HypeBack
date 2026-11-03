/**
 * Abas da Comunidade do Admin, na URL (`?tab=groups`). A rota continua `/admin/groups` (antes era só a lista de
 * grupos): o Feed é a aba padrão e por isso não aparece na URL; os diálogos de grupo (`/admin/groups/new`,
 * `/admin/groups/$groupId`) abrem por cima da aba Grupos.
 */
export const COMMUNITY_TAB_IDS = ["feed", "groups"] as const;
export type CommunityTabId = (typeof COMMUNITY_TAB_IDS)[number];
export const DEFAULT_COMMUNITY_TAB: CommunityTabId = "feed";

/** Valor fora das abas conhecidas some da URL (a página cai no Feed). */
export function validateCommunitySearch(raw: Record<string, unknown>): { tab?: string } {
  const { tab } = raw;
  return { tab: typeof tab === "string" && (COMMUNITY_TAB_IDS as readonly string[]).includes(tab) ? tab : undefined };
}

/** Busca para voltar à lista de grupos (ao fechar um diálogo de grupo): sem ela a página abriria no Feed. */
export const GROUPS_TAB_SEARCH = { tab: "groups" } as const;

const COMMUNITY_PATH = "/admin/groups";

/**
 * Aba à mostra. Com um diálogo de grupo aberto (rota filha) é sempre a de Grupos, que é a lista que fica por
 * baixo dele, seja o diálogo aberto por um clique ou por um link direto (`/admin/groups/<id>`).
 */
export function resolveCommunityTab(pathname: string, fromUrl: CommunityTabId): CommunityTabId {
  return pathname.replace(/\/+$/, "") === COMMUNITY_PATH ? fromUrl : "groups";
}
