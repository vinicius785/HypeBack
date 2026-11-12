import { civilDateInSaoPaulo } from "@/lib/admin/format";

import { useAdminUsers } from "./use-admin-users";

/** Uma sessão aberta há até 5 minutos conta como "online agora" (a sessão é aproximada, como a coluna "Última sessão"). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
/** A lista de atividade lê 100 contas (o máximo por página): acima disso o número vira "100+". */
export const ACTIVITY_PAGE = 100;
const LIVE_REFRESH_MS = 30_000;

export interface UsersActivity {
  /** `null` enquanto a primeira leitura não chegou. */
  activeToday: number | null;
  online: number | null;
  /** A leitura bateu no limite de 100: os números são "100 ou mais". */
  capped: boolean;
}

/**
 * Usuários com sessão hoje (dia de São Paulo) e online agora (sessão nos últimos 5 minutos). A API não conta por sessão:
 * lê as 100 contas de marca ativas com sessão mais recente e conta no navegador, a cada 30 segundos. Compartilhado pela
 * ilha de Pessoas e pelo cartão de Usuários do Dashboard (mesma consulta, em cache).
 */
export function useUsersActivity(): UsersActivity {
  const query = useAdminUsers(
    { page: 1, per_page: ACTIVITY_PAGE, sort_by: "last_session", order: "desc", status: "active" },
    { refetchInterval: LIVE_REFRESH_MS },
  );
  const rows = query.data?.data;
  if (!rows) return { activeToday: null, online: null, capped: false };
  const today = civilDateInSaoPaulo();
  const now = Date.now();
  const sessions = rows.map((u) => (u.last_session_at ? Date.parse(u.last_session_at) : NaN)).filter((t) => Number.isFinite(t));
  const activeToday = sessions.filter((t) => civilDateInSaoPaulo(t) === today).length;
  const online = sessions.filter((t) => now - t <= ONLINE_WINDOW_MS).length;
  return { activeToday, online, capped: activeToday >= ACTIVITY_PAGE || online >= ACTIVITY_PAGE };
}
