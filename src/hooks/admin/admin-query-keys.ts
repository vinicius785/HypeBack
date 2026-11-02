/**
 * Chaves de cache do Admin da plataforma: todas começam com `['admin', 'platform']`.
 *
 * - `adminKeys.all` pega tudo do Admin novo (use ao encerrar a sessão);
 * - `adminKeys.resource('workspaces')` pega listas, detalhes e feeds de workspaces: é o que se invalida
 *   depois de uma ação (suspender, arquivar, editar);
 * - parâmetros vazios (`undefined`, `null`, `''`) não entram na chave: `{ search: '' }` e `{}` são a
 *   mesma lista e dividem o cache.
 *
 * O prefixo `['admin', 'platform']` é próprio: os hooks antigos (`['admin', 'dashboard', ...]`,
 * `['admin-groups', ...]`) seguem como estão.
 */
const ROOT = ["admin", "platform"] as const;

type Params = Record<string, unknown> | undefined;
export type AdminKeyScope = readonly (string | number)[];

/** Tira `undefined`, `null` e `''`: parâmetro vazio não muda o resultado nem a chave. */
export function cleanAdminParams(params: Params): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export const adminKeys = {
  all: ROOT,
  /** Tudo de um recurso (`workspaces`, `users`, `campaigns`...): listas, detalhes, feeds e o que mais houver. */
  resource: (resource: string) => [...ROOT, resource] as const,
  /** Lista paginada. `scope` identifica sub-listas (`['members', workspaceId]`). */
  list: (resource: string, params?: Params, scope: AdminKeyScope = []) =>
    [...ROOT, resource, "list", ...scope, cleanAdminParams(params)] as const,
  /** Um registro; `scope` para as partes dele (`['financial']`, `['impact']`). */
  detail: (resource: string, id: string | number, scope: AdminKeyScope = [], params?: Params) =>
    [...ROOT, resource, "detail", String(id), ...scope, cleanAdminParams(params)] as const,
  /** Feed por cursor (atividade, movimentações). */
  feed: (resource: string, params?: Params, scope: AdminKeyScope = []) =>
    [...ROOT, resource, "feed", ...scope, cleanAdminParams(params)] as const,
  /** Qualquer outra consulta (overview, resumo financeiro, alertas). */
  of: (resource: string, ...rest: readonly unknown[]) => [...ROOT, resource, ...rest] as const,
};
