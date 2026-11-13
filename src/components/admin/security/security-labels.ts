import type { AdminBadgeTone } from "@/components/admin/platform";
import type { SecurityAlertChannel, SecurityAlertSeverity } from "@/shared/admin-platform.types";

export const SEVERITY_LABEL: Record<SecurityAlertSeverity, string> = { high: "Alta", medium: "Média", low: "Baixa" };

/** Alta = vermelho, média = âmbar, baixa = neutro. */
export const SEVERITY_TONE: Record<SecurityAlertSeverity, AdminBadgeTone> = { high: "bad", medium: "warn", low: "neutral" };

/** "App" (mobile-app) e "Painel" (backoffice); canal desconhecido ou ausente não inventa rótulo. */
export function channelLabel(channel: SecurityAlertChannel | undefined): string | null {
  if (channel === "mobile-app") return "App";
  if (channel === "backoffice") return "Painel";
  return null;
}

/** Texto da bolinha do sino: sem número em 0, "99+" acima de 99. */
export function bellCountText(unseen: number | undefined): string | null {
  if (!unseen || unseen <= 0) return null;
  return unseen > 99 ? "99+" : String(unseen);
}

export const SECURITY_PRIVACY_NOTE = "Estas informações são visíveis apenas para administradores da plataforma.";
export const NOTE_MAX = 500;
export const REASON_MIN = 5;
export const REASON_MAX = 500;
export const WATCH_ALREADY_TEXT = "Esse e-mail já está na lista de vigiados.";

export type SecurityTab = "alerts" | "watchlist";
export const SECURITY_TABS: readonly SecurityTab[] = ["alerts", "watchlist"];
export const SECURITY_STATUSES = ["unseen", "all"] as const;

export type WatchFilter = "all" | "active" | "inactive";
export const WATCH_FILTERS: ReadonlyArray<{ id: WatchFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "inactive", label: "Inativos" },
];
export const ALERT_FILTERS: ReadonlyArray<{ id: "unseen" | "all"; label: string }> = [
  { id: "unseen", label: "Novos" },
  { id: "all", label: "Todos" },
];

/** Vigiados que combinam com o filtro (todos, ativos, inativos) e com a busca (e-mail, nome da conta ou motivo). */
export function filterWatchlist<T extends { active: boolean; email: string; reason: string; registered_user: { name: string | null } | null }>(
  list: readonly T[],
  filter: WatchFilter,
  term: string,
): T[] {
  const needle = term.trim().toLowerCase();
  return list.filter((watch) => {
    if (filter === "active" && !watch.active) return false;
    if (filter === "inactive" && watch.active) return false;
    if (!needle) return true;
    return [watch.email, watch.reason, watch.registered_user?.name ?? ""].some((text) => text.toLowerCase().includes(needle));
  });
}

/** Selo do tipo na linha. Tipo desconhecido não ganha selo. */
export function kindLabel(kind: string): string | null {
  if (kind === "admin_action") return "Ação no Admin";
  if (kind === "watched_login") return "Conta vigiada";
  if (kind === "attack_ip_denied") return "IP suspeito";
  if (kind === "attack_user_probing") return "Conta suspeita";
  if (kind === "signup_wave") return "Onda de cadastros";
  return null;
}

/** Tipo do alvo da ação: user, workspace, campaign; outro valor aparece como veio. */
export function targetTypeLabel(type: string): string {
  if (type === "user") return "Usuário";
  if (type === "workspace") return "Workspace";
  if (type === "campaign") return "Campanha";
  return type;
}

/** Papel de quem fez a ação. */
export function actorRoleLabel(role: string): string {
  if (role === "platform_admin") return "Administrador";
  if (role === "platform_staff") return "Equipe";
  return role;
}

export type KindFilter = "all" | "watched_login" | "admin_action" | "attack_ip_denied" | "attack_user_probing" | "signup_wave";
export const KIND_FILTERS: ReadonlyArray<{ id: KindFilter; label: string }> = [
  { id: "all", label: "Todos os tipos" },
  { id: "watched_login", label: "Contas vigiadas" },
  { id: "admin_action", label: "Ações no Admin" },
  { id: "attack_ip_denied", label: "IPs suspeitos" },
  { id: "attack_user_probing", label: "Contas suspeitas" },
  { id: "signup_wave", label: "Ondas de cadastros" },
];

/** Filtro por tipo, só no cliente, sobre o que já foi carregado. Tipo desconhecido só aparece em "Todos os tipos". */
export function matchesKind(kind: string, filter: KindFilter): boolean {
  return filter === "all" || kind === filter;
}

/** Singular ou plural pelo número ("1 conta nova", "3 contas novas"). */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Resumo em português dos alertas de ataque e de onda de cadastros: "N tentativas negadas em M min vindas do IP " (o IP vem à parte, em fonte monoespaçada). */
export function ipDeniedSummary(count: number, windowMinutes: number): string {
  return `${count} ${plural(count, "tentativa negada", "tentativas negadas")} em ${windowMinutes} min ${plural(count, "vinda", "vindas")} do IP`;
}

export function probingSummary(count: number, windowMinutes: number): string {
  return `${count} ${plural(count, "erro", "erros")} de acesso (403/404) em ${windowMinutes} min`;
}

export function signupWaveSummary(count: number, windowMinutes: number): string {
  return `${count} ${plural(count, "conta nova", "contas novas")} em ${windowMinutes} min`;
}
