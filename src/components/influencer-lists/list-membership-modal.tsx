import { useState } from "react";

import { I } from "@/components/prototype/ui";
import {
  useInfluencerLists,
  useInfluencerMembershipMap,
} from "@/hooks/use-influencer-lists";
import {
  useCreateInfluencerList,
  useAddToInfluencerList,
  useRemoveFromInfluencerList,
} from "@/hooks/use-creators-catalog";

import { PvModal } from "./pv-modal";

interface ListMembershipModalProps {
  /** `users.id` do influenciador (NÃO `social_networks.id`). */
  userId: number;
  influencerName: string;
  onClose: () => void;
}

/**
 * Gerencia em quais listas um influenciador está (adicionar/remover/criar).
 * Compartilhado entre o catálogo de Criadores e o perfil do influenciador.
 */
export function ListMembershipModal({
  userId,
  influencerName,
  onClose,
}: ListMembershipModalProps) {
  const { data: lists = [], isLoading } = useInfluencerLists();
  const membershipMap = useInfluencerMembershipMap();
  const addMutation = useAddToInfluencerList();
  const removeMutation = useRemoveFromInfluencerList();
  const createMutation = useCreateInfluencerList();
  const [newListName, setNewListName] = useState("");

  const currentLists = membershipMap.get(userId) ?? [];
  const currentListIds = new Set(currentLists.map((l) => l.id));

  const isPending =
    addMutation.isPending || removeMutation.isPending || createMutation.isPending;

  async function handleAdd(listId: string) {
    await addMutation.mutateAsync({ listId, userId });
  }

  async function handleRemove(listId: string) {
    await removeMutation.mutateAsync({ listId, userId });
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    const list = await createMutation.mutateAsync(newListName.trim());
    await addMutation.mutateAsync({ listId: list.id, userId });
    setNewListName("");
  }

  return (
    <PvModal sub="Organizar criadores" title="Salvar em lista" onClose={onClose}>
      <div className="sh-c">
        <div className="sh-ch2">
          <span className="sh-ic">
            <I n="heart" cls="sm" />
          </span>
          <div>
            <b>{influencerName}</b>
            <small>Marque as listas onde quer salvar</small>
          </div>
        </div>
        {isLoading ? (
          <div className="ov-empty" style={{ padding: "24px" }}>
            <small>Carregando listas...</small>
          </div>
        ) : lists.length === 0 ? (
          <div className="ov-empty" style={{ padding: "24px" }}>
            <small>Você ainda não tem nenhuma lista. Crie uma abaixo.</small>
          </div>
        ) : (
          <div className="cm-ls">
            {lists.map((list) => {
              const on = currentListIds.has(list.id);
              return (
                <button
                  key={list.id}
                  type="button"
                  className={on ? "on" : ""}
                  disabled={isPending}
                  onClick={() => (on ? handleRemove(list.id) : handleAdd(list.id))}
                >
                  <span className="cm-ck">
                    <I n="check" cls="sm" />
                  </span>
                  <div>
                    <b>{list.name}</b>
                    <small>
                      {list.influencer_count}{" "}
                      {list.influencer_count === 1 ? "criador" : "criadores"}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="sh-c">
        <div className="sh-ch2">
          <span className="sh-ic">
            <I n="plus" cls="sm" />
          </span>
          <div>
            <b>Nova lista</b>
            <small>Crie e salve ao mesmo tempo</small>
          </div>
        </div>
        <div className="sh-ad">
          <input
            placeholder="Nome da lista"
            autoComplete="off"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <button
            type="button"
            className="nbtn"
            onClick={handleCreate}
            disabled={isPending || !newListName.trim()}
          >
            <I n="plus" cls="sm" />
            {createMutation.isPending ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </PvModal>
  );
}
