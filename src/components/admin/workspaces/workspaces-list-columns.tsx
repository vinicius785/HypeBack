import { AdminBadge, AdminEntityCell, AdminStatusBadge, type AdminTableColumn } from "@/components/admin/platform";
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
    // O texto é visível (não só dica): é uma inconsistência a investigar e quem lê a lista precisa ver isso.
    return (
      <div className="adm-workspaces-noowner">
        <AdminBadge tone="warn" size="sm">
          Sem responsável
        </AdminBadge>
        <small>Nenhum proprietário: inconsistência a investigar</small>
      </div>
    );
  }
  const others = count - 1;
  return (
    <AdminEntityCell
      name={owner.name}
      subtitle={owner.email}
      size={28}
      badge={
        others > 0 ? (
          <AdminBadge tone="outline" size="sm" title={`${count} proprietários`}>
            +{others}
            <span className="adm-sr">{others === 1 ? " proprietário a mais" : " proprietários a mais"}</span>
          </AdminBadge>
        ) : undefined
      }
    />
  );
}

/**
 * A atividade REAL derivada (não é o status do ciclo de vida): texto cinza, "há 2 dias" ou "Sem atividade". O selo
 * de estado da linha é o único "Ativo/Suspenso…"; aqui não se repete a palavra com outro sentido. Para leitor de tela
 * o texto vem completo ("Teve atividade nos últimos 30 dias. Última atividade: há 2 dias").
 */
export function WorkspaceActivityLine({ activity }: { activity: AdminWorkspaceActivity }) {
  const last = activity.last_activity_at;
  const description = workspaceActivityDescription(activity.state, activity.window_days);
  if (!last || activity.state === "never") {
    return (
      <span className="adm-workspaces-activity" data-state={activity.state}>
        Sem atividade
      </span>
    );
  }
  return (
    <span className="adm-workspaces-activity" data-state={activity.state} title={`Última atividade em ${formatDateTime(last)}`}>
      <span className="adm-sr">{description}. Última atividade: </span>
      {formatRelativeTime(last)}
    </span>
  );
}

const SORT_NOTE = "Ordenar por esta coluna ordena pela atividade mais recente.";

/**
 * Colunas da lista de Workspaces: seis (Workspace, Responsável, Status, Campanhas, Aportes, Criado em). Membros,
 * Criadores e Em custódia ficam no detalhe (Resumo). `hideBelow` tira Campanhas e Criado em quando a tabela
 * estreita; no celular a linha vira bloco com todos os dados e o seletor "Ordenar por" lista as colunas ordenáveis.
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
      key: "campaigns",
      header: "Campanhas",
      sortKey: "campaigns",
      width: "100px",
      align: "right",
      hideBelow: "md",
      definition: defined(definitionOf(definitions, "campaigns", "campaigns_count")),
      // "publicadas de" é visível (não só `title`): dica essencial, o primeiro número é só uma parte do segundo.
      cell: (w) => (
        <span className="adm-num">
          <b>{formatInt(w.published_campaigns_count)}</b>
          <span className="adm-muted"> de {formatInt(w.campaigns_count)}</span>
          <small className="adm-sub">{w.published_campaigns_count === 1 ? "publicada" : "publicadas"}</small>
        </span>
      ),
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
