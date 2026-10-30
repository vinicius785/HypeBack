import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useInfluencerProfile } from "@/hooks/use-influencer-profile";
import { CampaignEvaluationViewModal } from "@/components/campaign-tabs/shared/campaign-evaluation-view-modal";
import { ListMembershipModal } from "@/components/influencer-lists/list-membership-modal";
import { CampaignPickerModal } from "@/components/influencer-lists/campaign-picker-modal";
import { InfluencerProfileView } from "@/components/influencer-profile/influencer-profile-view";

import "@/styles/prototype-profile.css";
import { appUrl } from "@/lib/utils/base-path";

const CLOSE_MS = 300;

interface InfluencerProfileDrawerProps {
  influencerId: string;
  onClose: () => void;
}

/**
 * Gaveta lateral com o perfil do criador (protótipo `pfHTML`). Renderiza o
 * `InfluencerProfileView` em `variant="drawer"` e concentra as ações do
 * backoffice (avaliação, salvar em lista, convite/pré-seleção, copiar link).
 * Os modais Tailwind ficam FORA do escopo `.pv`.
 */
export function InfluencerProfileDrawer({ influencerId, onClose }: InfluencerProfileDrawerProps) {
  const [metricsPosts, setMetricsPosts] = useState(10);
  const { data, isLoading, isError, error } = useInfluencerProfile(influencerId, metricsPosts);
  const [evaluationTarget, setEvaluationTarget] = useState<{ id: string; name: string } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [campaignAction, setCampaignAction] = useState<"invite" | "preselection" | null>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !evaluationTarget && !showSaveModal && !campaignAction) requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, evaluationTarget, showSaveModal, campaignAction]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const influencer = data?.influencer;
  const userIdNum = influencer?.id != null ? Number(influencer.id) : NaN;
  const disabled = Number.isNaN(userIdNum);
  const profileIds = (influencer?.social_networks ?? [])
    .map((sn) => String(sn.id))
    .filter((id) => id.trim() !== "");

  const handleCopyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl(`/influencer/${influencerId}`));
      toast.success("Link do perfil copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const cls = closing ? " out" : "";

  if (isLoading || isError || !data || !influencer) {
    const failed = !isLoading;
    const is404 = (error as { status?: number } | null)?.status === 404;
    return (
      <div className="pv">
        <div className={`ovb on${cls}`} onClick={requestClose} />
        <aside className={`ovp pf on${cls}`} role="dialog" aria-label="Perfil do criador">
          <button type="button" className="round ov-x" onClick={requestClose} aria-label="Fechar">
            <I n="x" cls="sm" />
          </button>
          <div className="pf-sc">
            {failed ? (
              <p style={{ padding: "40px 0", textAlign: "center", fontWeight: 600 }}>
                {is404 ? "Influenciador não encontrado." : "Erro ao carregar perfil."}
              </p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                  <div className="sk" style={{ width: 92, height: 92, borderRadius: "50%" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="sk" style={{ height: 24, width: "55%" }} />
                    <div className="sk" style={{ height: 14, width: "35%" }} />
                  </div>
                </div>
                <div className="sk" style={{ height: 56, marginTop: 24 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 20 }}>
                  {[0, 1, 2, 3].map((k) => (
                    <div key={k} className="sk" style={{ height: 78 }} />
                  ))}
                </div>
                <div className="sk" style={{ height: 160, marginTop: 24 }} />
                <div className="sk" style={{ height: 160, marginTop: 16 }} />
              </>
            )}
          </div>
        </aside>
      </div>
    );
  }

  const footer = (
    <>
      <button type="button" className="btn" onClick={() => setCampaignAction("invite")} disabled={disabled}>
        <I n="send" cls="sm" />
        Enviar convite
      </button>
      <button type="button" className="btn out" onClick={() => setCampaignAction("preselection")} disabled={disabled}>
        Convidar para pré-seleção
      </button>
      <button
        type="button"
        className="btn out"
        onClick={() => setShowSaveModal(true)}
        disabled={disabled}
        title="Salvar este influenciador em uma lista"
      >
        <I n="heart" cls="sm" />
        Salvar influenciador
      </button>
      <div className="pf-ig">
        <button
          type="button"
          className="round"
          onClick={handleCopyProfileLink}
          aria-label="Copiar link do perfil"
          title="Copiar link do perfil"
        >
          <I n="link" cls="sm" />
        </button>
      </div>
    </>
  );

  return (
    <>
      <InfluencerProfileView
        data={data}
        mode="private"
        variant="drawer"
        closing={closing}
        onClose={requestClose}
        metricsPosts={metricsPosts}
        onMetricsPostsChange={setMetricsPosts}
        onEvaluate={(id, name) => setEvaluationTarget({ id, name })}
        footer={footer}
      />

      {/* Modais Tailwind fora do `.pv`; z-index acima da gaveta (z 90/91). */}
      <div style={{ position: "relative", zIndex: 100 }}>
        {evaluationTarget && (
          <CampaignEvaluationViewModal
            campaignId={evaluationTarget.id}
            influencerId={influencerId}
            campaignName={evaluationTarget.name}
            onClose={() => setEvaluationTarget(null)}
          />
        )}
        {showSaveModal && !disabled && (
          <ListMembershipModal
            userId={userIdNum}
            influencerName={influencer.name ?? "Influenciador"}
            onClose={() => setShowSaveModal(false)}
          />
        )}
        {campaignAction && !disabled && (
          <CampaignPickerModal
            mode={campaignAction}
            influencerId={String(influencer.id)}
            influencerName={influencer.name ?? "Influenciador"}
            profileIds={profileIds}
            onClose={() => setCampaignAction(null)}
          />
        )}
      </div>
    </>
  );
}
