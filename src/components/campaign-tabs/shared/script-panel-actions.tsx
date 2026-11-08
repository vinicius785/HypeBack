import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  useApproveScript,
  useCampaignScripts,
  useRejectScript,
} from "@/hooks/use-campaign-scripts";
import type { RawCampaignScriptResponse } from "@/shared/types";

import { RejectionModal } from "./rejection-modal";

/** Colunas do quadro cuja ação acontece aqui (etapa Roteiros). */
export const SCRIPT_COLUMNS = ["script_pending", "script_correction"] as const;
export const isScriptColumn = (c: string) =>
  (SCRIPT_COLUMNS as readonly string[]).includes(c);

const AWAITING = new Set(["pending", "awaiting_approval"]);

interface ScriptPanelActionsProps {
  campaignId: string;
  influencerId: string;
  influencer: { id: string; name: string; username?: string; avatar: string };
}

/**
 * Roteiros do criador no painel lateral do card: lê o texto enviado e aprova ou
 * pede ajuste (com feedback), sem sair do quadro.
 */
export function ScriptPanelActions({
  campaignId,
  influencerId,
  influencer,
}: ScriptPanelActionsProps) {
  const queryClient = useQueryClient();
  const { data: scripts = [], isLoading } = useCampaignScripts(campaignId, {});
  const { mutate: approve, isPending: isApproving } = useApproveScript(campaignId);
  const { mutate: reject, isPending: isRejecting } = useRejectScript(campaignId);
  const [rejectTarget, setRejectTarget] = useState<RawCampaignScriptResponse | null>(null);

  const refreshBoard = () =>
    queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "management"] });

  const mine = (scripts as RawCampaignScriptResponse[])
    .filter((s) => String(s.influencer_id) === influencerId)
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
    );
  const awaiting = mine.filter((s) => AWAITING.has(String(s.status)));
  const shown = awaiting.length > 0 ? awaiting : mine.slice(0, 1);

  if (isLoading) return <small className="drw-hint">Carregando roteiro…</small>;
  if (shown.length === 0) {
    return <small className="drw-hint">O criador ainda não enviou o roteiro.</small>;
  }

  return (
    <div className="kb2-sel">
      {shown.map((s) => {
        const pending = AWAITING.has(String(s.status));
        const network =
          s.social_network_type ||
          (typeof s.social_network === "object" && s.social_network
            ? s.social_network.type
            : (s.social_network as string | undefined)) ||
          "";
        return (
          <div key={s.id} className="kb2-prof">
            <div className="kb2-prof-h">
              <b>Roteiro{s.phase?.order != null ? ` · Fase ${s.phase.order}` : ""}</b>
              {network && <small>{network}</small>}
            </div>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, maxHeight: 220, overflow: "auto" }}>
              {s.script || "Sem texto"}
            </p>
            {s.file_url && (
              <a className="lnk" href={s.file_url} target="_blank" rel="noreferrer">
                Abrir arquivo anexado
              </a>
            )}
            {!pending && s.feedback && (
              <small className="drw-hint">Feedback enviado: {s.feedback}</small>
            )}
            {pending && (
              <div className="kb2-r">
                <button
                  type="button"
                  className="btn ok"
                  disabled={isApproving || isRejecting}
                  onClick={() =>
                    approve(
                      { script_id: s.id },
                      {
                        onSuccess: () => {
                          toast.success("Roteiro aprovado com sucesso!");
                          refreshBoard();
                        },
                        onError: (e: Error) => toast.error(e?.message || "Erro ao aprovar roteiro"),
                      },
                    )
                  }
                >
                  Aprovar roteiro
                </button>
                <button
                  type="button"
                  className="btn out dng"
                  disabled={isApproving || isRejecting}
                  onClick={() => setRejectTarget(s)}
                >
                  Pedir ajuste
                </button>
              </div>
            )}
          </div>
        );
      })}

      <RejectionModal
        influencer={rejectTarget ? influencer : null}
        onConfirm={(feedback) =>
          rejectTarget &&
          reject(
            { script_id: rejectTarget.id, feedback },
            {
              onSuccess: () => {
                toast.success("Roteiro rejeitado com sucesso!");
                setRejectTarget(null);
                refreshBoard();
              },
              onError: (e: Error) => toast.error(e?.message || "Erro ao rejeitar roteiro"),
            },
          )
        }
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
}
