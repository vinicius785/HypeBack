import { useMemo } from "react";

import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCampaignManagement } from "@/hooks/use-campaign-management";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import { PriceNegotiationSection } from "./shared/price-negotiation-section";

/**
 * Aba "Propostas e contrapropostas" — só existe em campanhas de **valor
 * individual por criador** (`individual_price`). Centraliza as negociações de
 * valor 1-a-1: a marca vê onde está a bola (ação da marca vs aguardando o
 * criador) e responde (aceitar / contrapropor / recusar) sem entrar no kanban.
 *
 * Dados: `useCampaignManagement` (mesma query do Gerenciamento, que hidrata
 * `price_negotiation`). Cada card reaproveita `PriceNegotiationSection`, o SSOT
 * das ações de resposta — a contraproposta invalida o cache e o card atualiza.
 */

interface ProposalsTabProps {
  campaignId: string;
}

/** Grupo da negociação conforme "de quem é a vez". */
export type Bucket = "action" | "waiting" | "closed";

export function bucketOf(p: CampaignManagementParticipant): Bucket {
  const status = p.status;
  const priceStatus = p.price_negotiation?.price_status;
  if (status === "price_countered" || priceStatus === "countered") return "action";
  if (status === "price_proposed" || priceStatus === "proposed") return "waiting";
  return "closed"; // accepted / rejected
}

const BUCKET_META: Record<
  Bucket,
  { label: string; hint: string; icon: Parameters<typeof Icon>[0]["name"] }
> = {
  action: {
    label: "Aguardando sua ação",
    hint: "O criador contrapropôs — aceite, recontraproponha ou recuse.",
    icon: "BellRing",
  },
  waiting: {
    label: "Aguardando o criador",
    hint: "Proposta enviada; aguardando o criador aceitar ou contrapropor.",
    icon: "Clock",
  },
  closed: {
    label: "Finalizadas",
    hint: "Negociações aceitas ou recusadas.",
    icon: "CircleCheck",
  },
};

const BUCKET_ORDER: Bucket[] = ["action", "waiting", "closed"];

function priceStatusBadge(
  p: CampaignManagementParticipant,
): { text: string; bg: string; textColor: string } {
  const ps = p.price_negotiation?.price_status;
  switch (ps) {
    case "countered":
      return { text: "Contraproposta recebida", bg: "bg-primary-100", textColor: "text-primary-800" };
    case "proposed":
      return { text: "Proposta enviada", bg: "bg-amber-100", textColor: "text-amber-900" };
    case "accepted":
      return { text: "Valor fechado", bg: "bg-success-100", textColor: "text-success-800" };
    case "rejected":
      return { text: "Recusada", bg: "bg-danger-100", textColor: "text-danger-800" };
    default:
      return { text: "Em negociação", bg: "bg-neutral-100", textColor: "text-neutral-700" };
  }
}

export function ProposalsTab({ campaignId }: ProposalsTabProps) {
  const { data, isLoading } = useCampaignManagement(campaignId);

  const buckets = useMemo(() => {
    const grouped: Record<Bucket, CampaignManagementParticipant[]> = {
      action: [],
      waiting: [],
      closed: [],
    };
    for (const p of data?.participants ?? []) {
      // Só participantes com negociação de valor individual.
      if (!p.price_negotiation) continue;
      grouped[bucketOf(p)].push(p);
    }
    return grouped;
  }, [data]);

  const total = buckets.action.length + buckets.waiting.length + buckets.closed.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              Propostas e contrapropostas
            </h3>
            <p className="text-sm text-neutral-500 mt-1">
              {total > 0
                ? `${total} negociação(ões) de valor individual por criador`
                : "Nenhuma proposta em negociação nesta campanha."}
            </p>
          </div>
          {buckets.action.length > 0 && (
            <span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800 tabular-nums">
              {buckets.action.length} aguardando você
            </span>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-neutral-50/80 border border-dashed border-neutral-200">
          <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm">
            <Icon name="Handshake" color="#7c3aed" size={24} />
          </div>
          <p className="text-neutral-700 text-sm font-medium mt-4">
            Sem negociações em aberto
          </p>
          <p className="text-neutral-500 text-xs mt-1 max-w-[320px]">
            As propostas aparecem aqui ao convidar ou pré-selecionar criadores com
            um valor proposto.
          </p>
        </div>
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const list = buckets[bucket];
          if (list.length === 0) return null;
          const meta = BUCKET_META[bucket];
          return (
            <section key={bucket} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon name={meta.icon} color="#525252" size={18} />
                <h4 className="text-sm font-semibold text-neutral-800">
                  {meta.label}
                </h4>
                <span className="tabular-nums text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-lg">
                  {list.length}
                </span>
                <span className="text-xs text-neutral-400 hidden sm:inline">
                  · {meta.hint}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {list.map((p) => {
                  const network = p.social_networks?.[0]?.type;
                  const badge = priceStatusBadge(p);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-3 rounded-[28px] bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={p.name}
                          src={p.avatar}
                          className="size-11 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-neutral-950">
                            {p.name || "Influenciador"}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {network ? getNetworkLabel(network, network) : "—"}
                            {p.username ? ` · @${p.username}` : ""}
                          </p>
                        </div>
                        <Badge
                          text={badge.text}
                          backgroundColor={badge.bg}
                          textColor={badge.textColor}
                        />
                      </div>

                      <PriceNegotiationSection
                        campaignId={campaignId}
                        userId={p.user_id}
                        status={p.status}
                        negotiation={p.price_negotiation}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
