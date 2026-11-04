import { Skeleton } from "@/components/ui/skeleton";
import type { InfluencerListReach, ReachNetworkKey } from "@/shared/services/influencer-lists";

const NETWORK_LABEL: Record<ReachNetworkKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const compact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

interface Props {
  data?: InfluencerListReach;
  isLoading?: boolean;
  isError?: boolean;
}

/** Projeção de alcance da lista: uma publicação por criador, com base no alcance médio recente de cada conta. */
export function ListReachSummary({ data, isLoading, isError }: Props) {
  if (isLoading) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (isError || !data) {
    return (
      <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500" role="status">
        Não foi possível calcular o alcance desta lista agora.
      </p>
    );
  }
  const missing = data.creators_total - data.creators_with_reach;
  const rate = data.followers_total > 0 ? (data.estimated_reach_total / data.followers_total) * 100 : 0;

  return (
    <section aria-label="Alcance estimado da lista" className="flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Alcance estimado" value={compact(data.estimated_reach_total)} strong />
        <Stat label="Seguidores somados" value={compact(data.followers_total)} />
        <Stat label="Alcance / seguidores" value={data.followers_total > 0 ? `${rate.toFixed(1).replace(".", ",")}%` : "—"} />
      </div>

      {data.by_network.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {data.by_network.map((n) => (
            <li key={n.network} className="flex items-center justify-between gap-3">
              <span className="font-medium text-neutral-900">
                {NETWORK_LABEL[n.network]}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  {n.creators} {n.creators === 1 ? "criador" : "criadores"}
                </span>
              </span>
              <span className="text-neutral-600">
                {compact(n.estimated_reach)} de alcance · {compact(n.followers)} seguidores
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-neutral-400">
        Estimativa de uma publicação por criador, pelo alcance médio recente de cada conta; quem está em mais de uma rede
        é contado em cada uma.
        {missing > 0
          ? ` ${missing} ${missing === 1 ? "criador está" : "criadores estão"} sem alcance medido e ficam fora da conta.`
          : ""}
      </p>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <small className="block text-xs text-neutral-500">{label}</small>
      <b className={strong ? "text-2xl tracking-tight text-neutral-950" : "text-xl tracking-tight text-neutral-900"}>{value}</b>
    </div>
  );
}
