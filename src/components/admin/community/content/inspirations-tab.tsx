import { useState } from "react";

import {
  AdminActionMenu,
  AdminConfirmDialog,
  AdminSection,
  AdminTable,
  adminErrorMessage,
  adminToast,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useCommunityInspirations, useInspirationMutations } from "@/hooks/admin/use-admin-community-content";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityInspiration } from "@/shared/community-content.types";

import { InspirationDialog } from "./inspiration-dialog";

import "@/styles/admin-community.css";

function media(url: string | null): string | undefined {
  return url ? (url.startsWith("/") ? getUploadUrl(url) : url) : undefined;
}

/** Aba Inspirações: fotos e reels verticais da aba Conteúdos do app. */
export function CommunityInspirations() {
  const query = useCommunityInspirations();
  const { remove } = useInspirationMutations();
  const [editing, setEditing] = useState<CommunityInspiration | "new" | null>(null);
  const [deleting, setDeleting] = useState<CommunityInspiration | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const columns: AdminTableColumn<CommunityInspiration>[] = [
    {
      key: "title",
      header: "Inspiração",
      width: "minmax(220px, 2.4fr)",
      primary: true,
      cell: (item) => (
        <span className="adm-content-cell">
          <span className="adm-content-thumb" data-ratio="tall" aria-hidden="true">
            {media(item.image_url) ? <img src={media(item.image_url)} alt="" /> : null}
          </span>
          <span>
            <b>{item.title}</b>
            <small>{item.video_url ? "Reel com vídeo" : "Só foto"}</small>
          </span>
        </span>
      ),
    },
    { key: "author", header: "Autor", width: "minmax(120px, 1fr)", hideBelow: "sm", cell: (item) => (item.author_id !== null && item.author_id !== undefined && item.author_id !== "" ? `Usuário ${item.author_id}` : "—") },
    { key: "source", header: "Marca", width: "minmax(120px, 1fr)", hideBelow: "md", cell: (item) => item.source || "—" },
  ];

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(undefined);
    try {
      await remove.mutateAsync(deleting.id);
      adminToast.success("Inspiração excluída.");
      setDeleting(null);
    } catch (failure) {
      setDeleteError(adminErrorMessage(failure, "Não foi possível excluir a inspiração."));
    }
  };

  return (
    <>
      <AdminSection
        title="Inspirações"
        description="Fotos e reels verticais (9:16) da aba Conteúdos do app."
        flush
        actions={
          <button type="button" className="btn adm-btn-sm" onClick={() => setEditing("new")}>
            Nova inspiração
          </button>
        }
      >
        <AdminTable
          caption="Inspirações"
          columns={columns}
          rows={query.data}
          rowKey={(item) => item.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
          empty={{ title: "Nenhuma inspiração cadastrada", description: "O app esconde a fileira de inspirações até haver conteúdo. Use “Nova inspiração” para começar." }}
          rowActions={(item) => (
            <AdminActionMenu
              iconOnly
              variant="ghost"
              ariaLabel={`Ações de “${item.title}”`}
              items={[
                { id: "edit", label: "Editar", onSelect: () => setEditing(item) },
                { id: "delete", label: "Excluir", tone: "danger", onSelect: () => (setDeleteError(undefined), setDeleting(item)) },
              ]}
            />
          )}
        />
      </AdminSection>

      {editing ? <InspirationDialog inspiration={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}

      <AdminConfirmDialog
        open={deleting !== null}
        tone="danger"
        eyebrow={deleting ? `Inspiração · ${deleting.title}` : undefined}
        title="Excluir esta inspiração?"
        description="Ela some do app. Não dá para desfazer."
        reason={false}
        cancelLabel="Voltar"
        confirmLabel="Excluir inspiração"
        pending={remove.isPending}
        pendingLabel="Excluindo…"
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
