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
export const SECURITY_EMAIL_NOTE = "Alertas de severidade alta também são enviados por e-mail à equipe.";
export const NOTE_MAX = 500;
export const REASON_MIN = 5;
export const REASON_MAX = 500;
export const WATCH_ALREADY_TEXT = "Esse e-mail já está na lista de vigiados.";

export type SecurityTab = "alerts" | "watchlist";
export const SECURITY_TABS: readonly SecurityTab[] = ["alerts", "watchlist"];
export const SECURITY_STATUSES = ["unseen", "all"] as const;

export type WatchFilter = "all" | "active" | "inactive";
/** A lista de vigiados abre mostrando só quem está sendo vigiado agora; os encerrados ficam em "Inativos" ou "Todos". */
export const DEFAULT_WATCH_FILTER: WatchFilter = "active";
export const WATCH_FILTERS: ReadonlyArray<{ id: WatchFilter; label: string }> = [
  { id: "active", label: "Ativos" },
  { id: "inactive", label: "Inativos" },
  { id: "all", label: "Todos" },
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
  if (kind === "watched_active") return "Vigiado ativo";
  if (kind === "watched_behavior") return "Comportamento vigiado";
  if (kind === "attack_ip_denied") return "IP suspeito";
  if (kind === "attack_user_probing") return "Conta suspeita";
  if (kind === "signup_wave") return "Onda de cadastros";
  if (kind === "attack_code_guessing") return "Chute de código";
  if (kind === "attack_volume") return "Volume anormal";
  if (kind === "attack_enumeration") return "Varredura de dados";
  if (kind === "attack_anonymizer_wave") return "Rede anônima";
  if (kind === "staff_reset_attempt") return "Conta da equipe visada";
  if (kind === "signup_domain_cluster") return "Domínio repetido";
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

/** Os filtros por tipo agrupam os tipos de alerta: ataques à API, equipe visada e cadastros reúnem vários. */
export type KindFilter = "all" | "watched_login" | "admin_action" | "attacks" | "staff" | "signups";
export const KIND_FILTERS: ReadonlyArray<{ id: KindFilter; label: string }> = [
  { id: "all", label: "Todos os tipos" },
  { id: "watched_login", label: "Contas vigiadas" },
  { id: "admin_action", label: "Ações no Admin" },
  { id: "attacks", label: "Ataques" },
  { id: "staff", label: "Equipe visada" },
  { id: "signups", label: "Cadastros" },
];

const KIND_GROUPS: Record<Exclude<KindFilter, "all">, readonly string[]> = {
  watched_login: ["watched_login", "watched_active", "watched_behavior"],
  admin_action: ["admin_action"],
  attacks: ["attack_ip_denied", "attack_user_probing", "attack_code_guessing", "attack_volume", "attack_enumeration", "attack_anonymizer_wave"],
  staff: ["staff_reset_attempt"],
  signups: ["signup_wave", "signup_domain_cluster"],
};

/** Filtro por tipo, só no cliente, sobre o que já foi carregado. Tipo desconhecido só aparece em "Todos os tipos". */
export function matchesKind(kind: string, filter: KindFilter): boolean {
  return filter === "all" || KIND_GROUPS[filter].includes(kind);
}

/** Singular ou plural pelo número ("1 conta nova", "3 contas novas"). */
export function plural(count: number, one: string, many: string): string {
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

/** Aparelho a partir do User-Agent, para a tabela de atividade: iPhone/iPad, Android, Windows, Mac ou outro. */
export function deviceFromUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim();
  if (!ua) return "—";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  return "Outro";
}

/** Cor do status HTTP na atividade: verde 2xx, âmbar 4xx, vermelho 5xx; o resto, neutro. */
export function statusTone(status: number | null): "ok" | "warn" | "bad" | "neutral" {
  if (status === null) return "neutral";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400 && status < 500) return "warn";
  if (status >= 500) return "bad";
  return "neutral";
}

/** Erro de acesso (4xx ou 5xx): é o que o filtro "Só erros" da atividade mostra. */
export function isErrorStatus(status: number | null): boolean {
  return status !== null && status >= 400;
}

// ---------------------------------------------------------------------------
// Prazo da vigilância
// ---------------------------------------------------------------------------

/** Prazos oferecidos ao vigiar um e-mail. `days: null` = sem prazo (não envia `days`). O de 7 dias é o sugerido. */
export const WATCH_DURATIONS: ReadonlyArray<{ days: number | null; label: string; hint?: string }> = [
  { days: 7, label: "7 dias", hint: "Sugerido" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: null, label: "Sem prazo" },
];
export const DEFAULT_WATCH_DAYS = 7;

/** A vigilância vence em até este número de dias: o cartão destaca em âmbar. */
export const WATCH_EXPIRY_WARN_DAYS = 2;

const DAY_MS = 86_400_000;

export type WatchExpiry =
  | { state: "none" }
  | { state: "until"; iso: string; daysLeft: number }
  | { state: "soon"; iso: string; daysLeft: number }
  | { state: "ended"; iso: string };

/** Situação do prazo de um vigiado: sem prazo, até quando, vencendo (2 dias ou menos) ou encerrado. */
export function watchExpiry(watch: { active: boolean; expires_at?: string | null }, now: number = Date.now()): WatchExpiry {
  const iso = watch.expires_at;
  if (!iso) return { state: "none" };
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return { state: "none" };
  if (!watch.active) return end <= now ? { state: "ended", iso } : { state: "none" };
  if (end <= now) return { state: "ended", iso };
  const daysLeft = Math.max(1, Math.ceil((end - now) / DAY_MS));
  return daysLeft <= WATCH_EXPIRY_WARN_DAYS ? { state: "soon", iso, daysLeft } : { state: "until", iso, daysLeft };
}

/** "vence em 1 dia" / "vence em 2 dias". */
export function expiryDaysText(daysLeft: number): string {
  return `vence em ${daysLeft} ${plural(daysLeft, "dia", "dias")}`;
}

/** Rótulo curto de cada sinal do alerta de comportamento; desconhecido = `null` (mostra só o título). */
export function behaviorSignalLabel(signal: string): string | null {
  if (signal === "many_joins") return "Muitas inscrições";
  if (signal === "social_churn") return "Mexeu nas redes sociais";
  if (signal === "withdrawal") return "Pediu saque";
  if (signal === "multi_ip") return "Acessou de vários IPs";
  return null;
}

/** Janela do alerta: 60 min vira "na última hora"; outra janela, "em N min". */
function behaviorWindow(windowMinutes: number): string {
  return windowMinutes === 60 ? "na última hora" : `em ${windowMinutes} min`;
}

/** Texto da contagem de cada sinal ("12 na última hora", "3 vezes na última hora", "4 IPs diferentes na última hora"); saque não tem contagem. */
export function behaviorCountText(signal: string, count: number, windowMinutes: number): string | null {
  const window = behaviorWindow(windowMinutes);
  if (signal === "many_joins") return `${count} ${window}`;
  if (signal === "social_churn") return `${count} ${plural(count, "vez", "vezes")} ${window}`;
  if (signal === "multi_ip") return `${count} ${plural(count, "IP diferente", "IPs diferentes")} ${window}`;
  return null;
}
