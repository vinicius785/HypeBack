import { useEffect, useState, type ReactNode } from "react";

import { getInitials } from "@/components/campaign-card";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";

export interface CampaignHeaderProps {
  title: string;
  description?: string;
  /** Path do banner (1280 × 512, proporção 5:2). */
  banner?: string | null;
  /** Status normalizado (draft, published, finished…) e o rótulo da etiqueta. */
  status: string;
  statusLabel: string;
  creators: number;
  /** Progresso geral, de 0 a 100. */
  progress: number;
  /** `campaigns_write`: libera publicar, verificar publicações, editar e despublicar. */
  canWrite: boolean;
  checking: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onCheckPublications: () => void;
  onEdit: () => void;
  onOpenInvite: () => void;
  onShare: () => void;
  /** Abas da campanha, coladas na base do cartão. */
  children?: ReactNode;
}

/** Cartão `.chd` do detalhe da campanha: banner inteiro, identificação, ações e abas. Envolva em `.pv`. */
export function CampaignHeader({
  title,
  description,
  banner,
  status,
  statusLabel,
  creators,
  progress,
  canWrite,
  checking,
  onPublish,
  onUnpublish,
  onCheckPublications,
  onEdit,
  onOpenInvite,
  onShare,
  children,
}: CampaignHeaderProps) {
  const cover = getUploadUrl(banner);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [cover]);

  const draft = status === "draft";
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const tone =
    status === "published" || status === "active"
      ? "p"
      : status === "finished" || status === "completed"
        ? "k"
        : "";

  return (
    <section className="chd fade">
      <div className="chd-top">
        <div className="chd-cover">
          {cover && !broken ? (
            <img src={cover} alt="" onError={() => setBroken(true)} />
          ) : (
            <span className="chd-ph">{getInitials(title) || "?"}</span>
          )}
        </div>
        <div className="chd-main">
          <div className="chd-meta">
            {status === "published" && canWrite ? (
              <button type="button" className="pill p" title="Despublicar campanha" onClick={onUnpublish}>
                {statusLabel}
              </button>
            ) : (
              <span className={`pill ${tone}`.trim()}>{statusLabel}</span>
            )}
            <span>
              <b>{creators}</b> {creators === 1 ? "criador" : "criadores"}
            </span>
            <span className="chd-prog">
              <span className="chd-pg" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span>
                <b>{pct}%</b> concluído
              </span>
            </span>
          </div>
          <h1 title={title}>{title}</h1>
          {description ? <p className="chd-desc">{description}</p> : null}
        </div>
      </div>
      <div className="chd-act">
        {canWrite && draft && (
          <button type="button" className="btn" onClick={onPublish}>
            <I n="send" cls="sm" />
            Publicar
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            className={draft ? "btn out" : "btn"}
            disabled={checking}
            onClick={onCheckPublications}
          >
            <I n="refresh" cls="sm" />
            {checking ? "Verificando..." : "Verificar publicações"}
          </button>
        )}
        {canWrite && (
          <button type="button" className="btn out" onClick={onEdit}>
            <I n="notepad" cls="sm" />
            Editar
          </button>
        )}
        <span className="chd-qs">
          <button type="button" className={canWrite ? "chd-q" : "btn"} onClick={onOpenInvite}>
            <I n="eye" cls="sm" />
            Ver convite
          </button>
          <button type="button" className="chd-q" onClick={onShare}>
            <I n="share" cls="sm" />
            Compartilhar
          </button>
        </span>
      </div>
      {children}
    </section>
  );
}
