import {
  AdminBadge,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminPager,
  AdminSkeleton,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { ADMIN_DUPLICATES_LIST_CONFIG, useAdminCreatorDuplicates } from "@/hooks/admin/use-admin-creators";
import { formatDate, formatInt } from "@/lib/admin/format";
import type { AdminDuplicateGroup } from "@/shared/admin-platform.types";

import {
  DUPLICATE_CONFIDENCE_HELP,
  DUPLICATE_CONFIDENCE_OPTIONS,
  DUPLICATE_REASON_LABEL,
  DUPLICATE_REASON_OPTIONS,
  EXTERNAL_ACCOUNT_HELP,
  EXTERNAL_ACCOUNT_LABEL,
} from "./creator-labels";

import "@/styles/admin-creators.css";

/** A nota que acompanha toda a aba: aqui nada é fundido, alterado nem decidido pelo sistema. */
export const DUPLICATES_READ_ONLY_NOTE = "Somente leitura: nada é fundido ou alterado automaticamente.";

function GroupUser({ user }: { user: AdminDuplicateGroup["users"][number] }) {
  return (
    <div className="adm-creators-gu" role="row">
      <div className="adm-creators-gu-who" role="cell">
        <span className="adm-creators-gu-name">
          <b title={user.name}>{user.name}</b>
          {user.is_external ? (
            <AdminBadge tone="muted" size="sm" title={EXTERNAL_ACCOUNT_HELP}>
              {EXTERNAL_ACCOUNT_LABEL}
            </AdminBadge>
          ) : null}
        </span>
        <small>#{user.id}</small>
      </div>
      <div className="adm-creators-gu-email" role="cell" data-label="E-mail">
        {user.email_masked}
      </div>
      <div role="cell" data-label="Cadastro em" className="adm-num">
        {formatDate(user.created_at)}
      </div>
      <div role="cell" data-label="Redes" className="adm-num">
        {formatInt(user.networks_count)}
      </div>
      <div role="cell" data-label="Campanhas" className="adm-num">
        {formatInt(user.campaigns_count)}
      </div>
    </div>
  );
}

/** Um grupo de contas que parecem ser a mesma pessoa: o motivo, a confiança, o valor em comum (mascarado) e as contas. */
function DuplicateGroupCard({ group }: { group: AdminDuplicateGroup }) {
  const reason = DUPLICATE_REASON_LABEL[group.reason] ?? group.reason;
  const high = group.confidence === "high";
  return (
    <article className="adm-creators-group" aria-label={`${reason}: ${group.match_masked}`}>
      <div className="adm-creators-group-h">
        <AdminBadge tone="outline" size="sm">
          {reason}
        </AdminBadge>
        <AdminBadge
          tone={high ? "warn" : "muted"}
          size="sm"
          title={DUPLICATE_CONFIDENCE_HELP[high ? "high" : "possible"]}
        >
          {high ? "Confiança alta" : "Confiança possível"}
        </AdminBadge>
        <p className="adm-creators-group-match">
          Valor em comum <code>{group.match_masked}</code>
        </p>
        <span className="adm-creators-group-count">
          {group.users.length} {group.users.length === 1 ? "conta" : "contas"}
        </span>
      </div>
      <div className="adm-creators-gu-table" role="table" aria-label={`Contas do grupo ${reason}: ${group.match_masked}`}>
        <div className="adm-creators-gu-head" role="row">
          <div role="columnheader">Criador</div>
          <div role="columnheader">E-mail</div>
          <div role="columnheader">Cadastro em</div>
          <div role="columnheader">Redes</div>
          <div role="columnheader">Campanhas</div>
        </div>
        {group.users.map((user) => (
          <GroupUser key={user.id} user={user} />
        ))}
      </div>
    </article>
  );
}

function GroupsSkeleton() {
  return (
    <div className="adm-creators-groups" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="adm-creators-group adm-creators-group-sk">
          <div className="adm-creators-group-h">
            <AdminSkeleton width={72} height={22} radius={999} />
            <AdminSkeleton width={116} height={22} radius={999} />
            <AdminSkeleton width={180} height={16} />
          </div>
          <AdminSkeleton height={14} width="70%" />
          <AdminSkeleton height={14} width="54%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Aba "Duplicados": grupos de contas que podem ser a mesma pessoa (e-mail, telefone, documento, rede social ou
 * conflito de identidade). Só leitura: não há botão de fundir nem de apagar, e o aviso fica sempre visível.
 */
export function AdminCreatorsDuplicates() {
  const list = useAdminListQueryState(ADMIN_DUPLICATES_LIST_CONFIG);
  const query = useAdminCreatorDuplicates(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const filters: AdminFilterDef[] = [{ kind: "select", key: "reason", label: "Motivo", options: DUPLICATE_REASON_OPTIONS }];
  const groups = query.data?.data;
  const hasRows = !!groups && groups.length > 0;
  const filtered = list.hasActiveFilters;

  return (
    <div className="adm-creators-panel">
      <p className="adm-creators-note" role="note">
        {DUPLICATES_READ_ONLY_NOTE}
      </p>

      <AdminFilterBar
        segment={{
          options: DUPLICATE_CONFIDENCE_OPTIONS,
          value: list.filters.confidence,
          onChange: (value) => list.setFilter("confidence", value),
          ariaLabel: "Confiança",
        }}
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch)}
        onClear={list.clearFilters}
      />

      {query.isLoading ? (
        <>
          <span className="adm-sr" role="status">
            Carregando…
          </span>
          <GroupsSkeleton />
        </>
      ) : query.error && !hasRows ? (
        <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : !hasRows ? (
        <AdminEmptyState
          boxed
          title={filtered ? "Nenhum grupo com estes filtros" : "Nenhum duplicado encontrado"}
          description={
            filtered
              ? "Tente outro motivo ou outra confiança."
              : "Nenhum grupo de contas com o mesmo e-mail, telefone, documento ou rede social."
          }
          action={
            filtered ? (
              <button type="button" className="btn out adm-btn-sm" onClick={list.clearFilters}>
                Mostrar todos os grupos
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {query.error ? <AdminErrorState boxed compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}
          <div className="adm-creators-groups" aria-busy={query.isFetching && !query.isLoading ? true : undefined}>
            {groups.map((group) => (
              <DuplicateGroupCard key={group.key} group={group} />
            ))}
          </div>
          <div className="adm-creators-pager">
            <AdminPager
              page={meta?.page ?? list.page}
              perPage={meta?.per_page ?? list.perPage}
              total={meta?.total ?? 0}
              perPageOptions={ADMIN_DUPLICATES_LIST_CONFIG.perPageOptions}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
              disabled={query.isFetching}
            />
          </div>
        </>
      )}
    </div>
  );
}
