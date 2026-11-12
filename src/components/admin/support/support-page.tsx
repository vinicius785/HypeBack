import { useEffect, useState } from "react";

import {
  AdminBadge,
  AdminEntityCell,
  AdminFilterBar,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminSection,
  AdminTable,
  inIsland,
  type AdminFilterDef,
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
export type SupportView = "active" | "resolved_all";
type Assigned = "all" | "me" | "none";

/**
 * Fila do Suporte (dentro do Atendimento): pedidos de ajuda que chegam da plataforma, do app do criador e do site. A
 * equipe lê; quem tem `support.manage` (administrador e suporte) responde, muda status, prioridade e responsável.
 * `view` diz se a fila é a dos ativos ou a dos resolvidos (a ilha do Atendimento escolhe). Dados:
 * `GET /admin/support/tickets` (contagens em `meta.counts`); detalhe e ações no painel lateral.
 */
export function SupportQueue({ view, tools }: { view: SupportView; tools?: HTMLElement | null }) {
  const capabilities = useAdminCapabilities();
  const canManage = capabilities.can("support.manage");
  const tab = view;
  const [source, setSource] = useState<SupportSource | "all">("all");
  const [priority, setPriority] = useState<SupportPriority | "all">("all");
  const [assigned, setAssigned] = useState<Assigned>("all");
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  // Trocar de fila volta à primeira página.
  useEffect(() => setPage(1), [view]);

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

  const sourceTotal = counts && tab === "active" ? Object.values(counts.by_source).reduce((x, y) => x + y, 0) : null;
  const filters: AdminFilterDef[] = [
    {
      kind: "select",
      key: "source",
      label: "Origem",
      options: [
        { value: "all", label: `Todas${sourceTotal !== null ? ` (${sourceTotal})` : ""}` },
        ...SUPPORT_SOURCES.map((s) => ({ value: s, label: `${SUPPORT_SOURCE_LABEL[s]}${counts && tab === "active" ? ` (${counts.by_source[s]})` : ""}` })),
      ],
      defaultValue: "all",
    },
    {
      kind: "select",
      key: "priority",
      label: "Prioridade",
      options: [{ value: "all", label: "Todas" }, ...[...SUPPORT_PRIORITIES].reverse().map((p) => ({ value: p, label: SUPPORT_PRIORITY_LABEL[p] }))],
      defaultValue: "all",
    },
    {
      kind: "select",
      key: "assigned",
      label: "Responsável",
      options: [
        { value: "all", label: "Todos" },
        { value: "me", label: `Atribuídos a mim${counts ? ` (${counts.mine})` : ""}` },
        { value: "none", label: `Sem responsável${counts ? ` (${counts.unassigned})` : ""}` },
      ],
      defaultValue: "all",
    },
  ];

  return (
    <>
      {inIsland(tools, (
      <AdminFilterBar
        search={<AdminSearchInput value={text} onSearch={reset(setText)} placeholder="Buscar assunto, nome, e-mail ou nº" label="Buscar pedidos de suporte" />}
        searchLabel="Buscar pedidos de suporte"
        filters={filters}
        values={{ source, priority, assigned }}
        onChange={(patch) => {
          if (patch.source !== undefined) setSource(patch.source as SupportSource | "all");
          if (patch.priority !== undefined) setPriority(patch.priority as SupportPriority | "all");
          if (patch.assigned !== undefined) setAssigned(patch.assigned as Assigned);
          setPage(1);
        }}
        onClear={() => {
          setSource("all");
          setPriority("all");
          setAssigned("all");
          setPage(1);
        }}
        compact
        trailing={<AdminRefreshButton iconOnly onClick={() => void list.refetch()} loading={list.isFetching} />}
      />
      ))}

      <AdminSection flush>
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
    </>
  );
}
