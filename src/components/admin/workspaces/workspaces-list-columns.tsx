import { AdminEntityCell, AdminStatusBadge, type AdminTableColumn } from "@/components/admin/platform";
import {
  formatBRLFromCents,
  formatDate,
  formatDateTime,
  formatInt,
  formatRelativeTime,
} from "@/lib/admin/format";
import { WORKSPACE_KIND_LABEL, workspaceActivityDescription } from "@/lib/admin/labels";
import type { AdminWorkspaceActivity, AdminWorkspaceListItem } from "@/shared/admin-platform.types";

import { formatCnpj, shortPublicId } from "./workspace-format";

import "@/styles/admin-workspaces.css";

/**
 * A chave do `meta.definitions` é "o id da coluna na tabela da tela". O contrato dá exemplos (`funded`,
 * `custody`, `creators`, `last_session`) e o servidor pode usar o nome do campo (`funded_cents`...): vale o
 * primeiro que existir. Coluna sem definição do servidor fica sem o "i": a tela não escreve regra por conta própria.
 */
function definitionOf(definitions: Record<string, string> | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const text = definitions?.[key];
    if (text) return text;
  }
  return undefined;
}

/** "Tipo · CNPJ · #identificador": o que identifica o cliente sem abrir o detalhe. O uuid inteiro fica na dica. */
function WorkspaceNameCell({ workspace }: { workspace: AdminWorkspaceListItem }) {
  const parts = [
    workspace.kind !== "brand" ? (WORKSPACE_KIND_LABEL[workspace.kind] ?? workspace.kind) : null,
    workspace.tax_id ? formatCnpj(workspace.tax_id) : null,
    `#${shortPublicId(workspace.id)}`,
  ].filter(Boolean);
  return (
    <AdminEntityCell
      name={workspace.name}
      photo={workspace.photo}
      shape="square"
      subtitle={<span title={`Identificador público: ${workspace.id}`}>{parts.join(" · ")}</span>}
    />
  );
}

function OwnerCell({ workspace }: { workspace: AdminWorkspaceListItem }) {
  const { owner, owners_count: count } = workspace;
  if (!owner) {
    return (
      <span className="adm-workspaces-noowner" title="Este workspace não tem nenhum proprietário: inconsistência a investigar.">
        Sem responsável
      </span>
    );
  }
  return (
    <div className="adm-workspaces-owner">
      <span className="adm-workspaces-owner-text">
        <b title={owner.name}>{owner.name}</b>
        <small title={owner.email}>{owner.email}</small>
      </span>
      {count > 1 ? (
        <span className="adm-workspaces-more" title={`${count} proprietários`}>
          +{count - 1}
        </span>
      ) : null}
    </div>
  );
}

const ACTIVITY_WORD: Record<AdminWorkspaceActivity["state"], string> = {
  active: "Ativo",
  inactive: "Inativo",
  never: "Sem atividade",
};

/** A atividade REAL derivada (não é o status do ciclo de vida): "Ativo · há 2 dias", "Inativo · 12/03/2026", "Sem atividade". */
export function WorkspaceActivityLine({ activity }: { activity: AdminWorkspaceActivity }) {
  const last = activity.last_activity_at;
  const description = workspaceActivityDescription(activity.state, activity.window_days);
  return (
    <span
      className="adm-workspaces-activity"
      data-state={activity.state}
      title={last ? `${description}. Última atividade em ${formatDateTime(last)}.` : description}
    >
      {ACTIVITY_WORD[activity.state] ?? activity.state}
      {last && activity.state !== "never" ? <> · {formatRelativeTime(last)}</> : null}
    </span>
  );
}

const SORT_NOTE = "Ordenar por esta coluna ordena pela atividade mais recente.";

/**
 * Colunas da lista de Workspaces. Nove no desktop largo; `hideBelow` tira as menos decisivas conforme a
 * tabela estreita (os limites de largura desta tabela estão em `admin-workspaces.css`). No celular a linha
 * vira bloco com todos os dados e o seletor "Ordenar por" lista todas as colunas ordenáveis.
 */
export function buildWorkspaceColumns(definitions: Record<string, string> | undefined): AdminTableColumn<AdminWorkspaceListItem>[] {
  const activityDefinition = definitionOf(definitions, "activity");
  const defined = (text: string | undefined) => (text ? <p>{text}</p> : undefined);

  return [
    {
      key: "workspace",
      header: "Workspace",
      sortKey: "name",
      primary: true,
      width: "minmax(0, 2.2fr)",
      cell: (w) => <WorkspaceNameCell workspace={w} />,
    },
    {
      key: "owner",
      header: "Responsável",
      width: "minmax(0, 1.6fr)",
      definition: defined(definitionOf(definitions, "owner")),
      cell: (w) => <OwnerCell workspace={w} />,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "last_activity",
      width: "148px",
      definition: (
        <>
          {activityDefinition ? <p>{activityDefinition}</p> : null}
          <p>{SORT_NOTE}</p>
        </>
      ),
      cell: (w) => (
        <div className="adm-workspaces-status">
          <AdminStatusBadge kind="workspace" value={w.status} size="sm" />
          <WorkspaceActivityLine activity={w.activity} />
        </div>
      ),
    },
    {
      key: "members",
      header: "Membros",
      sortKey: "members",
      width: "84px",
      align: "right",
      hideBelow: "lg",
      definition: defined(definitionOf(definitions, "members", "members_count")),
      cell: (w) => <span className="adm-num">{formatInt(w.members_count)}</span>,
    },
    {
      key: "campaigns",
      header: "Campanhas",
      sortKey: "campaigns",
      width: "100px",
      align: "right",
      hideBelow: "md",
      definition: defined(definitionOf(definitions, "campaigns", "campaigns_count")),
      cell: (w) => (
        <span
          className="adm-num"
          title={`${formatInt(w.published_campaigns_count)} ${w.published_campaigns_count === 1 ? "publicada" : "publicadas"} de ${formatInt(w.campaigns_count)}`}
        >
          <b>{formatInt(w.published_campaigns_count)}</b>
          <span className="adm-muted"> / {formatInt(w.campaigns_count)}</span>
        </span>
      ),
    },
    {
      key: "creators",
      header: "Criadores",
      width: "88px",
      align: "right",
      hideBelow: "lg",
      definition: defined(definitionOf(definitions, "creators", "creators_count")),
      cell: (w) => <span className="adm-num">{formatInt(w.creators_count)}</span>,
    },
    {
      key: "funded",
      header: "Aportes",
      sortKey: "volume",
      width: "132px",
      align: "right",
      nowrap: true,
      definition: defined(definitionOf(definitions, "funded", "funded_cents")),
      cell: (w) => <span className="adm-num">{formatBRLFromCents(w.funded_cents)}</span>,
    },
    {
      key: "custody",
      header: "Em custódia",
      width: "132px",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      definition: defined(definitionOf(definitions, "custody", "custody_cents")),
      cell: (w) => <span className="adm-num">{formatBRLFromCents(w.custody_cents)}</span>,
    },
    {
      key: "created",
      header: "Criado em",
      sortKey: "created_at",
      width: "96px",
      nowrap: true,
      hideBelow: "md",
      cell: (w) => <span title={formatDateTime(w.created_at)}>{formatDate(w.created_at)}</span>,
    },
  ];
}
