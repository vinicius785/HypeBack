import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { StarRating } from "@/components/ui/star-rating";
import {
  useInfluencerEvaluation,
  useBrandEvaluation,
  useCreateInfluencerEvaluation,
} from "@/hooks/use-influencer-evaluation";
import type { PerformanceLevel, CreateEvaluationDto } from "@/shared/services/influencer-evaluation";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PERFORMANCE_OPTIONS: { value: PerformanceLevel; label: string; color: string }[] = [
  { value: "excellent", label: "Excelente", color: "border-green-500 bg-green-50 text-green-700" },
  { value: "good", label: "Bom", color: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "average", label: "Regular", color: "border-yellow-400 bg-yellow-50 text-yellow-700" },
  { value: "poor", label: "Ruim", color: "border-red-400 bg-red-50 text-red-700" },
];

const labelClass = "text-sm font-medium text-[#0A0A0A]";
const inputClass =
  "w-full rounded-[12px] bg-[#F5F5F5] px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y";

// ---------------------------------------------------------------------------
// Modal de avaliação
// ---------------------------------------------------------------------------

function EvaluationModal({
  campaignId,
  participant,
  onClose,
}: {
  campaignId: string;
  participant: CampaignManagementParticipant;
  onClose: () => void;
}) {
  const influencerId = participant.user_id ?? String(participant.id);

  const { data: existing, isLoading: loadingEval } = useInfluencerEvaluation(campaignId, influencerId);
  const { data: brandEval, isLoading: loadingBrand } = useBrandEvaluation(campaignId, influencerId);
  const { mutate: submit, isPending } = useCreateInfluencerEvaluation(campaignId);

  const [rating, setRating] = useState(0);
  const [performance, setPerformance] = useState<PerformanceLevel | null>(null);
  const [feedback, setFeedback] = useState("");
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);

  const isLoading = loadingEval || loadingBrand;
  const alreadyEvaluated = !!existing;

  const handleSubmit = () => {
    if (rating === 0) return toast.error("Selecione uma nota.");
    if (!performance) return toast.error("Selecione o desempenho.");
    if (!feedback.trim()) return toast.error("Escreva um feedback.");
    if (wouldWorkAgain === null) return toast.error("Informe se trabalharia novamente.");

    const dto: CreateEvaluationDto = {
      rating,
      feedback: feedback.trim(),
      performance,
      would_work_again: wouldWorkAgain,
    };

    submit(
      { influencerId, dto },
      {
        onSuccess: () => {
          toast.success("Avaliação enviada com sucesso.");
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erro ao enviar avaliação.");
        },
      }
    );
  };

  return (
    <Modal
      title={`Avaliar — ${participant.name}`}
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      {isLoading ? (
        <div className="flex flex-col gap-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ---- Avaliação do backoffice ---- */}
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
              Sua avaliação
            </p>

            {alreadyEvaluated ? (
              /* Leitura da avaliação já feita */
              <div className="flex flex-col gap-3 rounded-[22px] bg-canvas p-4">
                <StarRating value={existing.rating} readonly />
                <div className="flex items-center gap-2">
                  {(() => {
                    const p = PERFORMANCE_OPTIONS.find((o) => o.value === existing.performance);
                    return p ? (
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${p.color}`}>
                        {p.label}
                      </span>
                    ) : null;
                  })()}
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${existing.would_work_again ? "border-green-400 bg-green-50 text-green-700" : "border-red-400 bg-red-50 text-red-700"}`}>
                    {existing.would_work_again ? "Trabalharia novamente" : "Não trabalharia novamente"}
                  </span>
                </div>
                <p className="text-sm text-neutral-700">{existing.feedback}</p>
              </div>
            ) : (
              /* Formulário de nova avaliação */
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Nota <span className="text-red-500">*</span></label>
                  <StarRating value={rating} onChange={setRating} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Desempenho <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {PERFORMANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPerformance(opt.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          performance === opt.value
                            ? opt.color
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Feedback <span className="text-red-500">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="Descreva o desempenho do influenciador nessa campanha..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Trabalharia novamente? <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setWouldWorkAgain(v)}
                        className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          wouldWorkAgain === v
                            ? v
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-red-400 bg-red-50 text-red-700"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {v ? "Sim" : "Não"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" className="flex-1" disabled={isPending} onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={isPending}
                    onClick={handleSubmit}
                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white border-0"
                  >
                    {isPending ? "Enviando..." : "Enviar avaliação"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Avaliação da marca pelo influenciador ----
              Regra: enquanto a marca não avaliou o influencer, a avaliação
              recíproca fica oculta (blur + aviso). Evita viés mútuo. */}
          <BrandEvaluationSection
            brandEval={brandEval}
            locked={!alreadyEvaluated && !!brandEval}
          />

        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// BrandEvaluationSection — avaliação que o influencer fez da marca
// ---------------------------------------------------------------------------

/**
 * Renderiza a avaliação que o influencer deu à marca, com 3 estados:
 *
 *  1. Sem dado (`brandEval = null`)   → mensagem "ainda não avaliou"
 *  2. Com dado + `locked=false`        → renderização normal
 *  3. Com dado + `locked=true`         → blur + overlay com aviso. Marca
 *     ainda não enviou sua avaliação e não pode ver a recíproca antes — evita
 *     viés mútuo.
 */
function BrandEvaluationSection({
  brandEval,
  locked,
}: {
  brandEval: import("@/shared/services/influencer-evaluation").BrandEvaluationRecord | null | undefined;
  locked: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
        O que o influenciador achou
      </p>

      {!brandEval ? (
        <p className="text-sm text-neutral-400 italic">
          O influenciador ainda não avaliou a marca.
        </p>
      ) : (
        <div className="relative">
          {/* Conteúdo (blurrado quando locked) */}
          <div
            aria-hidden={locked}
            className={
              locked
                ? "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 blur-md select-none pointer-events-none"
                : "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
            }
          >
            <StarRating value={brandEval.rating} readonly />
            <span
              className={`self-start rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                brandEval.would_work_again
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
              }`}
            >
              {brandEval.would_work_again
                ? "Trabalharia novamente"
                : "Não trabalharia novamente"}
            </span>
            <p className="text-sm text-neutral-700">{brandEval.feedback}</p>
          </div>

          {/* Overlay com aviso quando locked */}
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/30">
              <div className="flex flex-col items-center gap-2 rounded-[28px] bg-white px-5 py-4 shadow-lg max-w-xs text-center">
                <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
                  <Icon name="Lock" size={16} color="#4f46e5" />
                </div>
                <p className="text-sm font-semibold text-neutral-950">
                  Avaliação oculta
                </p>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Envie sua avaliação primeiro para ver o que o influenciador achou da marca.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de influenciador
// ---------------------------------------------------------------------------

function ParticipantCard({
  participant,
  onEvaluate,
}: {
  participant: CampaignManagementParticipant;
  onEvaluate: (p: CampaignManagementParticipant) => void;
}) {
  const network = participant.social_networks?.[0]?.type ?? participant.social_network;

  return (
    <div className="flex items-center justify-between gap-4 rounded-[28px] bg-white px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={participant.avatar} alt={participant.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{participant.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {participant.username ? `@${participant.username}` : "—"}
            {network && <span className="ml-1.5 capitalize text-neutral-400">· {network}</span>}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => onEvaluate(participant)}
        className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="Star" size={13} color="#404040" />
          Avaliar
        </span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção principal (exportada)
// ---------------------------------------------------------------------------

export function InfluencerEvaluationSection({
  campaignId,
  participants,
}: {
  campaignId: string;
  participants: CampaignManagementParticipant[];
}) {
  const [target, setTarget] = useState<CampaignManagementParticipant | null>(null);

  if (!participants.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Avaliação dos influenciadores</h2>
        <p className="text-sm text-neutral-500">
          Avalie o desempenho de cada influenciador após a campanha.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {participants.map((p) => (
          <ParticipantCard key={p.id} participant={p} onEvaluate={setTarget} />
        ))}
      </div>

      {target && (
        <EvaluationModal
          campaignId={campaignId}
          participant={target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
