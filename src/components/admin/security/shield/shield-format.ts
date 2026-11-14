import { AdminApiError } from "@/lib/admin/admin-client";
import { SHIELD_ERROR_TEXT } from "@/lib/admin/shield";

/** Durações oferecidas ao ativar (em horas). 24 é o padrão da API e o marcado de início. */
export const SHIELD_HOURS = [6, 12, 24, 48, 72] as const;
export const DEFAULT_SHIELD_HOURS = 24;

export const SHIELD_REASON_MIN = 5;
export const SHIELD_REASON_MAX = 500;

/** O que muda enquanto o Escudo está ligado (a lista mostrada na janela de ativar). */
export const SHIELD_EFFECTS: readonly string[] = [
  "Os limites da sentinela caem pela metade (os alertas aparecem mais cedo).",
  "Alertas de severidade média também saem por e-mail.",
  "TODA alteração no Admin passa a pedir o código do Authenticator.",
  "As sessões da equipe são encerradas (menos a sua) e as novas valem 1 hora.",
  "Contas de criadores novas entram em análise.",
  "Saques ficam em espera.",
  "Login e redefinição de senha travam mais cedo.",
];

const SP = "America/Sao_Paulo";

/** "13/11 18:30" (horário de Brasília). */
export function formatShieldEnd(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: SP }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

/** "5 h 12 min", "42 min", "menos de 1 min" ou "encerrando"; `now` em ms. */
export function shieldRemaining(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return "";
  const minutes = Math.floor((end - now) / 60_000);
  if (minutes < 0) return "encerrando";
  if (minutes < 1) return "menos de 1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ""}` : `${m} min`;
}

/** O que muda, lado a lado: ícone, rótulo curto (à vista) e a frase inteira (na dica ao passar o mouse e para leitor de tela). */
export const SHIELD_STEPS: ReadonlyArray<{ icon: string; label: string; text: string }> = [
  { icon: "eye", label: "Sentinela mais sensível", text: "Os limites dos alertas caem pela metade: o aviso chega mais cedo." },
  { icon: "msg", label: "Alertas médios por e-mail", text: "Alertas de severidade média também saem por e-mail." },
  { icon: "lock", label: "Código a cada alteração", text: "Toda alteração no Admin pede o código do Authenticator." },
  { icon: "users", label: "Sessões da equipe", text: "São encerradas (menos a sua) e as novas valem 1 hora." },
  { icon: "user", label: "Criadores novos em análise", text: "Contas de criadores novas entram em análise." },
  { icon: "banknote", label: "Saques em espera", text: "Os saques ficam retidos até alguém liberar." },
  { icon: "ban", label: "Login mais rígido", text: "Login e redefinição de senha travam mais cedo." },
];

/** Horas e minutos que faltam, para o relógio grande ("4" e "29"); `null` sem data. */
export function shieldClock(iso: string | null | undefined, now: number = Date.now()): { hours: number; minutes: number } | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return null;
  const minutes = Math.max(0, Math.floor((end - now) / 60_000));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Texto de erro das janelas do Escudo, em português claro, pelo código do servidor. */
export function describeShieldError(error: unknown): string {
  if (error instanceof AdminApiError) {
    const text = SHIELD_ERROR_TEXT[error.code];
    if (text) return text;
    if (error.status === 429) return "Muitas tentativas. Aguarde um instante.";
    return error.message;
  }
  return "Não foi possível concluir. Tente de novo.";
}

/** O erro trava as tentativas (5 códigos errados): a janela não pede de novo por 15 minutos. */
export function isShieldLocked(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === "SHIELD_CODE_LOCKED";
}
