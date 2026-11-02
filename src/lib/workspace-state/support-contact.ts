/**
 * Contato do suporte nas telas de bloqueio (workspace suspenso, conta suspensa, exclusão impedida).
 *
 * O backoffice não tinha contato de suporte próprio. Este é o e-mail que o produto já usa: a página pública
 * de suporte do HypeApp (`public/suporte.html` da API) e o menu de configurações do app do criador. Não há
 * telefone nem WhatsApp de suporte no código, então nenhum é inventado aqui.
 */
export const SUPPORT_EMAIL = "suporte@hypeapp.com.br";

/** `mailto:` com assunto e corpo opcionais (codificados com `encodeURIComponent`: espaço vira `%20`, não `+`). */
export function supportMailto(subject?: string, body?: string): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}${params.length > 0 ? `?${params.join("&")}` : ""}`;
}
