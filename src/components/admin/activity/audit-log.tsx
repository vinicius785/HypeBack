import {
  AdminKeyValueList,
  AdminLink,
  AdminPager,
  AdminTable,
  type AdminKeyValueItem,
  type AdminLinkTarget,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminAuditLog } from "@/hooks/admin/use-admin-activity";
import { useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import type { AdminQuery } from "@/lib/admin/admin-client";
import { formatDateTime } from "@/lib/admin/format";
import type { AdminAuditLogEntry } from "@/shared/admin-platform.types";

import { isAuditTargetType } from "./activity-search";
import { AUDIT_EMPTY, buildAuditDiff, buildAuditFacts } from "./audit-diff";
import { actorRoleLabel, AUDIT_TARGET_LABEL } from "./audit-labels";

import "@/styles/admin-activity.css";

/** `workspace_member` traz o usuário afetado no id: numérico (contrato) ou `<workspace>:<usuário>`. */
function affectedUserId(target: AdminAuditLogEntry["target"]): string | null {
  if (target.type === "user") return /^\d+$/.test(target.id) ? target.id : null;
  if (target.type === "workspace_member") {
    const tail = target.id.split(":").pop() ?? "";
    return /^\d+$/.test(tail) ? tail : null;
  }
  return null;
}

/** Para onde leva o alvo da alteração. */
function targetLink(target: AdminAuditLogEntry["target"]): AdminLinkTarget | undefined {
  if (target.type === "workspace") return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: target.id } };
  const userId = affectedUserId(target);
  return userId ? { to: "/admin/users/$userId", params: { userId } } : undefined;
}

function targetText(target: AdminAuditLogEntry["target"]): string {
  return target.label ?? target.id;
}

function actorName(actor: AdminAuditLogEntry["actor"]): string {
  if (actor.name) return actor.name;
  return actor.user_id !== null ? `Usuário ${actor.user_id}` : "Usuário removido";
}

