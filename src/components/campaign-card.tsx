import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { Workspace } from "@/shared/types";
import {
  getCampaignStatusDisplayLabel,
  getCampaignStatusValue,
} from "@/shared/utils/campaign-status";

/** Iniciais das duas primeiras palavras; símbolos soltos (como o "—" de "Marca — Campanha") não contam. */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((c): c is string => !!c)
    .slice(0, 2)
    .map((c) => c.toUpperCase())
    .join("");
}

export function formatCompact(n: number): string {
  return n.toLocaleString("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

const initialsOf = getInitials;
const compact = formatCompact;

const SCENE_BG = "linear-gradient(135deg,#ead1ff,#c47aff,#5d1390)";

export type CampaignTileRow = {
  campaign: {
    id: string | number;
    title: string;
    description?: string | null;
    status?: unknown;
  };
  overview?: {
    metrics: {
      reach: number;
      publishedContent: number;
      activeInfluencers?: number;
    };
  };
  pendingTotal: number;
};

/** Marca dona da campanha (o workspace): nome e foto do círculo do cartão. */
export type CampaignBrand = Pick<Workspace, "name" | "photo">;

/** Círculo da marca (`.brand`): foto quando existir e iniciais como reserva (sem foto ou se ela falhar). */
function BrandMark({ brand, fallbackName }: { brand?: CampaignBrand; fallbackName: string }) {
  const url = getUploadUrl(brand?.photo);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span className="brand" style={{ background: "#9e2cfa", overflow: "hidden" }}>
      {url && !broken ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setBroken(true)}
        />
      ) : (
        initialsOf(brand?.name || fallbackName)
      )}
    </span>
  );
}

export function CampaignTile({
  row,
  i,
  metricsReady,
  banner,
  brand,
}: {
  row: CampaignTileRow;
  i: number;
  metricsReady: boolean;
  banner?: string;
  brand?: CampaignBrand;
}) {
  const navigate = useNavigate();
  const { campaign, overview, pendingTotal } = row;
  const status = getCampaignStatusValue(campaign.status) ?? "";
  const draft = status === "draft";
  const finished = status === "finished" || status === "completed";
  const active = status === "active" || status === "published";
  const published = overview?.metrics.publishedContent ?? 0;
  const creators = overview?.metrics.activeInfluencers ?? 0;
  const pr = finished ? 100 : draft ? 0 : creators > 0 ? Math.min(100, Math.round((published / creators) * 100)) : 0;
  const statusLabel = active ? "Ativa" : finished ? "Finalizada" : draft ? "Rascunho" : getCampaignStatusDisplayLabel(status);

  return (
    <article
      className="cc"
      style={{ ["--i" as string]: i }}
      role="link"
      tabIndex={0}
      aria-label={`${campaign.title}, ${statusLabel}`}
      onClick={() =>
        navigate({ to: "/campaigns/$campaignId", params: { campaignId: String(campaign.id) } })
      }
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate({ to: "/campaigns/$campaignId", params: { campaignId: String(campaign.id) } });
        }
      }}
    >
      <div className="cc-img">
        <div
          className="cc-scene"
          style={{
            background: SCENE_BG,
          }}
        >
          {banner ? (
            <img src={getUploadUrl(banner)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
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
              {initialsOf(campaign.title)}
            </span>
          )}
        </div>
        <div className="cc-tags">
          <span className="badge">{metricsReady ? `${creators} criadores` : "—"}</span>
          <span className={`badge ${active ? "on" : finished ? "k" : ""}`}>{statusLabel}</span>
        </div>
      </div>
      <div className="cc-box">
        <div className="cc-id">
          <BrandMark brand={brand} fallbackName={campaign.title} />
          <div style={{ minWidth: 0 }}>
            <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.title}</b>
            <small>{campaign.description ? campaign.description.slice(0, 34) : "Sem descrição"}</small>
          </div>
        </div>
        <div className="cc-bar">
          <div className="cc-bh">
            <span>Progresso de publicação</span>
            <b>{pr}%</b>
          </div>
          <div className="cc-trk">
            <i style={{ ["--w" as string]: `${pr}%`, ["--i" as string]: i }} />
          </div>
        </div>
        <div className="cc-st">
          <div>
            <small>Alcance</small>
            <b>{metricsReady ? compact(overview?.metrics.reach ?? 0) : "—"}</b>
          </div>
          <div>
            <small>Publicados</small>
            <b>{metricsReady ? published : "—"}</b>
          </div>
          <div>
            <small>Pendentes</small>
            <b className={metricsReady && pendingTotal > 0 ? "hot" : ""}>{metricsReady ? pendingTotal : "—"}</b>
          </div>
        </div>
        {draft && (
          <span className="cc-go">
            <I n="file" cls="sm" />
            Continuar editando
          </span>
        )}
      </div>
    </article>
  );
}

