/** Regras e textos da tela pública "Redefinir com código" (equipe da plataforma). */
import { StaffResetError } from "@/shared/services/auth";

export const STAFF_PASSWORD_MIN = 12;
export const STAFF_PASSWORD_MAX = 255;

/**
 * Normaliza o que a pessoa digita ou cola no campo do código: tira tudo que não é letra ou número, põe em maiúsculas
 * e mostra no formato `XXXX-XXXX-XXXX` (aceita com ou sem hífens, em qualquer caixa).
 */
export function normalizeStaffCode(raw: string): string {
  const chars = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return (chars.match(/.{1,4}/g) ?? []).join("-");
}

/** O código está completo (12 letras ou números)? */
export function isStaffCodeComplete(code: string): boolean {
  return code.replace(/-/g, "").length === 12;
}

export const INVALID_CODE_TEXT = "Código inválido ou expirado. Peça um novo código a um admin.";

export interface StaffResetErrorText {
  /** Aviso acima do botão (erros que não são de um campo). */
  form?: string;
  /** Textos junto de cada campo (validação do servidor). */
  fields?: Partial<Record<"email" | "code" | "password", string>>;
}

/**
 * Texto de cada erro do servidor. O "Código inválido ou expirado" é UMA mensagem só, de propósito: pode ser código
 * errado, vencido, já usado ou e-mail que não é da equipe, e a tela não diferencia nem sugere qual.
 */
export function describeStaffResetError(error: unknown): StaffResetErrorText {
  if (!(error instanceof StaffResetError)) return { form: "Não foi possível redefinir a senha agora. Tente novamente." };

  if (error.status === 403 && error.code === "ANONYMIZER_BLOCKED") {
    return { form: "Não foi possível concluir por esta conexão. Desative VPN/proxy e tente novamente." };
  }
  if (error.status === 429) return { form: "Muitas tentativas. Aguarde e tente novamente." };
  if (error.status === 400) {
    if (error.messages.some((m) => /^código inválido ou expirado$/i.test(m.trim()))) return { form: INVALID_CODE_TEXT };
    // Validação: o servidor manda uma lista de textos; cada um vai para o campo a que se refere.
    const fields: StaffResetErrorText["fields"] = {};
    const loose: string[] = [];
    for (const raw of error.messages) {
      const text = raw.trim();
      if (/e-?mail/i.test(text)) fields.email = fields.email ?? text;
      else if (/c[óo]digo/i.test(text)) fields.code = fields.code ?? text;
      else if (/senha/i.test(text)) fields.password = fields.password ?? text;
      else if (text) loose.push(text);
    }
    if (Object.keys(fields).length > 0 || loose.length > 0) {
      return { fields, form: loose.length > 0 ? loose.join(" ") : undefined };
    }
  }
  return { form: "Não foi possível redefinir a senha agora. Tente novamente." };
}