/** Antes e depois, campo a campo. Tabela com a semântica do kit (`table` › `rowgroup` › `row` › `columnheader`/`rowheader`/`cell`). */
function DiffTable({ rows }: { rows: ReturnType<typeof buildAuditDiff> }) {
  return (
    <div className="adm-act-diff" role="table" aria-label="O que mudou">
      <div role="rowgroup">
        <div className="adm-act-diff-row adm-act-diff-head" role="row">
          <span role="columnheader">Campo</span>
          <span role="columnheader">Antes</span>
          <span role="columnheader">Depois</span>
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => (
          <div className="adm-act-diff-row" role="row" key={row.key}>
            <span className="adm-act-diff-field" role="rowheader">
              {row.label}
            </span>
            <span className="adm-act-diff-before" role="cell" data-label="Antes" data-empty={row.before === AUDIT_EMPTY ? "true" : undefined}>
              {row.before}
            </span>
            <span className="adm-act-diff-after" role="cell" data-label="Depois" data-empty={row.after === AUDIT_EMPTY ? "true" : undefined}>
              {row.after}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "O que mudou" (antes → depois) e, quando há, o impacto que o servidor registrou na hora da ação. */
function AuditChanges({ entry }: { entry: AdminAuditLogEntry }) {
  const diff = buildAuditDiff(entry.before_state, entry.after_state);
  const facts = buildAuditFacts(entry.impact);
  return (
    <>
      <section className="adm-act-sub" aria-label="O que mudou">
        <h4>O que mudou</h4>
        {diff.length > 0 ? <DiffTable rows={diff} /> : <p className="adm-act-sub-empty">Esta ação não registrou campos alterados.</p>}
      </section>
      {facts.length > 0 ? (
        <section className="adm-act-sub" aria-label="Impacto no momento da ação">
          <h4>Impacto no momento da ação</h4>
          <dl className="adm-act-facts">
            {facts.map((fact) => (
              <div key={fact.key}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

/** A linha aberta: motivo inteiro, alvo, quem fez, IP, e o antes e depois. Só é montada (e calculada) com a linha aberta. */
function AuditDetail({ entry }: { entry: AdminAuditLogEntry }) {
  const target = targetLink(entry.target);
  const targetType = isAuditTargetType(entry.target.type) ? AUDIT_TARGET_LABEL[entry.target.type] : entry.target.type;
  const workspace = entry.workspace;

  return (
    <div className="adm-act-entry-body" role="region" aria-label={`Detalhes: ${entry.action_label}`}>
      <AdminKeyValueList
        items={
          [
            { label: "Motivo", value: <span className="adm-act-reason-full">{entry.reason}</span> },
            {
              label: "Alvo",
              value: (
                <span>
                  {targetType} ·{" "}
                  {target ? (
                    <AdminLink to={target} textLink>
                      {targetText(entry.target)}
                    </AdminLink>
                  ) : (
                    targetText(entry.target)
                  )}
                </span>
              ),
            },
            {
              label: "Workspace",
              value: workspace ? (
                <AdminLink to={{ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } }} textLink>
                  {workspace.name}
                </AdminLink>
              ) : null,
            },
            {
              label: "Feito por",
              value: actorName(entry.actor),
              hint: [entry.actor.email, actorRoleLabel(entry.actor.role)].filter(Boolean).join(" · "),
            },
            { label: "Quando", value: `${formatDateTime(entry.created_at)} (horário de São Paulo)` },
            { label: "IP", value: entry.ip ?? "Não registrado" },
            { label: "Registro", value: `Alteração nº ${entry.id}` },
          ] satisfies AdminKeyValueItem[]
        }
      />
      <AuditChanges entry={entry} />
    </div>
  );
}

const COLUMNS: readonly AdminTableColumn<AdminAuditLogEntry>[] = [
  {
    key: "action",
    header: "Alteração",
    width: "minmax(0, 1.4fr)",
    primary: true,
    cell: (entry) => {
      const { workspace } = entry;
      const showWorkspace = workspace && !(entry.target.label ?? "").includes(workspace.name);
      return (
        <div className="adm-act-what">
          <b>{entry.action_label}</b>
          <span className="adm-sub">
            {targetText(entry.target)}
            {showWorkspace ? ` · ${workspace.name}` : ""}
          </span>
        </div>
      );
    },
  },
  { key: "actor", header: "Feito por", width: "minmax(0, 0.9fr)", cell: (entry) => actorName(entry.actor) },
  {
    key: "reason",
    header: "Motivo",
    width: "minmax(0, 1.5fr)",
    cell: (entry) => <span className="adm-act-reason-cell">{entry.reason}</span>,
  },
  {
    key: "created_at",
    header: "Quando",
    width: "120px",
    nowrap: true,
    cell: (entry) => {
      const [date, time] = formatDateTime(entry.created_at).split(" ");
      return (
        <time className="adm-act-when" dateTime={entry.created_at}>
          <span>{date}</span>
          {time ? <small>{time}</small> : null}
        </time>
      );
    },
  },
];

interface AuditLogProps {
  /** Página, filtros e período já prontos para `GET /admin/audit-log`. */
  params: AdminQuery;
  page: number;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  filtered: boolean;
  onClearFilters: () => void;
}

/**
 * Alterações administrativas: quem mudou o quê, quando e por quê (`platform_admin_action_log`), da mais recente
 * para a mais antiga. Cada alteração abre (o botão do início da linha) para mostrar o motivo inteiro, o antes/depois
 * campo a campo, o impacto registrado e o IP.
 */
export function AuditLog({ params, page, setPage, setPerPage, filtered, onClearFilters }: AuditLogProps) {
  const query = useAdminAuditLog(params);
  const entries = query.data?.data;
  const meta = query.data?.meta;
  useAdminPageClamp(page, meta?.total_pages, setPage);

  return (
    <div className="adm-act-stack">
      <p className="adm-act-note">Toda mudança feita pelo time da plataforma em workspaces, membros e usuários, com o motivo informado. Abra uma linha para ver o antes e o depois.</p>

      <AdminTable
        caption="Alterações administrativas"
        columns={COLUMNS}
        rows={entries}
        rowKey={(entry) => entry.id}
        renderExpanded={(entry) => <AuditDetail entry={entry} />}
        expandLabel={(entry) => `Detalhes: ${entry.action_label}, ${targetText(entry.target)}`}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        skeletonRows={6}
        empty={{
          title: filtered ? "Nenhuma alteração com estes filtros" : "Nenhuma alteração no período",
          description: filtered ? "Tente outra ação, outro alvo ou um período maior." : "Tente um período maior.",
          action: filtered ? (
            <button type="button" className="btn out adm-btn-sm" onClick={onClearFilters}>
              Limpar filtros
            </button>
          ) : undefined,
        }}
        footer={
          meta && meta.total > 0 ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />
    </div>
  );
}
