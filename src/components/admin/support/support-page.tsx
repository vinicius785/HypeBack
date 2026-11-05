import { useState } from "react";

import {
  AdminBadge,
  AdminEntityCell,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminSection,
  AdminTable,
  AdminTabs,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";
import { supportCounts, useAdminSupportTickets, type SupportListParams } from "@/hooks/admin/use-admin-support";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_SOURCES,
  SUPPORT_SOURCE_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportPriority,
  type SupportSource,
  type SupportStatusFilter,
  type SupportTicket,
} from "@/shared/services/admin-support";

import { PRIORITY_TONE, SOURCE_TONE, STATUS_TONE, fmtDateTime, ticketNumber, timeAgo } from "./support-format";
import { SupportTicketDrawer } from "./support-ticket-drawer";

import "@/styles/admin-support.css";

const PER_PAGE = 20;
type Tab = "active" | "resolved_all";
type Assigned = "all" | "me" | "none";

/**
 * Suporte: central dos pedidos de ajuda que chegam da plataforma, do app do criador e do site. A equipe lê; quem tem
 * `support.manage` (administrador e suporte) responde, muda status, prioridade e responsável. Dados:
 * `GET /admin/support/tickets` (contagens em `meta.counts`); detalhe e ações no painel lateral.
 */
export function AdminSupportPage() {
  const capabilities = useAdminCapabilities();
  const canManage = capabilities.can("support.manage");
  const [tab, setTab] = useState<Tab>("active");
  const [source, setSource] = useState<SupportSource | "all">("all");
  const [priority, setPriority] = useState<SupportPriority | "all">("all");
  const [assigned, setAssigned] = useState<Assigned>("all");
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = text.trim().length >= 2 ? text.trim() : undefined;
  const params: SupportListParams = {
    status: tab as SupportStatusFilter,
    source: source === "all" ? undefined : source,
    priority: priority === "all" ? undefined : priority,
    assigned: assigned === "all" ? undefined : assigned,
    q,
    page,
    per_page: PER_PAGE,
  };
  const list = useAdminSupportTickets(params);
  const counts = supportCounts(list.data?.meta);
  const activeCount = counts ? counts.by_status.open + counts.by_status.in_progress + counts.by_status.waiting : null;
  const resolvedCount = counts ? counts.by_status.resolved + counts.by_status.closed : null;
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const columns: AdminTableColumn<SupportTicket>[] = [
    {
      key: "subject",
      header: "Pedido",
      width: "minmax(0, 2fr)",
      primary: true,
      cell: (t) => (
        <button type="button" className="adm-sup-subj" onClick={() => setOpenId(t.id)}>
          <span className="adm-sup-n">{ticketNumber(t.number)}</span>
          <b>{t.subject}</b>
          <small>{t.preview}</small>
        </button>
      ),
    },
    {
      key: "requester",
      header: "Solicitante",
      width: "minmax(0, 1.2fr)",
      cell: (t) => <AdminEntityCell name={t.requester.name} subtitle={t.workspace?.name ?? t.requester.email ?? undefined} size={32} />,
    },
    { key: "source", header: "Origem", width: "110px", cell: (t) => <AdminBadge tone={SOURCE_TONE[t.source]}>{SUPPORT_SOURCE_LABEL[t.source]}</AdminBadge> },
    { key: "priority", header: "Prioridade", width: "100px", cell: (t) => <AdminBadge tone={PRIORITY_TONE[t.priority]}>{SUPPORT_PRIORITY_LABEL[t.priority]}</AdminBadge> },
    { key: "status", header: "Status", width: "150px", cell: (t) => <AdminBadge tone={STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</AdminBadge> },
    {
      key: "assignee",
      header: "Responsável",
      width: "130px",
      cell: (t) => (t.assignee ? <span className="adm-sup-as">{t.assignee.name}</span> : <span className="adm-sup-none">Sem responsável</span>),
    },
    {
      key: "updated",
      header: "Atualizado",
      width: "110px",
      cell: (t) => <span title={fmtDateTime(t.last_message_at)}>{timeAgo(t.last_message_at)}</span>,
    },
  ];

  const meta = list.data?.meta;
  const filtered = source !== "all" || priority !== "all" || assigned !== "all" || !!q;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Suporte"
        subtitle="Pedidos de ajuda da plataforma, do app e do site em um só lugar."
        actions={<AdminRefreshButton onClick={() => void list.refetch()} loading={list.isFetching} />}
      />

      <AdminSection>
        <div className="adm-sup-bar">
          <AdminTabs
            ariaLabel="Situação dos pedidos"
            idPrefix="adm-sup"
            value={tab}
            onChange={reset(setTab)}
            tabs={[
              { id: "active", label: "Ativos", count: activeCount },
              { id: "resolved_all", label: "Resolvidos", count: resolvedCount },
            ]}
          />
          <AdminSearchInput value={text} onSearch={reset(setText)} placeholder="Buscar assunto, nome, e-mail ou nº" label="Buscar pedidos de suporte" />
        </div>

        <div className="adm-sup-filters" role="group" aria-label="Filtros">
          <label>
            <span>Origem</span>
            <select value={source} onChange={(e) => reset(setSource)(e.target.value as SupportSource | "all")}>
              <option value="all">Todas{counts && tab === "active" ? ` (${Object.values(counts.by_source).reduce((a, b) => a + b, 0)})` : ""}</option>
              {SUPPORT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SUPPORT_SOURCE_LABEL[s]}
                  {counts && tab === "active" ? ` (${counts.by_source[s]})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Prioridade</span>
            <select value={priority} onChange={(e) => reset(setPriority)(e.target.value as SupportPriority | "all")}>
              <option value="all">Todas</option>
              {[...SUPPORT_PRIORITIES].reverse().map((p) => (
                <option key={p} value={p}>
                  {SUPPORT_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Responsável</span>
            <select value={assigned} onChange={(e) => reset(setAssigned)(e.target.value as Assigned)}>
              <option value="all">Todos</option>
              <option value="me">Atribuídos a mim{counts ? ` (${counts.mine})` : ""}</option>
              <option value="none">Sem responsável{counts ? ` (${counts.unassigned})` : ""}</option>
            </select>
          </label>
        </div>

        <AdminTable
          caption="Pedidos de suporte"
          columns={columns}
          rows={list.data?.data}
          rowKey={(t) => t.id}
          loading={list.isLoading}
          refreshing={list.isFetching && !list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          empty={
            filtered
              ? { title: "Nenhum pedido encontrado", description: "Nada combina com a busca e os filtros." }
              : tab === "active"
                ? { title: "Nenhum pedido em aberto", description: "Quando alguém pedir ajuda pela plataforma, pelo app ou pelo site, o pedido aparece aqui." }
                : { title: "Nenhum pedido resolvido ainda", description: "Os pedidos resolvidos e fechados ficam neste histórico." }
          }
          rowActions={(t) => (
            <button type="button" className="btn out adm-btn-sm" onClick={() => setOpenId(t.id)}>
              Abrir
            </button>
          )}
          rowActionsLabel="Abrir pedido"
          footer={meta ? <AdminPager page={meta.page} perPage={meta.per_page} total={meta.total} onPageChange={setPage} disabled={list.isFetching} /> : undefined}
        />
      </AdminSection>

      <SupportTicketDrawer ticketId={openId} canManage={canManage} onClose={() => setOpenId(null)} />
    </AdminPage>
  );
}
