/**
 * Operação Escudo: o código do Authenticator a cada ação do Admin.
 *
 * Com o Escudo ligado, toda alteração (POST/PUT/PATCH/DELETE em `/admin/**`) volta 403 `SHIELD_CODE_REQUIRED` sem o cabeçalho
 * `X-Shield-Code`. O cliente do Admin (`admin-client.ts`) pergunta o código por aqui e repete a MESMA chamada com o cabeçalho.
 *
 * Privacidade: o código só existe dentro da chamada de `askShieldCode` e do cabeçalho da requisição. Nunca vai para estado
 * global, armazenamento do navegador, URL nem log.
 */

export type ShieldCodeReason = "required" | "invalid" | "proactive";

/** Quem mostra o diálogo e devolve o código digitado, ou `null` se a pessoa cancelou. */
export type ShieldCodeProvider = (reason: ShieldCodeReason) => Promise<string | null>;

let provider: ShieldCodeProvider | null = null;
let shieldActive = false;

export function setShieldCodeProvider(next: ShieldCodeProvider | null): () => void {
  provider = next;
  return () => {
    if (provider === next) provider = null;
  };
}

/** O Escudo está ligado (vem de `GET shield`): com isso o código é pedido ANTES da ação, sem esperar o 403. */
export function setShieldActive(active: boolean): void {
  shieldActive = active;
}

export function isShieldActive(): boolean {
  return shieldActive;
}

export function hasShieldCodeProvider(): boolean {
  return provider !== null;
}

export function askShieldCode(reason: ShieldCodeReason): Promise<string | null> {
  return provider ? provider(reason) : Promise.resolve(null);
}

/** Rotas que nunca pedem o código: as do próprio Escudo, marcar alerta como visto e o Suporte. */
export function isShieldExempt(path: string): boolean {
  const clean = path.split("?")[0];
  return (
    clean.startsWith("/admin/security/shield") ||
    /^\/admin\/security\/alerts\/(seen-all|[^/]+\/seen)$/.test(clean) ||
    clean.startsWith("/admin/support")
  );
}

/** Só as alterações pedem o código. */
export function isShieldWrite(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

export const SHIELD_CODE_HEADER = "X-Shield-Code";

/** O código tem 6 dígitos. */
export function isShieldCodeComplete(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export const SHIELD_ERROR_TEXT: Record<string, string> = {
  SHIELD_CODE_REQUIRED: "Digite o código de 6 dígitos do Authenticator para continuar.",
  SHIELD_CODE_INVALID: "Código inválido ou já usado. Cada código vale uma vez: se acabou de usar um, espere o próximo.",
  SHIELD_CODE_LOCKED: "Muitas tentativas. Aguarde 15 minutos.",
  SHIELD_ALREADY_ACTIVE: "A Operação Escudo já está ativa.",
  SHIELD_NOT_ACTIVE: "A Operação Escudo não está ativa.",
  SHIELD_NOT_CONFIGURED: "Configuração pendente no servidor.",
  SHIELD_PAYOUT_UNAVAILABLE: "O pagamento (PIX) está indisponível agora. Nada foi liberado. Tente de novo em instantes.",
};

/**
 * `fetch` para as alterações do Admin que NÃO passam pelo cliente `admin-client.ts` (serviços antigos que montam o próprio
 * `fetch`). Faz o mesmo que ele com o Escudo: com o Escudo ligado pede o código ANTES da alteração; se o servidor responde 403
 * `SHIELD_CODE_REQUIRED`/`SHIELD_CODE_INVALID`, pede (de novo) e repete a MESMA chamada com `X-Shield-Code`. `SHIELD_CODE_LOCKED`
 * e o cancelamento devolvem a resposta como veio, para o serviço dar o erro dele. Leituras e rotas isentas passam direto.
 * `proactive: false` só reage ao 403 (rotas que parecem alteração mas só leem, como a estimativa de público).
 */
export async function shieldFetch(url: string, init: RequestInit & { method?: string }, options: { proactive?: boolean } = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const path = url.match(/\/admin\/[^?#]*/)?.[0] ?? "";
  if (!isShieldWrite(method) || isShieldExempt(path)) return fetch(url, init);

  const withCode = (code: string | undefined): RequestInit => {
    if (code === undefined) return init;
    const headers = new Headers(init.headers);
    headers.set(SHIELD_CODE_HEADER, code);
    return { ...init, headers };
  };

  let code: string | undefined;
  if (options.proactive !== false && isShieldActive() && hasShieldCodeProvider()) {
    const typed = await askShieldCode("proactive");
    if (typed === null) return new Response(JSON.stringify({ statusCode: 403, error: "SHIELD_CODE_REQUIRED", message: SHIELD_ERROR_TEXT.SHIELD_CODE_REQUIRED }), { status: 403, headers: { "Content-Type": "application/json" } });
    code = typed;
  }
  for (;;) {
    const res = await fetch(url, withCode(code));
    if (res.status !== 403 || !hasShieldCodeProvider()) return res;
    let body: unknown;
    try {
      body = await res.clone().json();
    } catch {
      return res;
    }
    const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
    if (error !== "SHIELD_CODE_REQUIRED" && error !== "SHIELD_CODE_INVALID") return res;
    const typed = await askShieldCode(error === "SHIELD_CODE_INVALID" ? "invalid" : "required");
    if (typed === null) return res;
    code = typed;
  }
}