export interface CampaignCardProps {
  id: string | number;
  title: string;
  description?: string;
  /** Status normalizado (active, draft, finished…). */
  status: string;
  banner?: string;
  /** Marca (workspace) — foto e nome para o círculo ao lado do título. */
  brand?: CampaignBrand;
  /** Métricas — `undefined` = ainda carregando / indisponível ("—"). */
  reach?: number;
  published?: number;
  pending?: number;
  creators?: number;
  /** Índice p/ animação escalonada (`--i`). */
  index?: number;
}

function toRow(p: CampaignCardProps): CampaignTileRow {
  const ready = p.reach !== undefined;
  return {
    campaign: { id: p.id, title: p.title, description: p.description, status: p.status },
    overview: ready
      ? {
          metrics: {
            reach: p.reach ?? 0,
            publishedContent: p.published ?? 0,
            activeInfluencers: p.creators ?? 0,
          },
        }
      : undefined,
    pendingTotal: p.pending ?? 0,
  };
}

/** Cartão `.cc` do protótipo (mesmo do carrossel do Início). Envolva em `.pv`. */
export function CampaignCard(props: CampaignCardProps) {
  return (
    <CampaignTile
      row={toRow(props)}
      i={props.index ?? 0}
      metricsReady={props.reach !== undefined}
      banner={props.banner}
      brand={props.brand}
    />
  );
}

/** Linha `.lr` da visão em lista. Envolva em `.pv .clist`. */
export function CampaignRow(props: CampaignCardProps) {
  const navigate = useNavigate();
  const { id, title, description, banner, reach, published, pending, creators } = props;
  const i = props.index ?? 0;
  const ready = reach !== undefined;
  const status = getCampaignStatusValue(props.status) ?? "";
  const draft = status === "draft";
  const finished = status === "finished" || status === "completed";
  const active = status === "active" || status === "published";
  const pub = published ?? 0;
  const cr = creators ?? 0;
  const pr = finished ? 100 : draft ? 0 : cr > 0 ? Math.min(100, Math.round((pub / cr) * 100)) : 0;
  const statusLabel = active ? "Ativa" : finished ? "Finalizada" : draft ? "Rascunho" : getCampaignStatusDisplayLabel(status);
  const pend = pending ?? 0;

  return (
    <article
      className="lr"
      style={{ ["--i" as string]: i }}
      onClick={() => navigate({ to: "/campaigns/$campaignId", params: { campaignId: String(id) } })}
    >
      <span className="lt">
        <span className="c-scene" style={{ background: SCENE_BG, position: "relative" }}>
          {banner ? (
            <img src={getUploadUrl(banner)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "rgba(255,255,255,.5)",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {initialsOf(title)}
            </span>
          )}
        </span>
      </span>
      <div className="lm" style={{ minWidth: 0 }}>
        <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</b>
        <small>{description ? description.slice(0, 34) : "Sem descrição"}</small>
      </div>
      <span className={`pill ${active ? "p" : finished ? "k" : ""}`}>{statusLabel}</span>
      <div className="lp">
        <div className="cc-bh">
          <span>Publicados</span>
          <b>{pr}%</b>
        </div>
        <div className="cc-trk">
          <i style={{ ["--w" as string]: `${pr}%`, ["--i" as string]: i }} />
        </div>
      </div>
      <div className="ls">
        <small>Alcance</small>
        <b>{ready ? compact(reach ?? 0) : "—"}</b>
      </div>
      <div className="ls">
        <small>Publicados</small>
        <b>{ready ? pub : "—"}</b>
      </div>
      <div className="ls">
        <small>Pendentes</small>
        <span className={`pend ${ready && pend > 0 ? "" : "z"}`}>{ready ? pend : "—"}</span>
      </div>
      <I n="chev" cls="sm" />
    </article>
  );
}
