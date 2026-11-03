import { Fragment } from "react";

import {
  AdminBadge,
  AdminFilterBar,
  AdminInfoPopover,
  AdminLink,
  AdminPager,
  AdminRefreshButton,
  AdminTable,
  type AdminFilterDef,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { ADMIN_DUPLICATES_LIST_CONFIG, useAdminCreatorDuplicates } from "@/hooks/admin/use-admin-creators";
import { formatDate, formatInt } from "@/lib/admin/format";
import type { AdminDuplicateGroup } from "@/shared/admin-platform.types";

import { userTarget } from "./admin-creators-cells";
import {
  DUPLICATE_CONFIDENCE_HELP,
  DUPLICATE_CONFIDENCE_OPTIONS,
  DUPLICATE_REASON_LABEL,
  DUPLICATE_REASON_OPTIONS,
  EXTERNAL_ACCOUNT_HELP,
  EXTERNAL_ACCOUNT_LABEL,
} from "./creator-labels";

import "@/styles/admin-creators.css";

type GroupUser = AdminDuplicateGroup["users"][number];

/** "1 rede", "3 redes": o número com a palavra no singular ou no plural. */
function countOf(value: number, one: string, many: string): string {
  return `${formatInt(value)} ${value === 1 ? one : many}`;
}

function reasonLabel(group: AdminDuplicateGroup): string {
  return DUPLICATE_REASON_LABEL[group.reason] ?? group.reason;
}

/** O motivo do grupo, o valor em comum (mascarado) e quantas contas ele reúne. */
function GroupCell({ group }: { group: AdminDuplicateGroup }) {
  return (
    <div className="adm-creators-grp">
      <AdminBadge tone="outline" size="sm">
        {reasonLabel(group)}
      </AdminBadge>
      <code>{group.match_masked}</code>
      <small>{countOf(group.users.length, "conta", "contas")}</small>
    </div>
  );
}

function ConfidenceCell({ group }: { group: AdminDuplicateGroup }) {
  const high = group.confidence === "high";
  return (
    <AdminBadge tone={high ? "warn" : "muted"} size="sm">
      {high ? "Alta" : "Possível"}
    </AdminBadge>
  );
}

/**
 * Uma conta do grupo: o nome (leva ao usuário) e, embaixo, id, e-mail mascarado, cadastro, redes e campanhas. Cada
 * dado é um trecho que não parte no meio (no celular a linha quebra entre os "·", não dentro de "1 rede" ou de uma data).
 */
function AccountItem({ user }: { user: GroupUser }) {
  const facts = [
    { key: "id", text: `#${user.id}` },
    { key: "email", text: user.email_masked },
    { key: "created", text: `Cadastrado em ${formatDate(user.created_at)}` },
    { key: "networks", text: countOf(user.networks_count, "rede", "redes") },
    { key: "campaigns", text: countOf(user.campaigns_count, "campanha", "campanhas") },
  ];
  return (
    <li>
      <span className="adm-creators-acct-name">
        <AdminLink to={userTarget(user.id)} textLink>
          {user.name}
        </AdminLink>
        {user.is_external ? (
          <AdminBadge tone="muted" size="sm" title={EXTERNAL_ACCOUNT_HELP}>
            {EXTERNAL_ACCOUNT_LABEL}
          </AdminBadge>
        ) : null}
      </span>
      <small className="adm-creators-acct-facts">
        {facts.map((fact, index) => (
          <Fragment key={fact.key}>
            {index > 0 ? " · " : null}
            <span data-fact={fact.key}>{fact.text}</span>
          </Fragment>
        ))}
      </small>
    </li>
  );
}

function AccountsCell({ group }: { group: AdminDuplicateGroup }) {
  return (
    <ul className="adm-creators-accts" aria-label={`Contas do grupo ${reasonLabel(group)}: ${group.match_masked}`}>
      {group.users.map((user) => (
        <AccountItem key={user.id} user={user} />
      ))}
    </ul>
  );
}

/**
 * Aba "Duplicados": grupos de contas que podem ser a mesma pessoa (e-mail, telefone, documento, rede social ou
 * conflito de identidade), numa `AdminTable` com um grupo por linha. Só leitura: não há botão de fundir nem de apagar
 * (o aviso fica no subtítulo da página). O nome de cada conta leva ao usuário.
 */
export function AdminCreatorsDuplicates() {
  const list = useAdminListQueryState(ADMIN_DUPLICATES_LIST_CONFIG);
  const query = useAdminCreatorDuplicates(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  // O motivo fica na linha da barra, à vista: é o filtro que esta aba tem além da confiança (o segmento).
  const filters: AdminFilterDef[] = [
    { kind: "select", key: "reason", label: "Motivo", options: DUPLICATE_REASON_OPTIONS, inline: true },
  ];

  const columns: AdminTableColumn<AdminDuplicateGroup>[] = [
    {
      key: "group",
      header: "Grupo",
      primary: true,
      width: "minmax(0, 1.6fr)",
      cell: (group) => <GroupCell group={group} />,
      definition: "O valor que as contas do grupo têm em comum. E-mail e telefone aparecem mascarados.",
    },
    {
      key: "confidence",
      header: "Confiança",
      width: "112px",
      cell: (group) => <ConfidenceCell group={group} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>{DUPLICATE_CONFIDENCE_HELP.high}</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>{DUPLICATE_CONFIDENCE_HELP.possible}</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "accounts",
      header: "Contas",
      wide: true,
      width: "minmax(0, 3fr)",
      cell: (group) => <AccountsCell group={group} />,
      definition: EXTERNAL_ACCOUNT_HELP,
    },
  ];

  const filtered = list.hasActiveFilters;

  return (
    <>
      <AdminFilterBar
        segment={{
          options: DUPLICATE_CONFIDENCE_OPTIONS,
          value: list.filters.confidence,
          onChange: (value) => list.setFilter("confidence", value),
          ariaLabel: "Confiança",
        }}
        segmentDefault=""
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch)}
        onClear={list.clearFilters}
        trailing={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
      />

      <AdminTable
        caption="Duplicados"
        columns={columns}
        rows={query.data?.data}
        rowKey={(group) => group.key}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        skeletonRows={4}
        empty={
          filtered
            ? {
                title: "Nenhum grupo com estes filtros",
                description: "Tente outro motivo ou outra confiança.",
                action: (
                  <button type="button" className="btn out adm-btn-sm" onClick={list.clearFilters}>
                    Limpar filtros
                  </button>
                ),
              }
            : {
                title: "Nenhum duplicado encontrado",
                description: "Nenhum grupo de contas com o mesmo e-mail, telefone, documento ou rede social.",
              }
        }
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              perPageOptions={ADMIN_DUPLICATES_LIST_CONFIG.perPageOptions}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />
    </>
  );
}
