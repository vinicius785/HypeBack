import { useMemo } from "react";

import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { Influencer, CampaignContent } from "@/shared/types";

/**
 * Bloco "Tarefas e aprovações pendentes" da campanha — versão filtrada e mais
 * detalhada da seção homônima da home (`screens/(private)/(app)/index.tsx`).
 *
 * Deriva tudo do que o dashboard JÁ carregou (`influencers` + `contents`),
 * portanto não dispara nenhuma request adicional. Cada grupo aprofunda em itens
 * (influenciador + contexto) e navega in-page para a aba correspondente quando
 * o usuário tem permissão para vê-la.
 */

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reels: "Reels",
  stories: "Stories",
  video: "Vídeo",
  live: "LIVE",
  shorts: "Shorts",
  image: "Imagem",
};

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Aguardando aprovação",
  in_correction: "Em correção",
  contract_pending: "Contrato pendente",
};

/** Normaliza variações (legado/pt) para o valor canônico de status. */
function normStatus(status: string | undefined): string {
  const k = (status ?? "").toLowerCase().trim();
  switch (k) {
    case "awaiting_approval":
    case "conteudo_submetido":
      return "pending_approval";
    case "conteudo_rejeitado":
      return "in_correction";
    default:
      return k;
  }
}

/** Conteúdo aguardando aprovação da marca. */
function isContentPending(status: string | undefined): boolean {
  const k = (status ?? "").toLowerCase().trim();
  return k === "pending" || k === "awaiting_approval" || k === "conteudo_submetido";
}

interface PendingItem {
  key: string;
  name: string;
  avatar: string | null;
  detail: string;
}

interface PendingGroup {
  kind: "content" | "script" | "participant";
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tab: string;
  items: PendingItem[];
}

interface CampaignPendingTasksProps {
  influencers: Influencer[];
  contents: CampaignContent[];
  /** Troca a aba ativa da campanha (in-page). */
  onNavigateTab?: (tab: string) => void;
  /** IDs das abas visíveis ao usuário (gating por permissão). */
  visibleTabIds?: string[];
}

/** Quantos itens detalhados mostrar antes do "ver todos". */
const PREVIEW_LIMIT = 4;

export function CampaignPendingTasks({
  influencers,
  contents,
  onNavigateTab,
  visibleTabIds,
}: CampaignPendingTasksProps) {
  const visibleSet = useMemo(
    () => new Set(visibleTabIds ?? []),
    [visibleTabIds],
  );

  const groups = useMemo<PendingGroup[]>(() => {
    // 1) Conteúdos aguardando aprovação (entidades de conteúdo).
    const contentItems: PendingItem[] = contents
      .filter((c) => isContentPending(c.status))
      .map((c) => ({
        key: `content-${c.id}`,
        name: c.influencerName || "Influenciador",
        avatar: c.influencerAvatar || null,
        detail: [
          c.socialNetwork ? getNetworkLabel(c.socialNetwork, c.socialNetwork) : null,
          CONTENT_TYPE_LABELS[c.contentType?.toLowerCase()] || c.contentType,
        ]
          .filter(Boolean)
          .join(" · "),
      }));

    // 2) Roteiros aguardando aprovação (participantes em script_pending).
    const scriptItems: PendingItem[] = influencers
      .filter((i) => normStatus(i.status) === "script_pending")
      .map((i) => {
        const net = i.social_networks?.[0]?.type;
        return {
          key: `script-${i.id}`,
          name: i.name || "Influenciador",
          avatar: i.avatar || null,
          detail: net ? getNetworkLabel(net, net) : "Roteiro enviado",
        };
      });

    // 3) Participantes aguardando ação da marca (aprovação/correção/contrato).
    //    Conteúdo e roteiro têm grupos próprios → ficam de fora aqui.
    const participantItems: PendingItem[] = influencers
      .filter((i) => {
        const s = normStatus(i.status);
        return (
          s === "pending_approval" ||
          s === "in_correction" ||
          s === "contract_pending"
        );
      })
      .map((i) => ({
        key: `participant-${i.id}`,
        name: i.name || "Influenciador",
        avatar: i.avatar || null,
        detail: PARTICIPANT_STATUS_LABELS[normStatus(i.status)] ?? "Ação pendente",
      }));

    return [
      {
        kind: "content" as const,
        label: "Conteúdos para aprovar",
        icon: "Image" as const,
        tab: "approval",
        items: contentItems,
      },
      {
        kind: "script" as const,
        label: "Roteiros para aprovar",
        icon: "FileText" as const,
        tab: "script-approval",
        items: scriptItems,
      },
      {
        kind: "participant" as const,
        label: "Participantes aguardando ação",
        icon: "Users" as const,
        tab: "management",
        items: participantItems,
      },
    ].filter((g) => g.items.length > 0);
  }, [contents, influencers]);

  const totalPending = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups],
  );

  return (
    <section className="bg-white rounded-[28px] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
            Tarefas e aprovações
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            {totalPending > 0
              ? `${totalPending} item(ns) desta campanha aguardando sua ação`
              : "Nada pendente nesta campanha agora"}
          </p>
        </div>
        {totalPending > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 tabular-nums">
            {totalPending}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl bg-neutral-50/80 border border-dashed border-neutral-200">
          <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm">
            <Icon name="CircleCheck" color="#22c55e" size={24} />
          </div>
          <p className="text-neutral-700 text-sm font-medium mt-4">Tudo em dia</p>
          <p className="text-neutral-500 text-xs mt-1 max-w-[260px]">
            Sem conteúdos, roteiros ou participantes aguardando aprovação nesta
            campanha.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const canOpen = visibleSet.has(group.tab) && !!onNavigateTab;
            const extra = group.items.length - PREVIEW_LIMIT;
            return (
              <div
                key={group.kind}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-neutral-50/40"
              >
                <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white border border-neutral-200/80 shadow-sm">
                    <Icon name={group.icon} color="#7c3aed" size={18} />
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-semibold text-neutral-950">
                    {group.label}
                  </p>
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-neutral-900 bg-white border border-neutral-200 px-2 py-0.5 rounded-lg">
                    {group.items.length}
                  </span>
                </div>

                <ul className="flex flex-col gap-1 px-3 pb-2">
                  {group.items.slice(0, PREVIEW_LIMIT).map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                    >
                      <UserAvatar
                        name={item.name}
                        src={item.avatar}
                        className="size-8 rounded-full"
                        textClassName="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => canOpen && onNavigateTab?.(group.tab)}
                  disabled={!canOpen}
                  className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
                  title={
                    canOpen
                      ? undefined
                      : "Você não tem permissão para abrir esta aba"
                  }
                >
                  <span>
                    {extra > 0 ? `Ver todos (+${extra})` : "Abrir aba"}
                  </span>
                  <Icon
                    name="ChevronRight"
                    size={16}
                    color={canOpen ? "var(--color-primary-600)" : "#a3a3a3"}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
