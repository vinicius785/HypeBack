import { useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import {
  useCreateInfluencerList,
  useDeleteInfluencerList,
  useDuplicateInfluencerList,
  useUpdateInfluencerList,
} from "@/hooks/use-creators-catalog";
import { useInfluencerLists } from "@/hooks/use-influencer-lists";
import { getInfluencerList, type InfluencerList } from "@/shared/services/influencer-lists";
import "@/styles/creator-lists.css";

import { ListCard, ListCardSkeleton } from "./list-card";
import { ListDeleteModal, ListFormModal } from "./list-dialogs";
import { ListDetailModal } from "./list-detail-modal";

/** Aba "Minhas listas" do catálogo de criadores. */
export function ListsTab() {
  const { data: lists = [], isLoading, isError, refetch } = useInfluencerLists();
  const canWrite = !!useWorkspacePermissions().catalog_write;
  const createMutation = useCreateInfluencerList();
  const updateMutation = useUpdateInfluencerList();
  const deleteMutation = useDeleteInfluencerList();
  const duplicateMutation = useDuplicateInfluencerList();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Sempre a versão atual da lista (a edição e as contagens chegam pela invalidação do cache).
  const byId = (id: string | null): InfluencerList | undefined => (id ? lists.find((l) => l.id === id) : undefined);
  const editing = byId(editingId);
  const deleting = byId(deletingId);
  const viewing = byId(viewingId);

  async function duplicate(list: InfluencerList) {
    setDuplicatingId(list.id);
    try {
      const detail = await getInfluencerList(list.id);
      const ids = detail.influencers.map((m) => m.id);
      await duplicateMutation.mutateAsync({ name: list.name, description: list.description, userIds: ids });
      if ((detail.influencers_total ?? ids.length) > ids.length) {
        toast.warning("A cópia levou os primeiros criadores; a lista original tem mais do que o limite de uma cópia.");
      }
    } catch {
      toast.error("Erro ao duplicar lista");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <>
      <div id="crres" className="fade lsm">
        {isLoading ? (
          <div className="lst-grid" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListCardSkeleton key={i} k={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="lst-empty big" role="alert">
            <span>
              <I n="alert" />
            </span>
            <b>Não foi possível carregar suas listas</b>
            <small>Confira a conexão e tente de novo.</small>
            <button type="button" className="btn out" onClick={() => refetch()}>
              Tentar de novo
            </button>
          </div>
        ) : lists.length === 0 ? (
          <div className="lst-empty big">
            <span>
              <I n="list" />
            </span>
            <b>Você ainda não tem listas</b>
            <small>Organize criadores por tema, nicho ou campanha e acompanhe o alcance de cada grupo.</small>
            {canWrite && (
              <button type="button" className="btn" onClick={() => setCreating(true)}>
                <I n="plus" cls="sm" />
                Criar primeira lista
              </button>
            )}
          </div>
        ) : (
          <div className="lst-grid">
            {lists.map((list, k) => (
              <ListCard
                key={list.id}
                list={list}
                k={k}
                canWrite={canWrite}
                duplicating={duplicatingId === list.id}
                onOpen={() => setViewingId(list.id)}
                onEdit={() => setEditingId(list.id)}
                onDuplicate={() => duplicate(list)}
                onDelete={() => setDeletingId(list.id)}
              />
            ))}
            {canWrite && (
              <button type="button" className="lst-card new" style={{ "--k": Math.min(lists.length, 14) } as CSSProperties} onClick={() => setCreating(true)}>
                <span>
                  <I n="plus" />
                </span>
                <b>Nova lista</b>
                <small>Organize criadores por tema, nicho ou campanha</small>
              </button>
            )}
          </div>
        )}
      </div>

      {creating && (
        <ListFormModal
          mode="create"
          saving={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await createMutation.mutateAsync({ name: v.name, description: v.description || undefined });
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <ListFormModal
          mode="edit"
          initial={editing}
          saving={updateMutation.isPending}
          onClose={() => setEditingId(null)}
          onSubmit={async (v) => {
            await updateMutation.mutateAsync({ listId: editing.id, name: v.name, description: v.description });
            setEditingId(null);
          }}
        />
      )}

      {deleting && (
        <ListDeleteModal
          name={deleting.name}
          count={deleting.influencer_count}
          deleting={deleteMutation.isPending}
          onClose={() => setDeletingId(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleting.id);
            setDeletingId(null);
            if (viewingId === deleting.id) setViewingId(null);
          }}
        />
      )}

      {viewing && <ListDetailModal list={viewing} canWrite={canWrite} onClose={() => setViewingId(null)} onEdit={() => setEditingId(viewing.id)} />}
    </>
  );
}
