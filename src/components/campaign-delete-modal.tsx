import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDeleteCampaign } from "@/hooks/use-campaigns";

/** Texto do erro da API (`message` pode vir como lista); sem nada utilizável, o texto padrão. */
export function campaignDeleteErrorText(error: unknown): string {
  const e = error as { message?: string | string[]; errors?: string[] } | null;
  const text = Array.isArray(e?.message) ? e.message.join(" ") : e?.message || e?.errors?.join(" ");
  return text?.trim() || "Não foi possível excluir a campanha. Tente novamente.";
}

/**
 * Exclusão da campanha pelo workspace de origem: o título digitado confirma. É definitiva (participações, conteúdos,
 * roteiros e contratos saem junto). Se a campanha já movimentou saldo de criadores, a API recusa (409) e o diálogo
 * mostra o motivo e continua aberto: o caminho é encerrar a campanha.
 */
export function CampaignDeleteModal({
  campaignId,
  title,
  onClose,
  onDeleted,
}: {
  campaignId: string;
  title: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useDeleteCampaign();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  const confirm = () => {
    setError(null);
    mutation.mutate(campaignId, {
      onSuccess: () => {
        toast.success("Campanha excluída.");
        onClose();
        onDeleted();
      },
      onError: (failure) => setError(campaignDeleteErrorText(failure)),
    });
  };

  return (
    <Modal title="Excluir campanha" onClose={() => !mutation.isPending && onClose()} panelClassName="max-w-md">
      <p className="mb-3 text-sm text-neutral-600">
        <b>{title}</b> será excluída para sempre, com as participações, os conteúdos, os roteiros e os contratos. O link
        de inscrição deixa de funcionar. Isto não pode ser desfeito.
      </p>
      <p className="mb-4 text-sm text-neutral-600">
        Se a campanha já pagou ou reservou valores a criadores, ela não pode ser excluída: encerre-a para preservar o
        histórico.
      </p>
      <label className="mb-1 block text-sm font-medium text-neutral-800" htmlFor="campaign-delete-title">
        Para confirmar, digite o título da campanha
      </label>
      <input
        id="campaign-delete-title"
        className="mb-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
        placeholder={title}
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-w-[120px] flex-1"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="min-w-[120px] flex-1 border-0 bg-danger-600 text-white hover:bg-danger-700"
          disabled={mutation.isPending || !matches}
          onClick={confirm}
        >
          {mutation.isPending ? "Excluindo…" : "Excluir campanha"}
        </Button>
      </div>
    </Modal>
  );
}
