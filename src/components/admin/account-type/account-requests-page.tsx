import { useEffect, useState } from "react";

import {
  AdminBadge,
  AdminConfirmDialog,
  AdminDrawer,
  AdminEntityCell,
  AdminKeyValueList,
  AdminLink,
  AdminFilterBar,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminSection,
  AdminTable,
  adminToast,
  inIsland,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";
import {
  useAdminAccountTypeRequest,
  useAdminAccountTypeRequests,
  useAdminDecideAccountTypeRequest,
  type AccountRequestFilter,
} from "@/hooks/admin/use-admin-account-type-requests";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { ACCOUNT_TYPE_LABEL, type AccountTypeRequest } from "@/shared/services/account-type-requests";

import { workspaceDetailLink } from "../users/admin-users-links";
import { STATUS_TONE, fmtDate, fmtDateTime, statusLabel, transitionLabel } from "./account-request-format";

import "@/styles/admin-account-requests.css";

const PER_PAGE = 20;

type Decision = { request: AccountTypeRequest; kind: "approve" | "reject" };

/**
 * Fila das Solicitações de troca do tipo de conta (marca/agência), dentro do Atendimento. A equipe lê; só o administrador
 * da plataforma aprova ou rejeita (a API confere o papel em cada decisão). Aprovar muda o tipo e avisa o time; rejeitar
 * exige o motivo, mantém o tipo e avisa o time com o motivo. `view` diz se é a fila dos pendentes ou o histórico.
 * Dados: `GET /admin/workspace-account-type-requests`; decisão: `POST .../:id/approve|reject`.
 */
export function AccountRequestsQueue({ view, tools }: { view: AccountRequestFilter; tools?: HTMLElement | null }) {
  const capabilities = useAdminCapabilities();
  const tab = view;
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Trocar de fila volta à primeira página.
  useEffect(() => setPage(1), [view]);
  const [decision, setDecision] = useState<Decision | null>(null);

  const q = text.trim().length >= 2 ? text.trim() : undefined;
  const list = useAdminAccountTypeRequests({ status: tab, q, page, per_page: PER_PAGE });
  const canDecide = capabilities.isAdmin;

  const columns: AdminTableColumn<AccountTypeRequest>[] = [
    {
      key: "workspace",
      header: "Workspace e responsável",
      width: "minmax(0, 1.5fr)",
      primary: true,
      cell: (r) => (
        <div className="adm-ar-ws">
          <AdminLink to={workspaceDetailLink(r.workspace.id)}>
            <AdminEntityCell name={r.workspace.name} photo={r.workspace.photo} subtitle={`Por ${r.requested_by.name ?? "—"}${r.requested_by.email ? ` · ${r.requested_by.email}` : ""}`} size={36} />
          </AdminLink>
        </div>
      ),
    },
    {
      key: "change",
      header: "Pedido",
      width: "140px",
      cell: (r) => (
        <div className="adm-ar-who">
          <b className="adm-ar-change">{transitionLabel(r)}</b>
          <small title={fmtDateTime(r.requested_at)}>{fmtDate(r.requested_at)}</small>
        </div>
      ),
    },
    { key: "why", header: "Justificativa", width: "minmax(0, 2fr)", cell: (r) => <span className="adm-ar-why">{r.justification}</span> },
    { key: "status", header: "Status", width: "100px", cell: (r) => <AdminBadge tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</AdminBadge> },
    {
      key: "actions",
      header: "",
      headerLabel: "Ações",
      mobileLabel: "",
      width: canDecide ? "212px" : "96px",
      cell: (r) => (
        <div className="adm-ar-act">
          <button type="button" className="btn out adm-btn-sm" onClick={() => setDetailId(r.id)}>
            Detalhes
          </button>
          {canDecide && r.status === "pending" && (
            <>
              <button type="button" className="btn out adm-btn-sm" onClick={() => setDecision({ request: r, kind: "reject" })}>
                Rejeitar
              </button>
              <button type="button" className="btn adm-btn-sm" onClick={() => setDecision({ request: r, kind: "approve" })}>
                Aprovar
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const meta = list.data?.meta;

  return (
    <>
      {inIsland(tools, (
      <AdminFilterBar
        search={
          <AdminSearchInput
            value={text}
            onSearch={(v) => {
              setText(v);
              setPage(1);
            }}
            placeholder="Buscar workspace ou responsável"
            label="Buscar solicitações"
          />
        }
        searchLabel="Buscar solicitações"
        compact
        trailing={<AdminRefreshButton iconOnly onClick={() => void list.refetch()} loading={list.isFetching} />}
      />
      ))}

      <AdminSection flush>
        <AdminTable
          caption="Solicitações de tipo de conta"
          columns={columns}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          refreshing={list.isFetching && !list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          empty={
            q
              ? { title: "Nenhuma solicitação encontrada", description: "Nada combina com a busca." }
              : tab === "pending"
                ? { title: "Nenhuma solicitação pendente", description: "Quando um workspace pedir a troca do tipo de conta, o pedido aparece aqui." }
                : { title: "Nenhuma decisão registrada ainda", description: "As solicitações aprovadas e rejeitadas ficam neste histórico." }
          }
          footer={meta ? <AdminPager page={meta.page} perPage={meta.per_page} total={meta.total} onPageChange={setPage} disabled={list.isFetching} /> : undefined}
        />
      </AdminSection>

      <RequestDetail
        requestId={detailId}
        canDecide={canDecide}
        onClose={() => setDetailId(null)}
        onDecide={(request, kind) => {
          setDetailId(null);
          setDecision({ request, kind });
        }}
      />
      {decision && <DecisionDialog decision={decision} onClose={() => setDecision(null)} />}
    </>
  );
}

function RequestDetail({
  requestId,
  canDecide,
  onClose,
  onDecide,
}: {
  requestId: string | null;
  canDecide: boolean;
  onClose: () => void;
  onDecide: (request: AccountTypeRequest, kind: "approve" | "reject") => void;
}) {
  const query = useAdminAccountTypeRequest(requestId);
  const r = query.data?.request;
  const history = query.data?.history ?? [];
  return (
    <AdminDrawer
      open={!!requestId}
      onClose={onClose}
      title={r ? `Solicitação de ${r.workspace.name}` : "Solicitação"}
      description={r ? transitionLabel(r) : undefined}
      size="md"
      footer={
        r && r.status === "pending" && canDecide ? (
          <>
            <button type="button" className="btn out" onClick={() => onDecide(r, "reject")}>
              Rejeitar
            </button>
            <button type="button" className="btn" onClick={() => onDecide(r, "approve")}>
              Aprovar
            </button>
          </>
        ) : (
          <button type="button" className="btn out" onClick={onClose}>
            Fechar
          </button>
        )
      }
    >
      {query.isLoading ? (
        <p className="adm-muted">Carregando…</p>
      ) : query.isError || !r ? (
        <p role="alert">{describeAdminError(query.error)}</p>
      ) : (
        <div className="adm-ar-detail">
          <AdminKeyValueList
            items={[
              { label: "Workspace", value: <AdminLink to={workspaceDetailLink(r.workspace.id)} textLink>{r.workspace.name}</AdminLink> },
              { label: "Responsável", value: r.requested_by.name, hint: r.requested_by.email },
              { label: "Mudança", value: transitionLabel(r) },
              { label: "Status", value: <AdminBadge tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</AdminBadge> },
              { label: "Solicitada em", value: fmtDateTime(r.requested_at) },
              ...(r.decided_at
                ? [
                    { label: r.status === "approved" ? "Aprovada por" : "Rejeitada por", value: r.decided_by?.name ?? "—", hint: fmtDateTime(r.decided_at) },
                    ...(r.decision_reason ? [{ label: r.status === "approved" ? "Observação" : "Motivo", value: r.decision_reason }] : []),
                  ]
                : []),
            ]}
          />
          <section>
            <h4>Justificativa</h4>
            <p className="adm-ar-full">{r.justification}</p>
          </section>
          {history.length > 0 && (
            <section>
              <h4>Outras solicitações deste workspace</h4>
              <ul className="adm-ar-hist">
                {history.map((h) => (
                  <li key={h.id}>
                    <span>{transitionLabel(h)}</span>
                    <AdminBadge tone={STATUS_TONE[h.status]}>{statusLabel(h.status)}</AdminBadge>
                    <small>{fmtDateTime(h.decided_at ?? h.requested_at)}</small>
                    {h.decision_reason && <em>{h.decision_reason}</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AdminDrawer>
  );
}

function DecisionDialog({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  const { request: r, kind } = decision;
  const mutation = useAdminDecideAccountTypeRequest(r.id);
  const approving = kind === "approve";
  const [error, setError] = useState<string | null>(null);

  return (
    <AdminConfirmDialog
      open
      tone={approving ? "neutral" : "danger"}
      eyebrow={`${r.workspace.name} · ${transitionLabel(r)}`}
      title={approving ? "Aprovar a troca do tipo de conta?" : "Rejeitar a solicitação?"}
      description={r.justification}
      consequences={
        approving
          ? [
              `O workspace passa a ser uma conta de ${ACCOUNT_TYPE_LABEL[r.requested_type]}.`,
              "Campanhas, contratos, saldo e permissões não são alterados.",
              "Quem aprovou e quando ficam registrados, e o time do workspace é avisado.",
            ]
          : [
              "O tipo de conta continua o mesmo.",
              "O time do workspace é avisado e recebe o motivo que você escrever.",
              "A decisão fica registrada no histórico.",
            ]
      }
      confirmLabel={approving ? "Aprovar solicitação" : "Rejeitar solicitação"}
      pending={mutation.isPending}
      pendingLabel={approving ? "Aprovando…" : "Rejeitando…"}
      error={error}
      reason={approving ? false : { label: "Motivo da rejeição (o time do workspace vê este texto)", placeholder: "Explique por que não foi aprovada" }}
      onClose={onClose}
      onConfirm={({ reason }) => {
        setError(null);
        mutation.mutate(
          { decision: kind, reason: reason || undefined },
          {
            onSuccess: () => {
              adminToast.success(approving ? "Solicitação aprovada. O tipo de conta foi alterado." : "Solicitação rejeitada. O time foi avisado.");
              onClose();
            },
            onError: (e) => setError(describeAdminError(e)),
          },
        );
      }}
    />
  );
}
