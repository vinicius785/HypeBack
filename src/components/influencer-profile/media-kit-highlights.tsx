import type { CampaignInfluencerProfileResponse } from "@/shared/services/influencer";

const compact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export interface MediaKitStat {
  label: string;
  value: string;
}

/** Números de destaque do mídia kit; o que não tem dado fica de fora. */
export function mediaKitStats(data: CampaignInfluencerProfileResponse): MediaKitStat[] {
  const inf = data.influencer;
  const stats: MediaKitStat[] = [];

  const fromNetworks = (inf.social_networks ?? []).reduce((s, sn) => s + (Number(sn.members) || 0), 0);
  const followers = Number(inf.followers) || fromNetworks;
  if (followers > 0) stats.push({ label: "Seguidores", value: compact(followers) });

  const engagement = Number(inf.engagement);
  if (engagement > 0) stats.push({ label: "Engajamento", value: `${engagement.toFixed(1).replace(".", ",")}%` });

  const campaigns = data.campaigns_participated_in_hypeapp ?? 0;
  if (campaigns > 0) stats.push({ label: "Campanhas na HypeApp", value: String(campaigns) });

  if (data.trust_index != null) stats.push({ label: "Audiência real", value: `${data.trust_index}%` });

  return stats;
}

export function MediaKitHighlights({ data }: { data: CampaignInfluencerProfileResponse }) {
  const stats = mediaKitStats(data);
  if (stats.length === 0) return null;
  return (
    <section
      aria-label="Números em destaque"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-neutral-200 sm:grid-cols-4 print:break-inside-avoid"
    >
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-white px-5 py-5">
          <b className="text-3xl font-semibold tracking-[-0.04em] text-neutral-950">{s.value}</b>
          <small className="text-xs font-medium text-neutral-500">{s.label}</small>
        </div>
      ))}
    </section>
  );
}
