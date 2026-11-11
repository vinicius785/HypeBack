/**
 * Lembra a busca, os filtros, a ordenação e a página de uma lista do Admin para a pessoa VOLTAR a ela do jeito que deixou
 * (por exemplo, abrir um usuário e voltar pela migalha "Usuários": o link sozinho não leva o que estava na URL). Fica só na
 * aba (`sessionStorage`) e na memória; nada vai para fora do navegador.
 */
type StoredSearch = Record<string, string | number>;

const PREFIX = "adm:list:";
const memory = new Map<string, StoredSearch>();

/** Guarda a busca atual da lista `key` (objeto vazio = tudo no padrão, e o que estava guardado some). */
export function rememberListSearch(key: string, search: StoredSearch): void {
  if (Object.keys(search).length === 0) {
    forgetListSearch(key);
    return;
  }
  memory.set(key, search);
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(search));
  } catch {
    // sem armazenamento (janela privada, bloqueado): fica só na memória
  }
}

/** O que a lista `key` tinha na URL da última vez, ou `undefined` (lista no padrão ou nunca aberta). */
export function recalledListSearch(key: string): StoredSearch | undefined {
  const inMemory = memory.get(key);
  if (inMemory) return inMemory;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const clean: StoredSearch = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string" || typeof value === "number") clean[name] = value;
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
  } catch {
    return undefined;
  }
}

export function forgetListSearch(key: string): void {
  memory.delete(key);
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ver acima
  }
}
