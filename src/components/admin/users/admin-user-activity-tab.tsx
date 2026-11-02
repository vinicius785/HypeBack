import { useState } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminPager,
  AdminSection,
  AdminSegmentedControl,
  AdminSkeleton,
  type AdminFilterOption,
} from "@/components/admin/platform";
import { useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminUserAudit, type AdminUserAuditView } from "@/hooks/admin/use-admin-users";

import { AdminUserAuditEntry } from "./admin-user-audit-entry";

import "@/styles/admin-users.css";

const EMPTY_TEXT_BY_VIEW: Record<AdminUserAuditView, { title: string; description: string }> = {
  target: {
    title: "Nenhuma ação registrada sobre esta conta",
    description: "Ninguém suspendeu, reativou nem encerrou as sessões desta conta pelo Admin da plataforma.",
  },
  actor: {
    title: "Nenhuma ação feita por esta pessoa",
    description: "Esta pessoa não fez nenhuma ação registrada no histórico de auditoria.",
  },
};

function ActivitySkeleton() {
  return (
    <div className="adm-users-log-skeleton" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="adm-users-log-skeleton-row" key={index}>
          <AdminSkeleton width={110} height={14} />
          <div>
            <AdminSkeleton width={`${46 + ((index * 13) % 28)}%`} height={16} />
            <AdminSkeleton width="34%" height={13} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Aba Atividade: a trilha de auditoria da conta. Duas visões, as duas vindas de `GET /admin/audit-log`:
 * as ações feitas SOBRE a conta (`target_type=user&target_id`) e as feitas POR esta pessoa (`actor_user_id`).
 * Cada ação abre o antes e o depois. As duas contagens aparecem no seletor.
 */
export function AdminUserActivityTab({ userId }: { userId: number }) {
  const [view, setView] = useState<AdminUserAuditView>("target");
  const [page, setPage] = useState(1);

  // As duas consultas ficam ligadas: a contagem de cada visão aparece no seletor, e trocar de visão é imediato.
  const target = useAdminUserAudit(userId, "target", view === "target" ? page : 1);
  const actor = useAdminUserAudit(userId, "actor", view === "actor" ? page : 1);
  const current = view === "target" ? target : actor;
  const meta = current.data?.meta;
  useAdminPageClamp(page, meta?.total_pages, setPage);

  const options: AdminFilterOption[] = [
    { value: "target", label: "Sobre esta conta", count: target.data?.meta.total },
    { value: "actor", label: "Feitas por esta pessoa", count: actor.data?.meta.total },
  ];
  const entries = current.data?.data ?? [];
  const showError = current.isError && !current.data;

  return (
    <AdminSection
      flush
      title="Histórico"
      description="Ações administrativas registradas na auditoria, da mais recente para a mais antiga."
    >
      <div className="adm-users-activity">
        <AdminSegmentedControl
          ariaLabel="Visão do histórico"
          options={options}
          value={view}
          onChange={(next) => {
            setView(next as AdminUserAuditView);
            setPage(1);
          }}
        />

        {current.isLoading ? (
          <>
            <span className="adm-sr" role="status">
              Carregando histórico…
            </span>
            <ActivitySkeleton />
          </>
        ) : showError ? (
          <AdminErrorState compact error={current.error} onRetry={() => void current.refetch()} retrying={current.isFetching} />
        ) : entries.length === 0 ? (
          <AdminEmptyState compact {...EMPTY_TEXT_BY_VIEW[view]} />
        ) : (
          <ol className="adm-users-log" aria-label="Histórico de ações" aria-busy={current.isFetching ? true : undefined}>
            {entries.map((entry) => (
              <AdminUserAuditEntry key={entry.id} entry={entry} view={view} />
            ))}
          </ol>
        )}
      </div>

      {meta ? (
        <div className="adm-users-activity-foot">
          <AdminPager
            page={meta.page}
            perPage={meta.per_page}
            total={meta.total}
            onPageChange={setPage}
            disabled={current.isFetching}
          />
        </div>
      ) : null}
    </AdminSection>
  );
}
