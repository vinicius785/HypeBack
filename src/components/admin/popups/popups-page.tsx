import { useMemo, useState } from "react";

import {
  AdminActionMenu,
  AdminBadge,
  AdminConfirmDialog,
  AdminPage,
  AdminPageHeader,
  AdminTable,
  adminErrorMessage,
  adminToast,
  type AdminBadgeTone,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { usePopupMutations, usePopups } from "@/hooks/admin/use-admin-popups";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { clickRate, draftFromPopup, POPUP_FILTERS, POPUP_STATUS_LABEL, type PopupDraft } from "@/lib/admin/popup-form";
import { getUploadUrl } from "@/lib/utils/api";
import type { Popup, PopupStatus } from "@/shared/popups.types";

import { PopupDialog } from "./popup-dialog";
import { AdminPopupsIsland, type PopupIslandSegment } from "./popups-island";
import { PopupIcon } from "./popup-icon";

import "@/styles/admin-popups.css";

const STATUS_TONE: Record<PopupStatus, AdminBadgeTone> = { live: "ok", scheduled: "brand", expired: "muted" };

const EMPTY_BY_FILTER: Record<string, { title: string; description: string }> = {
  "": { title: "Nenhum pop-up ainda", description: "Use “Novo pop-up” para mostrar um aviso quando as pessoas abrirem o app." },
  live: { title: "Nenhum pop-up no ar", description: "Os que estão valendo agora aparecem aqui." },
  scheduled: { title: "Nenhum pop-up agendado", description: "Os que começam mais tarde aparecem aqui." },
  expired: { title: "Nenhum pop-up expirado", description: "Os que já passaram do prazo de 1 dia aparecem aqui." },
};

function Thumb({ popup }: { popup: Popup }) {
  const src = popup.image_url ? (popup.image_url.startsWith("/") ? getUploadUrl(popup.image_url) : popup.image_url) : undefined;
  return (
    <span className="adm-pop-thumb" data-theme={popup.theme} aria-hidden="true">
      {src ? <img src={src} alt="" /> : popup.icon ? <PopupIcon name={popup.icon} size={18} /> : null}
    </span>
  );
}

/**
 * Pop-ups (`/admin/popups`): o aviso que o app mostra quando a pessoa abre. Cada um vale 1 dia a partir do início e cada
 * pessoa vê no máximo 1 por dia (o de maior prioridade). A lista traz o estado e as métricas de cada pop-up.
 */
export function AdminPopupsPage() {
  const query = usePopups();
  const { remove } = usePopupMutations();
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<{ popup?: Popup; initial?: PopupDraft } | null>(null);
  const [deleting, setDeleting] = useState<Popup | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const all = useMemo(() => query.data ?? [], [query.data]);
  const rows = useMemo(() => all.filter((popup) => !filter || popup.status === filter), [all, filter]);
  const segments: readonly PopupIslandSegment[] = POPUP_FILTERS.map((item) => ({
    id: item.value,
    label: item.label,
    count: query.data ? all.filter((popup) => !item.value || popup.status === item.value).length : null,
    tone: item.value === "live" ? "ok" : undefined,
  }));

  const columns: AdminTableColumn<Popup>[] = [
    {
      key: "title",
      header: "Pop-up",
      width: "minmax(220px, 2.4fr)",
      primary: true,
      cell: (popup) => (
        <span className="adm-pop-cell">
          <Thumb popup={popup} />
          <span>
            <b>{popup.title}</b>
            <small>{popup.audience === "campaign" ? "Participantes de uma campanha" : "Todos"}</small>
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", width: "110px", cell: (popup) => <AdminBadge tone={STATUS_TONE[popup.status] ?? "muted"}>{POPUP_STATUS_LABEL[popup.status] ?? popup.status}</AdminBadge> },
    {
      key: "period",
      header: "Período",
      width: "minmax(170px, 1.4fr)",
      hideBelow: "md",
      cell: (popup) => (
        <span className="adm-pop-when">
          {formatDateTime(popup.starts_at)}
          <small>até {formatDateTime(popup.expires_at)}</small>
        </span>
      ),
    },
    { key: "views", header: "Vistos", width: "84px", align: "right", cell: (popup) => formatInt(popup.views) },
    {
      key: "clicks",
      header: "Cliques",
      width: "110px",
      align: "right",
      cell: (popup) => (
        <span className="adm-pop-when">
          {formatInt(popup.clicks)}
          <small>{clickRate(popup.views, popup.clicks)}</small>
        </span>
      ),
    },
    { key: "dismissals", header: "Fechados", width: "92px", align: "right", hideBelow: "sm", cell: (popup) => formatInt(popup.dismissals) },
  ];

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(undefined);
    try {
      await remove.mutateAsync(deleting.id);
      adminToast.success("Pop-up excluído.");
      setDeleting(null);
    } catch (failure) {
      setDeleteError(adminErrorMessage(failure, "Não foi possível excluir o pop-up."));
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pop-ups"
        subtitle="O aviso que o app mostra quando a pessoa abre. Cada pop-up vale 1 dia e cada pessoa vê no máximo 1 por dia."
        actions={
          <button type="button" className="btn" onClick={() => setForm({})}>
            <I n="plus" cls="sm" />
            Novo pop-up
          </button>
        }
      />

      <AdminPopupsIsland segments={segments} value={filter} onChange={setFilter} items={all} />

      <AdminTable
        caption="Pop-ups"
        columns={columns}
        rows={query.data ? rows : undefined}
        rowKey={(popup) => popup.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        empty={EMPTY_BY_FILTER[filter] ?? EMPTY_BY_FILTER[""]}
        rowActions={(popup) => (
          <AdminActionMenu
            iconOnly
            variant="ghost"
            ariaLabel={`Ações de “${popup.title}”`}
            items={[
              { id: "edit", label: "Editar", onSelect: () => setForm({ popup, initial: draftFromPopup(popup, { keepStart: true }) }) },
              { id: "duplicate", label: "Duplicar", onSelect: () => setForm({ initial: draftFromPopup(popup, { keepStart: false }) }) },
              { id: "delete", label: "Excluir", tone: "danger", onSelect: () => (setDeleteError(undefined), setDeleting(popup)) },
            ]}
          />
        )}
      />

      {form ? <PopupDialog popup={form.popup} initial={form.initial} onClose={() => setForm(null)} /> : null}

      <AdminConfirmDialog
        open={deleting !== null}
        tone="danger"
        eyebrow={deleting ? `Pop-up · ${deleting.title}` : undefined}
        title="Excluir este pop-up?"
        description="Ele some do app na hora. Não dá para desfazer."
        reason={false}
        cancelLabel="Voltar"
        confirmLabel="Excluir pop-up"
        pending={remove.isPending}
        pendingLabel="Excluindo…"
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </AdminPage>
  );
}
