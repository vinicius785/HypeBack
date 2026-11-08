import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/text-area";
import {
  useApproveContent,
  useCampaignContents,
  useRejectContent,
} from "@/hooks/use-campaign-contents";
import type { RawCampaignContentResponse } from "@/shared/types";

import { ContentPreview } from "./content-preview";

/** Colunas do quadro cuja ação acontece aqui (etapa Conteúdo). */
export const CONTENT_COLUMNS = ["pending_approval", "in_correction", "content_approved"] as const;
export const isContentColumn = (c: string) =>
  (CONTENT_COLUMNS as readonly string[]).includes(c);

const AWAITING = new Set(["pending", "awaiting_approval"]);

/** Prazo fixo de reenvio definido no backend (72h); só informativo. */
const CORRECTION_DEADLINE_HOURS = 72;

interface ContentPanelActionsProps {
  campaignId: string;
  influencerId: string;
  /** Conteúdo vindo de notificação: aparece primeiro. */
  highlightContentId?: string | null;
}

/**
 * Conteúdos do criador no painel lateral do card: vê o post, aprova ou pede
 * ajuste (feedback do vídeo e da legenda), sem sair do quadro.
 */
export function ContentPanelActions({
  campaignId,
  influencerId,
  highlightContentId,
}: ContentPanelActionsProps) {
  const queryClient = useQueryClient();
  const { data: contents = [], isLoading } = useCampaignContents(campaignId, {});
  const { mutate: approve, isPending: isApproving } = useApproveContent(campaignId);
  const { mutate: reject, isPending: isRejecting } = useRejectContent(campaignId);
  const [rejectTarget, setRejectTarget] = useState<RawCampaignContentResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [captionFeedback, setCaptionFeedback] = useState("");

  const refreshBoard = () =>
    queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "management"] });

  const mine = (contents as RawCampaignContentResponse[])
    .filter((c) => String(c.influencer_id ?? c.influencerId) === influencerId)
    .sort((a, b) => {
      if (String(a.id) === String(highlightContentId)) return -1;
      if (String(b.id) === String(highlightContentId)) return 1;
      return (
        new Date(b.submitted_at ?? b.submittedAt ?? 0).getTime() -
        new Date(a.submitted_at ?? a.submittedAt ?? 0).getTime()
      );
    });
  const awaiting = mine.filter((c) => AWAITING.has(String(c.status)));
  const shown = awaiting.length > 0 ? awaiting : mine.slice(0, 1);

  const closeReject = () => {
    setRejectTarget(null);
    setFeedback("");
    setCaptionFeedback("");
  };

  if (isLoading) return <small className="drw-hint">Carregando conteúdo…</small>;
  if (shown.length === 0) {
    return <small className="drw-hint">O criador ainda não enviou conteúdo.</small>;
  }

  return (
    <div className="kb2-sel">
      {shown.map((c) => {
        const pending = AWAITING.has(String(c.status));
        const urls = c.preview_urls ?? c.previewUrls ?? [];
        const url = urls[0] ?? c.preview_url ?? c.previewUrl;
        const type = c.content_type ?? c.contentType;
        const post = c.post_url ?? c.postUrl;
        return (
          <div key={c.id} className="kb2-prof">
            <div className="kb2-prof-h">
              <b>{type ? `Conteúdo · ${type}` : "Conteúdo"}</b>
              {urls.length > 1 && <small>{urls.length} arquivos</small>}
            </div>
            {url && (
              <div style={{ aspectRatio: "16 / 10", borderRadius: 12, overflow: "hidden" }}>
                <ContentPreview key={url} url={url} contentType={type} />
              </div>
            )}
            {post && (
              <a className="lnk" href={post} target="_blank" rel="noreferrer">
                Abrir publicação
              </a>
            )}
            {c.caption && (
              <p style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, maxHeight: 120, overflow: "auto" }}>
                {c.caption}
              </p>
            )}
            {!pending && c.feedback && (
              <small className="drw-hint">Feedback enviado: {c.feedback}</small>
            )}
            {pending && (
              <div className="kb2-r">
                <button
                  type="button"
                  className="btn ok"
                  disabled={isApproving || isRejecting}
                  onClick={() =>
                    approve(
                      { content_id: c.id },
                      {
                        onSuccess: () => {
                          toast.success("Conteúdo aprovado com sucesso!");
                          refreshBoard();
                        },
                        onError: (e: Error) => toast.error(e?.message || "Erro ao aprovar conteúdo"),
                      },
                    )
                  }
                >
                  Aprovar conteúdo
                </button>
                <button
                  type="button"
                  className="btn out dng"
                  disabled={isApproving || isRejecting}
                  onClick={() => setRejectTarget(c)}
                >
                  Pedir ajuste
                </button>
              </div>
            )}
          </div>
        );
      })}

      {rejectTarget && (
        <Modal title="Pedir ajuste no conteúdo" onClose={closeReject}>
          <div className="flex flex-col gap-5">
            <Textarea
              label="Feedback para o criador"
              placeholder="Explique o que precisa ser ajustado..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              error={!feedback.trim() ? "Este campo é obrigatório" : undefined}
            />
            <Textarea
              label="Feedback da legenda (opcional)"
              placeholder="Ajustes na legenda..."
              value={captionFeedback}
              onChange={(e) => setCaptionFeedback(e.target.value)}
            />
            <p className="text-xs text-neutral-500">
              O criador terá {CORRECTION_DEADLINE_HOURS} horas para reenviar.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={closeReject} className="flex-1">
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!feedback.trim() || isRejecting}
                onClick={() =>
                  reject(
                    {
                      content_id: rejectTarget.id,
                      feedback: feedback.trim(),
                      ...(captionFeedback.trim() && { caption_feedback: captionFeedback.trim() }),
                    },
                    {
                      onSuccess: () => {
                        toast.success("Ajuste solicitado ao criador.");
                        closeReject();
                        refreshBoard();
                      },
                      onError: (e: Error) => toast.error(e?.message || "Erro ao reprovar conteúdo"),
                    },
                  )
                }
              >
                Pedir ajuste
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
