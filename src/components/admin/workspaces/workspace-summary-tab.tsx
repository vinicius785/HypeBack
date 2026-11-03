import type { ReactNode } from "react";

import {
  AdminEntityCell,
  AdminFigureCard,
  AdminKeyValueList,
  AdminLink,
  AdminSection,
  type AdminKeyValueItem,
} from "@/components/admin/platform";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import type { AdminFigure, AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import type { WorkspaceTabId } from "./workspace-constants";
import { addressLines, formatCnpj } from "./workspace-format";

import "@/styles/admin-workspaces.css";

/**
 * O resumo do detalhe traz o dinheiro como centavos soltos (`money`), sem `kind` nem definição. O tipo e o
 * texto de cada número vêm do contrato (`AdminFinancialFigures`), com o mesmo significado da aba Financeiro.
 */
export function workspaceMoneyFigures(money: AdminWorkspaceDetail["money"]): Record<"funded" | "custody" | "committed", AdminFigure> {
  return {
    funded: {
      value: money.funded_cents,
      unit: "brl_cents",
      kind: "realized",
      definition: "Soma das cobranças PIX pagas deste workspace, todo o histórico. É aporte confirmado, não faturamento da plataforma.",
    },
    custody: {
      value: money.custody_cents,
      unit: "brl_cents",
      kind: "stock",
      definition: "Saldo em custódia agora. O valor comprometido é parte dele e NÃO se soma a ele.",
    },
    committed: {
      value: money.committed_cents,
      unit: "brl_cents",
      kind: "committed",
      definition: "Parte da custódia travada em reservas de criadores, agora. É compromisso, ainda não é pagamento.",
    },
  };
}

function Count({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="adm-workspaces-count">
      <dt>{label}</dt>
      <dd>
        {formatInt(value)}
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  );
}

/** Texto de várias linhas (o endereço) numa célula do `AdminKeyValueList`; sem linhas, quem chama passa `null` para sair "—". */
function Lines({ lines }: { lines: readonly string[] }): ReactNode {
  return (
    <span className="adm-workspaces-lines">
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </span>
  );
}

interface WorkspaceSummaryTabProps {
  workspace: AdminWorkspaceDetail;
  /** Abre outra aba (o aviso de "sem responsável" leva a Usuários). */
  onOpenTab: (tab: WorkspaceTabId) => void;
}

/**
 * Aba "Resumo": números, dados cadastrais e o que o cabeçalho não diz. O cabeçalho já mostra o estado, o nome do
 * primeiro responsável, "cliente desde" e a última atividade, então aqui não se repetem estado, criado em nem
 * última atividade. "Responsáveis" fica: o cabeçalho só tem o nome do primeiro (o e-mail e os demais proprietários
 * só aparecem aqui) e, sem proprietário, é onde está o aviso com o atalho. "Ciclo de vida" só quando há o que contar
 * (motivo, quem e desde quando). Usa o que o detalhe já carregou.
 */
export function WorkspaceSummaryTab({ workspace, onOpenTab }: WorkspaceSummaryTabProps) {
  const { counts, lifecycle, owners } = workspace;
  const money = workspaceMoneyFigures(workspace.money);

  const address = addressLines(workspace.address);
  const registration: AdminKeyValueItem[] = [
    { label: "Nome", value: workspace.name },
    { label: "Razão social", value: workspace.legal_name },
    { label: "CNPJ", value: workspace.tax_id ? formatCnpj(workspace.tax_id) : null },
    { label: "Descrição", value: workspace.description ? <span className="adm-workspaces-text">{workspace.description}</span> : null },
    { label: "Endereço", value: address.length > 0 ? <Lines lines={address} /> : null },
    { label: "Nicho", value: workspace.niche?.name },
    { label: "Identificador público", value: <code className="adm-workspaces-code">{workspace.id}</code> },
  ];

  const hasLifecycleStory = !!(lifecycle.status_changed_at || lifecycle.status_reason || lifecycle.status_changed_by);
  const lifecycleRows: AdminKeyValueItem[] = [
    { label: "Neste estado desde", value: lifecycle.status_changed_at ? formatDateTime(lifecycle.status_changed_at) : null },
    { label: "Motivo", value: lifecycle.status_reason ? <span className="adm-workspaces-text">{lifecycle.status_reason}</span> : null },
    {
      label: "Por quem",
      value: lifecycle.status_changed_by ? (
        <AdminLink textLink to={{ to: "/admin/users/$userId", params: { userId: lifecycle.status_changed_by.user_id } }}>
          {lifecycle.status_changed_by.name}
        </AdminLink>
      ) : null,
    },
  ];

  const sessionRows: AdminKeyValueItem[] = [
    {
      label: "Última sessão (aprox.)",
      value: workspace.last_session_at ? (
        <span title={formatDateTime(workspace.last_session_at)}>{formatRelativeTime(workspace.last_session_at)}</span>
      ) : null,
      definition: "Aproximação: maior last_used_at das sessões dos membros (±5 min). Some quando a pessoa sai.",
    },
  ];

  const noOwner = owners.length === 0;

  return (
    <>
      <AdminSection title="Números">
        <div className="adm-workspaces-money">
          <AdminFigureCard variant="plain" showKind={false} label="Aportes recebidos" figure={money.funded} hint="todo o histórico" />
          <AdminFigureCard variant="plain" showKind={false} label="Em custódia" figure={money.custody} />
          <AdminFigureCard variant="plain" showKind={false} label="Comprometido" figure={money.committed} />
        </div>
        <dl className="adm-workspaces-counts">
          <Count label="Membros" value={counts.members} />
          <Count label="Campanhas" value={counts.campaigns} />
          <Count label="Campanhas publicadas" value={counts.published_campaigns} />
          <Count label="Criadores" value={counts.creators} />
        </dl>
        <div className="adm-workspaces-rows">
          <AdminKeyValueList items={sessionRows} columns={2} />
        </div>
      </AdminSection>

      <div className="adm-workspaces-columns">
        <AdminSection title="Dados cadastrais">
          <AdminKeyValueList items={registration} />
        </AdminSection>

        <div className="adm-workspaces-stack">
          {hasLifecycleStory ? (
            <AdminSection title="Ciclo de vida">
              <AdminKeyValueList items={lifecycleRows} />
            </AdminSection>
          ) : null}

          <AdminSection title="Responsáveis">
            {noOwner ? (
              <div className="adm-workspaces-warning" role="status">
                <b>Sem responsável</b>
                <p>
                  Este workspace não tem nenhum proprietário: é uma inconsistência a investigar. Dá para definir um proprietário na
                  aba Usuários.
                </p>
                {workspace.can.update ? (
                  <button type="button" className="adm-textbtn" onClick={() => onOpenTab("usuarios")}>
                    Ir para Usuários
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="adm-workspaces-owners">
                {owners.map((owner) => (
                  <li key={owner.user_id}>
                    <AdminEntityCell name={owner.name} subtitle={owner.email} size={36} />
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>
        </div>
      </div>
    </>
  );
}
