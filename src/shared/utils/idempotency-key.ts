/** UUID v4 — usado como `Idempotency-Key` em POSTs que não podem duplicar. */
export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback simples (suficiente para idempotency, não criptográfico).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Devolve sempre a mesma chave para o mesmo conteúdo (`fingerprint`).
 *
 * Uma chave nova a cada tentativa não protege de nada: se o primeiro POST chegou
 * ao servidor mas a resposta se perdeu (timeout, queda de rede), o reenvio com
 * outra chave cria um segundo registro. Com a chave reaproveitada o servidor
 * reconhece o reenvio; conteúdo diferente é outro envio e ganha chave própria.
 *
 * Crie um por tela/formulário aberto: o escopo é a vida do keeper.
 */
export function createIdempotencyKeeper(): (fingerprint: string) => string {
  const keys = new Map<string, string>();
  return (fingerprint) => {
    let key = keys.get(fingerprint);
    if (!key) {
      key = generateIdempotencyKey();
      keys.set(fingerprint, key);
    }
    return key;
  };
}
