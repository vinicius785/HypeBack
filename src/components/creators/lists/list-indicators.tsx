import { Skeleton } from "@/components/ui/skeleton";
import type { InfluencerListReach, ReachNetworkKey } from "@/shared/services/influencer-lists";

import { fmtCompact } from "./list-format";

const NETWORK_LABEL: Record<ReachNetworkKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

interface Props {
  data?: InfluencerListReach;
  /** Total de criadores da lista (o que a tela sabe, mesmo quando o alcance ainda carrega). */
  creators: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

/**
 * Indicadores consolidados da lista. Cálculo e identificação das estimativas são os da API
 * (uma publicação por criador, pelo alcance médio recente de cada conta); aqui só a apresentação.
 */
export function ListIndicators({ data, creators, isLoading, isError, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="lst-kpis" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="lst-note" role="status">
        <span>Não foi possível calcular o alcance desta lista agora.</span>
        {onRetry && (
          <button type="button" className="lnk" onClick={onRetry}>
            Tentar de novo
          </button>
        )}
      </div>
    );
  }
  const missing = data.creators_total - data.creators_with_reach;
  const rate = data.followers_total > 0 ? (data.estimated_reach_total / data.followers_total) * 100 : 0;

  return (
    <section aria-label="Indicadores da lista" className="lst-ind">
      <div className="lst-kpis">
        <div className="lst-kpi strong">
          <small>Alcance estimado</small>
          <b>{fmtCompact(data.estimated_reach_total)}</b>
          <span>{data.followers_total > 0 ? `${rate.toFixed(1).replace(".", ",")}% dos seguidores` : "—"}</span>
        </div>
        <div className="lst-kpi">
          <small>Seguidores somados</small>
          <b>{fmtCompact(data.followers_total)}</b>
          <span>nas redes sociais</span>
        </div>
        <div className="lst-kpi">
          <small>Criadores</small>
          <b>{creators}</b>
          <span>{data.creators_with_network} com rede social</span>
        </div>
      </div>

      {data.by_network.length > 0 && (
        <ul className="lst-nets" aria-label="Alcance por rede">
          {data.by_network.map((n) => (
            <li key={n.network} title={`${n.creators} ${n.creators === 1 ? "criador" : "criadores"} · ${fmtCompact(n.followers)} seguidores`}>
              <b>{NETWORK_LABEL[n.network]}</b>
              <span>{fmtCompact(n.estimated_reach)} de alcance</span>
            </li>
          ))}
        </ul>
      )}

      <p className="lst-foot">
        Estimativa de uma publicação por criador, pelo alcance médio recente de cada conta; quem está em mais de uma rede é contado em cada
        uma.
        {missing > 0
          ? ` ${missing} ${missing === 1 ? "criador está" : "criadores estão"} sem alcance medido e ficam fora da conta.`
          : ""}
      </p>
    </section>
  );
}
