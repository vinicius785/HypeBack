import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/text-area";

interface RejectionModalProps {
  influencer: { id: string; name: string; username?: string; avatar: string } | null;
  onConfirm: (feedback: string) => void;
  onClose: () => void;
}

/**
 * Modal de reprovação individual. Controla internamente o textarea de feedback,
 * zerando ao fechar. O pai só precisa chamar onConfirm com o feedback preenchido.
 */
export function RejectionModal({ influencer, onConfirm, onClose }: RejectionModalProps) {
  const [feedback, setFeedback] = useState("");

  if (!influencer) return null;

  const handleClose = () => {
    setFeedback("");
    onClose();
  };

  const handleConfirm = () => {
    if (!feedback.trim()) return;
    onConfirm(feedback);
    setFeedback("");
  };

  return (
    <Modal title="Reprovar influenciador" onClose={handleClose}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar src={influencer.avatar} alt={influencer.name} size="lg" />
          <div>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">{influencer.name}</h3>
            {influencer.username && <p className="text-neutral-600">@{influencer.username}</p>}
          </div>
        </div>

        <div className="bg-danger-50 rounded-2xl p-4">
          <p className="text-sm text-danger-900">
            O feedback é obrigatório ao reprovar um influenciador. Ele será enviado ao
            influenciador para que possa entender o motivo da reprovação.
          </p>
        </div>

        <Textarea
          label="Feedback de reprovação"
          placeholder="Explique o motivo da reprovação..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          error={!feedback.trim() ? "Este campo é obrigatório" : undefined}
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!feedback.trim()} className="flex-1">
            Confirmar reprovação
          </Button>
        </div>
      </div>
    </Modal>
  );
}
