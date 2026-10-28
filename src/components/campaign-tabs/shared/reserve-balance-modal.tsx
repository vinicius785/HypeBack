import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { fmtBRL } from "./prices-utils";

export interface ReserveBalanceTarget {
  name: string;
  username?: string;
  avatar?: string;
  /** Rótulo opcional (ex.: "4 influencers") para o caso em lote. */
  countLabel?: string;
}

// ---------------------------------------------------------------------------
// ReserveBalancePreview — caixa "disponível → reservado"
// Reutilizável: usado standalone (modal de aprovação) e embutido (modal de convite).
// ---------------------------------------------------------------------------

interface ReserveBalancePreviewProps {
  /** Custo que será reservado, em centavos. `null` → indeterminado (price mode sem prices). */
  costCents: number | null;
  /** Disponível atual do workspace, em centavos. `null` → ainda carregando. */
  availableCents: number | null;
  /** Reservado atual, em centavos. Opcional — habilita a linha "Reservado após". */
  committedCents?: number | null;
}

/** Decompõe o movimento financeiro; reusado pelo preview e pelo gate do modal. */
function computeMovement({
  costCents,
  availableCents,
  committedCents,
}: ReserveBalancePreviewProps) {
  const costKnown = costCents != null;
  const availableKnown = availableCents != null;
  return {
    costKnown,
    availableKnown,
    availableAfter:
      costKnown && availableKnown ? availableCents - costCents : null,
    committedAfter:
      costKnown && committedCents != null ? committedCents + costCents : null,
    blocked: costKnown && availableKnown && costCents > availableCents,
  };
}

export function ReserveBalancePreview({
  costCents,
  availableCents,
  committedCents,
}: ReserveBalancePreviewProps) {
  const { availableAfter, committedAfter, blocked } = computeMovement({
    costCents,
    availableCents,
    committedCents,
  });

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-canvas p-4">
      <Row
        label="Custo de aprovação"
        value={costCents != null ? fmtBRL(costCents) : "A definir"}
        emphasis
      />

      <div className="h-px bg-neutral-200" />

      <Row
        label="Disponível agora"
        value={availableCents != null ? fmtBRL(availableCents) : "—"}
      />
      <Row
        label="Disponível após"
        value={availableAfter != null ? fmtBRL(availableAfter) : "—"}
        tone={blocked ? "danger" : "success"}
      />
      {committedAfter != null && (
        <Row
          label="Reservado após"
          value={fmtBRL(committedAfter)}
          tone="warning"
          icon="Lock"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReserveBalanceModal — modal completo de confirmação
// ---------------------------------------------------------------------------

interface ReserveBalanceModalProps {
  /** `null` mantém o modal fechado (mesmo padrão do RejectionModal). */
  target: ReserveBalanceTarget | null;
  costCents: number | null;
  availableCents: number | null;
  committedCents?: number | null;
  /** Texto do botão de confirmação (ex.: "Confirmar convite"). */
  confirmLabel?: string;
  title?: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Modal de confirmação de RESERVA de saldo (BRL) ao aceitar/convidar um
 * influencer. Mostra o preview do movimento "disponível → reservado" antes de
 * comprometer dinheiro real, conforme decisão de UX.
 *
 * Estados de custo:
 *  - `costCents` numérico → preview completo; bloqueia se exceder o disponível.
 *  - `costCents === null` → "A definir" (price mode sem prices definidos); não
 *    bloqueia (fail-open, alinhado ao gate de aprovação), mas avisa que o valor
 *    será negociado/definido depois.
 */
export function ReserveBalanceModal({
  target,
  costCents,
  availableCents,
  committedCents,
  confirmLabel = "Confirmar reserva",
  title = "Reservar saldo",
  isSubmitting = false,
  onConfirm,
  onClose,
}: ReserveBalanceModalProps) {
  if (!target) return null;

  const { costKnown, blocked } = computeMovement({
    costCents,
    availableCents,
    committedCents,
  });

  const subject =
    target.countLabel ?? (target.username ? `@${target.username}` : target.name);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {/* Alvo da reserva */}
        <div className="flex items-center gap-4">
          {target.countLabel ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <Icon name="Users" size={22} color="#0A0A0A" />
            </div>
          ) : (
            <Avatar src={target.avatar ?? ""} alt={target.name} size="lg" />
          )}
          <div>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {target.countLabel ?? target.name}
            </h3>
            {!target.countLabel && target.username && (
              <p className="text-neutral-600">@{target.username}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-neutral-600">
          Ao confirmar, o valor sai do seu{" "}
          <span className="font-medium text-neutral-900">disponível</span> e fica{" "}
          <span className="font-medium text-amber-700">reservado</span> para {subject}.
          Você reembolsa caso a parceria não avance.
        </p>

        <ReserveBalancePreview
          costCents={costCents}
          availableCents={availableCents}
          committedCents={committedCents}
        />

        {blocked && (
          <div className="flex items-start gap-2 rounded-xl bg-danger-50 p-3">
            <Icon name="TriangleAlert" size={16} color="#b91c1c" />
            <p className="text-sm text-danger-900">
              Saldo insuficiente para reservar esse valor. Adicione saldo antes de
              continuar.
            </p>
          </div>
        )}

        {!costKnown && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
            <Icon name="Info" size={16} color="#b45309" />
            <p className="text-sm text-amber-900">
              O valor exato ainda não está definido (preço a combinar). A reserva
              será ajustada quando o preço for acordado.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={blocked || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? "Reservando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Row — linha rótulo/valor do preview
// ---------------------------------------------------------------------------

type RowTone = "neutral" | "success" | "warning" | "danger";

const toneClass: Record<RowTone, string> = {
  neutral: "text-neutral-950",
  success: "text-success-600",
  warning: "text-amber-700",
  danger: "text-danger-600",
};

function Row({
  label,
  value,
  tone = "neutral",
  emphasis = false,
  icon,
}: {
  label: string;
  value: string;
  tone?: RowTone;
  emphasis?: boolean;
  icon?: Parameters<typeof Icon>[0]["name"];
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`flex items-center gap-1.5 text-sm ${
          emphasis ? "font-medium text-neutral-700" : "text-neutral-500"
        }`}
      >
        {icon && <Icon name={icon} size={14} color="#b45309" />}
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasis ? "text-base font-semibold" : "text-sm font-medium"} ${toneClass[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}
