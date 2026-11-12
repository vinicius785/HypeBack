/** Regras e textos da tela pública "Primeiro acesso" (dono de uma conta criada pelo Admin, a partir do e-mail de convite). */
import { FirstAccessError } from "@/shared/services/auth";

export const FIRST_ACCESS_CODE_LENGTH = 6;
export const FIRST_ACCESS_PASSWORD_MIN = 8;
export const FIRST_ACCESS_PASSWORD_MAX = 255;

/** O que a pessoa digita ou cola no campo do código: só dígitos, até 6. */
export function normalizeFirstAccessCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, FIRST_ACCESS_CODE_LENGTH);
}

export const INVALID_INVITE_TEXT =
  "Este convite expirou ou o código está errado. Peça um novo convite à equipe do HypeApp ou use Esqueci a senha.";
export const TOO_MANY_ATTEMPTS_TEXT = "Muitas tentativas. Aguarde e tente de novo.";
export const GENERIC_FAILURE_TEXT = "Não foi possível definir a senha agora. Tente novamente.";

export interface FirstAccessErrorText {
  /** Aviso acima do botão (erros que não são de um campo). */
  form?: string;
  /** O convite expirou ou o código está errado: a tela oferece o link do "Esqueci a senha". */
  invalidInvite?: boolean;
  /** Conta suspensa (403 `ACCOUNT_SUSPENDED`): a tela mostra o aviso de suspensa, como o login. */
  suspended?: string;
  /** Textos junto de cada campo (validação do servidor). */
  fields?: Partial<Record<"email" | "code" | "password", string>>;
}

/**
 * Texto de cada erro do servidor. O "Código inválido ou expirado" é UMA mensagem só, de propósito: pode ser código errado,
 * vencido, já usado ou e-mail sem convite, e a tela não diferencia nem sugere qual.
 */
export function describeFirstAccessError(error: unknown): FirstAccessErrorText {
  if (!(error instanceof FirstAccessError)) return { form: GENERIC_FAILURE_TEXT };

  if (error.status === 429) return { form: TOO_MANY_ATTEMPTS_TEXT };
  if (error.status === 403 && error.code === "ACCOUNT_SUSPENDED") {
    return { suspended: error.messages[0] ?? "Conta suspensa. Entre em contato com o suporte." };
  }
  if (error.status === 400) {
    if (error.messages.some((m) => /^c[óo]digo inv[áa]lido ou expirado\.?$/i.test(m.trim()))) return { invalidInvite: true };
    // Validação: o servidor manda uma lista de textos; cada um vai para o campo a que se refere.
    const fields: FirstAccessErrorText["fields"] = {};
    const loose: string[] = [];
    for (const raw of error.messages) {
      const text = raw.trim();
      if (/e-?mail/i.test(text)) fields.email = fields.email ?? text;
      else if (/c[óo]digo|code/i.test(text)) fields.code = fields.code ?? text;
      else if (/senha|password/i.test(text)) fields.password = fields.password ?? text;
      else if (text) loose.push(text);
    }
    if (Object.keys(fields).length > 0 || loose.length > 0) {
      return { fields, form: loose.length > 0 ? loose.join(" ") : undefined };
    }
  }
  return { form: GENERIC_FAILURE_TEXT };
}
