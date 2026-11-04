import { Link } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import type { CampaignDraftSummary } from "@/lib/campaign-draft";

const SCENE_BG = "linear-gradient(135deg,#ead1ff,#c47aff,#5d1390)";

const savedLabel = (iso: string | null) => {
  if (!iso) return "Salvo neste navegador";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Salvo neste navegador";
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `Salvo em ${when}`;
};

/** Cartão do rascunho do assistente "Nova campanha" (ainda não existe na API). */
export function LocalDraftCard({ draft, onDiscard }: { draft: CampaignDraftSummary; onDiscard: () => void }) {
  const title = draft.title || "Campanha sem título";
  return (
    <article className="cc" aria-label={`${title}, rascunho`}>
      <Link to="/campaigns/new" params={{}} className="cc-img" aria-label={`Continuar editando ${title}`}>
        <div className="cc-scene" style={{ background: SCENE_BG }}>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "rgba(255,255,255,.4)",
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-.06em",
            }}
          >
            <I n="file" />
          </span>
        </div>
        <div className="cc-tags">
          <span className="badge">Não enviada</span>
          <span className="badge">Rascunho</span>
        </div>
      </Link>
      <div className="cc-box">
        <div className="cc-id">
          <div style={{ minWidth: 0 }}>
            <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</b>
            <small>{savedLabel(draft.savedAt)}</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/campaigns/new" params={{}} className="cc-go">
            <I n="file" cls="sm" />
            Continuar editando
          </Link>
          <button
            type="button"
            className="btn out"
            onClick={() => {
              if (window.confirm("Descartar este rascunho? Os dados preenchidos serão apagados.")) onDiscard();
            }}
          >
            Descartar
          </button>
        </div>
      </div>
    </article>
  );
}
