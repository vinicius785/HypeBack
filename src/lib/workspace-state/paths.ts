/**
 * Caminhos do app (sem o `basepath`, como o roteador devolve em `location.pathname`) que importam para o
 * estado do workspace.
 */

/**
 * Telas da conta da pessoa (Meu perfil), não do workspace: nada ali usa as chamadas que o servidor recusa com
 * workspace suspenso ou arquivado, então o bloqueio e o aviso de somente consulta não valem para elas.
 */
export function isAccountScopedPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/**
 * Detalhe que pertence a um workspace específico (`/campaigns/:id`, `/lives/:id`, `/influencer/:id`, e as telas
 * de criação). Quando o workspace some, essas telas não fazem sentido no próximo workspace.
 */
export function isWorkspaceDetailPath(pathname: string): boolean {
  return /^\/(campaigns|lives|influencer)\/[^/]+/.test(pathname);
}
