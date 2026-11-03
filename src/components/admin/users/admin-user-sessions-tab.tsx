import { AdminKeyValueList, AdminSection } from "@/components/admin/platform";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import type { AdminUserDetail } from "@/shared/admin-platform.types";

import { LAST_SESSION_EXPLANATION, sessionClientText } from "./admin-users-format";

import "@/styles/admin-users.css";

/**
 * Aba Sessões: quantos logins ainda valem, a última sessão usada e onde. A data é uma aproximação: a explicação
 * (não é um registro de acessos) fica no "i" ao lado do rótulo, em vez de um parágrafo sempre aberto.
 */
export function AdminUserSessionsTab({ user }: { user: AdminUserDetail }) {
  const { active_count: activeCount, last_used_at: lastUsedAt, clients } = user.sessions;
  return (
    <AdminSection title="Sessões" description="Logins que ainda valem nesta conta.">
      <AdminKeyValueList
        items={[
          {
            label: "Sessões ativas",
            value: <span className="adm-num">{formatInt(activeCount)}</span>,
            hint:
              activeCount === 0
                ? "Nenhum login válido agora."
                : "Uma por aparelho ou navegador em que a pessoa entrou e ainda não saiu.",
          },
          {
            label: "Última sessão usada",
            value: lastUsedAt ? `aprox. ${formatDateTime(lastUsedAt)}` : "Nenhuma sessão aberta",
            hint: lastUsedAt ? formatRelativeTime(lastUsedAt) : "A pessoa nunca entrou ou já saiu.",
            definition: LAST_SESSION_EXPLANATION,
          },
          {
            label: "Conectada em",
            value: clients.length > 0 ? clients.map(sessionClientText).join(", ") : null,
          },
        ]}
      />
    </AdminSection>
  );
}
