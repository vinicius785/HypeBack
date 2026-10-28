import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/text-area";

export type BulkActionType = "approve" | "reject" | "curation";

interface BulkActionModalProps {
  actionType: BulkActionType | null;
  count: number;
  rejectionFeedback: string;
  onRejectionFeedbackChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

const ACTION_LABELS: Record<BulkActionType, { title: string; description: (n: number) => string; confirmLabel: string }> = {
  approve: {
    title: "Múltiplas aprovações",
    description: (n) => `Você está prestes a aprovar ${n} perfil(is) selecionado(s). Deseja continuar?`,
    confirmLabel: "Aprovar todos",
  },
  reject: {
    title: "Múltiplas reprovações",
    description: (n) => `Você está prestes a reprovar ${n} perfil(is) selecionado(s). Forneça um feedback:`,
    confirmLabel: "Reprovar todos",
  },
  curation: {
    title: "Mover para curadoria",
    description: (n) => `Você está prestes a mover ${n} perfil(is) para curadoria. Deseja continuar?`,
    confirmLabel: "Mover todos",
  },
};

/**
 * Modal compartilhado para ações em lote (aprovar, reprovar, mover para curadoria).
 * Renderiza o campo de feedback somente para ação "reject".
 */
export function BulkActionModal({
  actionType,
  count,
  rejectionFeedback,
  onRejectionFeedbackChange,
  onConfirm,
  onClose,
  isLoading,
}: BulkActionModalProps) {
  if (!actionType) return null;

  const config = ACTION_LABELS[actionType];
  const isReject = actionType === "reject";
  const canConfirm = isReject ? rejectionFeedback.trim().length > 0 : true;

  return (
    <Modal title={config.title} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <p className="text-base text-neutral-700">{config.description(count)}</p>

        {isReject && (
          <Textarea
            label="Feedback de reprovação"
            placeholder="Explique o motivo da reprovação..."
            value={rejectionFeedback}
            onChange={(e) => onRejectionFeedbackChange(e.target.value)}
            error={!rejectionFeedback.trim() ? "Este campo é obrigatório" : undefined}
          />
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canConfirm || isLoading}
            className={`flex-1 ${isReject ? "bg-danger-600 hover:bg-danger-700 text-white border-0" : ""}`}
          >
            {config.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
