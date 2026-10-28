import { Modal } from "@/components/ui/modal";
import { StarRating } from "@/components/ui/star-rating";
import { useInfluencerEvaluation } from "@/hooks/use-influencer-evaluation";
import type { PerformanceLevel } from "@/shared/services/influencer-evaluation";

const PERFORMANCE_LABELS: Record<PerformanceLevel, { label: string; color: string }> = {
  excellent: { label: "Excelente", color: "border-green-500 bg-green-50 text-green-700" },
  good: { label: "Bom", color: "border-blue-400 bg-blue-50 text-blue-700" },
  average: { label: "Regular", color: "border-yellow-400 bg-yellow-50 text-yellow-700" },
  poor: { label: "Ruim", color: "border-red-400 bg-red-50 text-red-700" },
};

interface CampaignEvaluationViewModalProps {
  campaignId: string;
  /** user_id do influenciador — mesmo identificador usado em /users/{id}/evaluation */
  influencerId: string;
  campaignName: string;
  onClose: () => void;
}

/**
 * Modal somente-leitura da avaliação que a marca deu ao influenciador numa campanha.
 *
 * Consome `GET /campaigns/{campaignId}/users/{influencerId}/evaluation` via
 * `useInfluencerEvaluation`. A consulta é cacheada por TanStack Query, então
 * abrir/fechar/reabrir é instantâneo após o primeiro fetch.
 */
export function CampaignEvaluationViewModal({
  campaignId,
  influencerId,
  campaignName,
  onClose,
}: CampaignEvaluationViewModalProps) {
  const { data, isLoading, isError } = useInfluencerEvaluation(campaignId, influencerId);

  const performance = data ? PERFORMANCE_LABELS[data.performance] : null;
  const createdAtLabel = data?.created_at
    ? new Date(data.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <Modal title={`Avaliação — ${campaignName}`} onClose={onClose} panelClassName="max-w-lg">
      {isLoading ? (
        <div className="flex flex-col gap-3 py-2">
          <div className="skeleton h-7 w-40 rounded-lg" />
          <div className="skeleton h-6 w-64 rounded-full" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <p className="text-sm text-neutral-500 py-4">
          Falha ao carregar a avaliação. Tente novamente em instantes.
        </p>
      ) : !data ? (
        <p className="text-sm text-neutral-500 py-4">
          Nenhuma avaliação registrada para esta campanha.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <StarRating value={data.rating} readonly />

          <div className="flex flex-wrap items-center gap-2">
            {performance && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${performance.color}`}
              >
                {performance.label}
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                data.would_work_again
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
              }`}
            >
              {data.would_work_again ? "Trabalharia novamente" : "Não trabalharia novamente"}
            </span>
          </div>

          {data.feedback?.trim() && (
            <p className="rounded-[22px] bg-canvas p-4 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
              “{data.feedback}”
            </p>
          )}

          {createdAtLabel && (
            <p className="text-xs text-neutral-500 text-right">
              Avaliada em {createdAtLabel}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
