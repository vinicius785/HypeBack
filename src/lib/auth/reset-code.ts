/**
 * "Esqueci a senha" numa tela só: o mesmo campo de código aceita o código de 6 dígitos enviado por e-mail (contas comuns) OU
 * o código de 12 caracteres que um admin gera para a equipe (XXXX-XXXX-XXXX). A tela não pergunta nem revela de que tipo é a
 * conta: o formato do código decide o endpoint (a API responde igual para qualquer e-mail, de propósito).
 */
import { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN } from "./staff-reset";

export type ResetCodeKind = "email" | "staff" | "incomplete";

export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_PASSWORD_MIN = 8;
export { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN };

/**
 * Normaliza o que a pessoa digita ou cola: só letras e números, em maiúsculas, até 12. Quem digita só dígitos (até 6) vê o
 * código do e-mail como está; o resto aparece no formato do código de admin, `XXXX-XXXX-XXXX`.
 */
export function normalizeResetCode(raw: string): string {
  const chars = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  if (/^\d{0,6}$/.test(chars)) return chars;
  return (chars.match(/.{1,4}/g) ?? []).join("-");
}

/** Que código é: 6 dígitos (e-mail), 12 letras ou números (admin) ou ainda incompleto/inválido. */
export function resetCodeKind(code: string): ResetCodeKind {
  const chars = code.replace(/-/g, "");
  if (/^\d{6}$/.test(chars)) return "email";
  if (/^[A-Za-z0-9]{12}$/.test(chars)) return "staff";
  return "incomplete";
}

/** Menor tamanho de senha: 12 para o código de admin (conta da equipe) e 8 para o do e-mail. */
export function passwordMinFor(kind: ResetCodeKind): number {
  return kind === "staff" ? STAFF_PASSWORD_MIN : EMAIL_PASSWORD_MIN;
}
