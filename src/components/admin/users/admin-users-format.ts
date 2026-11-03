/**
 * Vocabulário e formatos de Usuários do Admin: tipos da conta, onde a sessão está aberta, a "última sessão"
 * (que é uma aproximação, e a tela diz isso) e telefone.
 *
 * O resto do vocabulário (status, papéis, datas, dinheiro) vem do kit: `@/lib/admin/labels` e `@/lib/admin/format`.
 */
import { EMPTY_TEXT, formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { WORKSPACE_ROLE_LABEL } from "@/lib/admin/labels";
import type { AdminUserKind } from "@/shared/admin-platform.types";

/**
 * Tipo da conta como o produto fala ("marca" é o lado cliente: types 20, 30 e 100 do contrato).
 * "Administrador" é o TIPO da conta (type 100); ser administrador da plataforma é outra coisa (`is_platform_admin`).
 */
export const USER_KIND_TEXT: Record<AdminUserKind, string> = {
  brand: "Marca",
  agency: "Agência",
  admin: "Administrador",
  creator: "Criador",
};

/** Um tipo novo do backend (fora da união conhecida) aparece como veio, em vez de quebrar a tela. */
export function userKindText(kind: string): string {
  return (USER_KIND_TEXT as Record<string, string>)[kind] ?? kind;
}

/** Papel num workspace; um papel novo do backend aparece como veio. */
export function workspaceRoleText(role: string): string {
  return (WORKSPACE_ROLE_LABEL as Record<string, string>)[role] ?? role;
}

/** `sessions.clients` do contrato: `'backoffice' | 'mobile-app'`. */
const SESSION_CLIENT_TEXT: Record<string, string> = {
  backoffice: "Backoffice (navegador)",
  "mobile-app": "App (celular)",
};

export function sessionClientText(client: string): string {
  return SESSION_CLIENT_TEXT[client] ?? client;
}

/** A explicação de "última sessão", que aparece no "i" da coluna da lista e no "i" da aba Sessões. */
export const LAST_SESSION_EXPLANATION =
  "Aproximação (margem de ±5 minutos): é o último uso de uma sessão ainda aberta. Quando a pessoa sai do app, a sessão é apagada e a data some. Por isso não é um registro de acessos.";

/**
 * "aprox. há 3 horas" para a célula da lista (o instante exato vai embaixo e a regra no "i" da coluna). `null` quando
 * não há sessão aberta (nunca entrou, ou saiu): a tela diz "Sem sessão aberta".
 */
export function approxSessionText(
  iso: string | null | undefined,
  now: number | Date = Date.now(),
): { text: string } | null {
  if (!iso) return null;
  const when = formatRelativeTime(iso, now);
  if (when === EMPTY_TEXT) return null;
  return { text: `aprox. ${when}` };
}

/**
 * Telefone brasileiro legível: `(11) 99999-8888` (com `+55` quando veio com o código do país). Número de outro país
 * e qualquer formato que não seja de celular ou fixo com DDD aparecem como vieram, sem tentar adivinhar.
 */
export function formatPhone(phone: string | null | undefined): string | null {
  const text = phone?.trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+") && !digits.startsWith("55")) return text;
  const hasCountry = digits.length >= 12 && digits.startsWith("55");
  const national = hasCountry ? digits.slice(2) : digits;
  const mobile = /^([1-9][1-9])(9\d{4})(\d{4})$/.exec(national);
  const landline = /^([1-9][1-9])([2-9]\d{3})(\d{4})$/.exec(national);
  const match = mobile ?? landline;
  if (!match) return text;
  const formatted = `(${match[1]}) ${match[2]}-${match[3]}`;
  return hasCountry ? `+55 ${formatted}` : formatted;
}

/** Só a hora de um instante ("14:05", fuso de São Paulo): o dia já está no cabeçalho do grupo da linha do tempo. */
export function formatTimeOfDay(iso: string | null | undefined): string {
  const text = formatDateTime(iso);
  return text === EMPTY_TEXT ? EMPTY_TEXT : text.slice(-5);
}
