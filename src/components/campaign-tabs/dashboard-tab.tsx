import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { CampaignFormData } from "@/shared/types";
import { getUploadUrl } from "@/lib/utils/api";
import { CheckIcon } from "../icons/CheckIcon";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { InfluencerEvaluationSection } from "./influencer-evaluation-section";
import { CampaignPendingTasks } from "./dashboard-pending-tasks";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import type { Influencer, CampaignContent } from "@/shared/types";

/** Skeleton do layout da aba Dashboard — espelha a estrutura real para transição suave */
export function DashboardTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Status da campanha */}
      <div className="bg-white rounded-[28px] p-5">
        <Skeleton className="h-8 w-64 mb-5" />
        <div className="flex flex-wrap items-stretch gap-8">
          <div className="flex flex-col items-center gap-3 shrink-0">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-1 flex-wrap gap-4 min-w-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 min-w-[140px] rounded-lg p-4 flex flex-col justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Duas colunas */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Coluna esquerda: Resumo */}
        <div className="flex-1 min-w-0 bg-white rounded-[28px] overflow-hidden">
          <Skeleton className="h-[278px] w-full rounded-none" />
          <div className="flex flex-wrap border-b border-neutral-200">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 min-w-[120px] border-r border-neutral-200 p-5 flex flex-col gap-3">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <div className="p-5 flex flex-col gap-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="p-5 flex flex-col gap-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="flex flex-col sm:flex-row p-4 gap-0">
            <div className="flex-1 min-w-0 p-4">
              <div className="rounded-lg p-4 flex flex-col gap-4">
                <Skeleton className="h-6 w-28" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Skeleton className="size-6 rounded shrink-0" />
                    <Skeleton className="h-4 flex-1 max-w-[200px]" />
                  </div>
                ))}
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex-1 min-w-0 p-4">
              <div className="rounded-lg p-4 flex flex-col gap-4">
                <Skeleton className="h-6 w-36" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Skeleton className="size-6 rounded shrink-0" />
                    <Skeleton className="h-4 flex-1 max-w-[180px]" />
                  </div>
                ))}
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita: Fases, Segmentação, Benefícios */}
        <div className="w-full lg:w-[min(100%,457px)] flex flex-col gap-4 shrink-0">
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="flex items-center justify-between p-5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="border-t border-neutral-200">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="size-4 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="p-5">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="border-t border-neutral-200">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4 border-b border-neutral-200 last:border-b-0">
                  <Skeleton className="size-10 rounded-full shrink-0" />
                  <div className="flex flex-col gap-2 min-w-0">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="p-5">
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="px-6 pb-4 pt-0 flex flex-wrap gap-2">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MAX_NICHES_VISIBLE = 3;

interface DashboardTabProps {
  campaignId: string;
  campaign: CampaignFormData;
  metrics: {
    reach: number;
    engagement: number;
    publishedContent: number;
    activeInfluencers: number;
  };
  progressPercentage: number;
  /** Nomes dos nichos raízes — vem direto da API, sem lookup. */
  nicheNames?: string[];
  /** Nomes dos subnichos (filhos) — vem direto da API, sem lookup. */
  subNicheNames?: string[];
  participants?: CampaignManagementParticipant[];
  /** Influenciadores do dashboard — usados para derivar pendências. */
  influencers?: Influencer[];
  /** Conteúdos do dashboard — usados para derivar aprovações pendentes. */
  contents?: CampaignContent[];
  /** Troca a aba ativa da campanha (navegação in-page das pendências). */
  onNavigateTab?: (tab: string) => void;
  /** IDs das abas visíveis (gating de navegação das pendências por permissão). */
  visibleTabIds?: string[];
}


const contentTypeLabels: { [key: string]: string } = {
  post: "Post",
  reels: "Reels",
  stories: "Stories",
  video: "Vídeo",
  live: "LIVE",
  shorts: "Shorts",
  image: "Imagem",
};

function ProgressCircle({ percentage }: { percentage: number }) {
  const size = 80;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-neutral-200, #E5E5E5)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary-500, #9e2cfa)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-base font-bold text-neutral-950">
        {Math.min(100, Math.max(0, percentage))}%
      </span>
    </div>
  );
}

/** publish_date (YYYY-MM-DD): dia de calendário local — evita new Date("2026-03-26") virar 25/03 no BR (UTC). */
function timestampFromPublishDate(dateStr: string): number {
  const ymd = dateStr.trim().split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d).getTime();
}

/** Data a partir de `publish_date` / postDate (YYYY-MM-DD). */
function formatPhasePublishDatePtBr(
  dateStr: string | undefined | null,
  style: "short" | "long"
): string {
  if (!dateStr?.trim()) return "-";
  const t = timestampFromPublishDate(dateStr);
  if (!Number.isFinite(t)) return "-";
  return new Date(t).toLocaleDateString(
    "pt-BR",
    style === "long"
      ? { day: "2-digit", month: "long", year: "numeric" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }
  );
}

/** `publish_time` da API (`HH:MM` ou `HH:MM:SS`) → exibição HH:MM */
function formatPhasePublishTimePtBr(timeStr: string | undefined | null): string {
  if (timeStr == null) return "";
  const t = String(timeStr).trim();
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return t;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Data local do instante de criação (created_at ISO). */
function timestampFromPhaseCreatedAt(iso: string): number {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return NaN;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

export function DashboardTab({ campaignId, campaign, metrics, progressPercentage, nicheNames: nicheNamesProp, subNicheNames: subNicheNamesProp, participants = [], influencers = [], contents = [], onNavigateTab, visibleTabIds }: DashboardTabProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [nicheModalOpen, setNicheModalOpen] = useState(false);
  const [subNicheModalOpen, setSubNicheModalOpen] = useState(false);

  const nicheNames = nicheNamesProp ?? (campaign.primaryNicheName?.trim() ? [campaign.primaryNicheName.trim()] : []);
  const subNicheNames = subNicheNamesProp ?? [];

  const periodLabel = useMemo(() => {
    if (!campaign.phases?.length) return "-";
    const withOrder = campaign.phases.map((p, i) => ({
      phase: p,
      ord:
        typeof p.order === "number" && !Number.isNaN(p.order)
          ? p.order
          : i + 1,
    }));
    const first = withOrder.reduce((a, b) => (a.ord <= b.ord ? a : b)).phase;
    const last = withOrder.reduce((a, b) => (a.ord >= b.ord ? a : b)).phase;

    const startMs = first.createdAt
      ? timestampFromPhaseCreatedAt(first.createdAt)
      : timestampFromPublishDate(first.postDate || "");
    const endMs = timestampFromPublishDate(last.postDate || "");

    if (!Number.isFinite(startMs) && !Number.isFinite(endMs)) return "-";
    const fmt = (t: number) =>
      new Date(t).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return `${fmt(startMs)} — ${fmt(endMs)}`;
    }
    if (Number.isFinite(startMs)) return fmt(startMs);
    return fmt(endMs);
  }, [campaign.phases]);

  const remunerationLabel = useMemo(() => {
    if (campaign.paymentType === "fixed" || campaign.paymentType === "fixed_value") return "Por conteúdo publicado";
    if (campaign.paymentType === "price") return "Valor do influenciador";
    if (campaign.paymentType === "swap") return "Permuta";
    if (campaign.paymentType === "cpa") return "CPA";
    if (campaign.paymentType === "cpm") return "CPM";
    return "-";
  }, [campaign.paymentType]);

  /**
   * Valor monetário exibido abaixo do label de remuneração, quando aplicável.
   * - "fixed"/"fixed_value": "R$ X por conteúdo"
   * - "swap": "Valor de mercado: R$ X" (quando informado)
   * - "cpa": "R$ X por ação"
   * - "cpm": "R$ X por mil"
   * - "price"/sem valor: null (varia por influenciador / não monetário)
   */
  const remunerationValue = useMemo<string | null>(() => {
    if (campaign.paymentType === "fixed" || campaign.paymentType === "fixed_value") {
      return campaign.paymentFixedAmount ? `R$ ${campaign.paymentFixedAmount} por conteúdo` : null;
    }
    if (campaign.paymentType === "swap") {
      return campaign.paymentSwapMarketValue ? `Valor de mercado: R$ ${campaign.paymentSwapMarketValue}` : null;
    }
    if (campaign.paymentType === "cpa") {
      return campaign.paymentCpaValue ? `R$ ${campaign.paymentCpaValue} por ação` : null;
    }
    if (campaign.paymentType === "cpm") {
      return campaign.paymentCpmValue ? `R$ ${campaign.paymentCpmValue} por mil` : null;
    }
    return null;
  }, [
    campaign.paymentType,
    campaign.paymentFixedAmount,
    campaign.paymentSwapMarketValue,
    campaign.paymentCpaValue,
    campaign.paymentCpmValue,
  ]);

  const locationLabel = useMemo(() => {
    if (campaign.state && campaign.city) return `${campaign.city}, ${campaign.state}`;
    if (campaign.state) return campaign.state;
    if (campaign.city) return campaign.city;
    return "Brasil (Geral)";
  }, [campaign.state, campaign.city]);

  const genderLabel = useMemo(() => {
    if (campaign.gender === "male") return "Masculino";
    if (campaign.gender === "female") return "Feminino";
    if (campaign.gender === "all") return "Todos";
    return campaign.gender || "Todos";
  }, [campaign.gender]);

  const followersLabel = useMemo(() => {
    const n = parseInt(campaign.minFollowers || "0", 10);
    if (!n) return "-";
    if (n >= 1000) return `${n / 1000}k+ seguidores`;
    return `${n.toLocaleString("pt-BR")} seguidores`;
  }, [campaign.minFollowers]);

  const whatToDoList = Array.isArray(campaign.whatToDo) ? campaign.whatToDo.filter((i) => i.trim() !== "") : [];
  const whatNotToDoList = Array.isArray(campaign.whatNotToDo) ? campaign.whatNotToDo.filter((i) => i.trim() !== "") : [];
  const benefitsList = Array.isArray(campaign.benefits) ? campaign.benefits.filter((i) => i.trim() !== "") : [];

  const togglePhase = (phaseId: string) => {
    const next = new Set(expandedPhases);
    if (next.has(phaseId)) next.delete(phaseId);
    else next.add(phaseId);
    setExpandedPhases(next);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Status da campanha — círculo de progresso + 4 cards (Figma) */}
      <div className="bg-white rounded-[28px] p-5">
        <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950 mb-5">
          Status da campanha
        </h3>
        <div className="flex flex-wrap items-stretch gap-8">
          <div className="flex flex-col items-center gap-3 shrink-0">
            <ProgressCircle percentage={progressPercentage} />
            <span className="text-base text-neutral-950">Progresso</span>
          </div>
          <div className="flex flex-1 flex-wrap gap-4 min-w-0">
            <div className="flex-1 min-w-[140px] bg-canvas rounded-[22px] p-4 flex flex-col justify-between">
              <p className="text-base font-medium text-neutral-500">Influenciadores</p>
              <p className="text-2xl font-bold text-neutral-950">{metrics.activeInfluencers}</p>
            </div>
            <div className="flex-1 min-w-[140px] bg-canvas rounded-[22px] p-4 flex flex-col justify-between">
              <p className="text-base font-medium text-neutral-500">Conteúdos publicados</p>
              <p className="text-2xl font-bold text-neutral-950">{metrics.publishedContent}</p>
            </div>
            <div className="flex-1 min-w-[140px] bg-canvas rounded-[22px] p-4 flex flex-col justify-between">
              <p className="text-base font-medium text-neutral-500">Alcance total</p>
              <p className="text-2xl font-bold text-neutral-950">{metrics.reach.toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex-1 min-w-[140px] bg-canvas rounded-[22px] p-4 flex flex-col justify-between">
              <p className="text-base font-medium text-neutral-500">Engajamento</p>
              <p className="text-2xl font-bold text-neutral-950">{metrics.engagement.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarefas e aprovações pendentes — filtrado a esta campanha */}
      <CampaignPendingTasks
        influencers={influencers}
        contents={contents}
        onNavigateTab={onNavigateTab}
        visibleTabIds={visibleTabIds}
      />

      {/* Duas colunas: Resumo (esquerda) | Fases + Segmentação + Benefícios (direita) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Coluna esquerda: Resumo da campanha */}
        <div className="flex-1 min-w-0 bg-white rounded-[28px] overflow-hidden">
          {/* Imagem com overlay "Resumo da campanha" */}
          {campaign.banner && (
            <div className="relative h-[278px] w-full overflow-hidden">
              <img
                src={getUploadUrl(campaign.banner) || ""}
                alt="Resumo da campanha"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
              <p className="absolute left-5 bottom-4 text-xl font-semibold text-white">
                Resumo da campanha
              </p>
            </div>
          )}
          <div className="flex flex-wrap">
            <div className="flex-1 min-w-[120px] border-r border-[#E5E5E5] p-5 flex flex-col gap-3">
              <p className="text-sm text-neutral-500">Nicho</p>
              {nicheNames.length === 0 ? (
                <p className="text-base font-medium text-neutral-950">-</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {nicheNames.slice(0, MAX_NICHES_VISIBLE).map((name, i) => (
                    <p key={i} className="text-base font-medium text-neutral-950 leading-snug">{name}</p>
                  ))}
                  {nicheNames.length > MAX_NICHES_VISIBLE && (
                    <button type="button" onClick={() => setNicheModalOpen(true)} className="text-sm font-medium text-primary-600 underline text-left mt-1">
                      ver mais ({nicheNames.length})
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[120px] border-r border-[#E5E5E5] px-4 py-5 flex flex-col gap-3">
              <p className="text-sm text-neutral-500">Sub-Nicho</p>
              {subNicheNames.length === 0 ? (
                <p className="text-base font-medium text-neutral-950">-</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {subNicheNames.slice(0, MAX_NICHES_VISIBLE).map((name, i) => (
                    <p key={i} className="text-base font-medium text-neutral-950 leading-snug">{name}</p>
                  ))}
                  {subNicheNames.length > MAX_NICHES_VISIBLE && (
                    <button type="button" onClick={() => setSubNicheModalOpen(true)} className="text-sm font-medium text-primary-600 underline text-left mt-1">
                      ver mais ({subNicheNames.length})
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[120px] border-r border-[#E5E5E5] px-4 py-5 flex flex-col gap-3">
              <p className="text-sm text-neutral-500">Período</p>
              <p className="text-base font-medium text-neutral-950">{periodLabel}</p>
            </div>
            <div className="flex-1 min-w-[120px] pl-4 pr-5 py-5 flex flex-col gap-3">
              <p className="text-sm text-neutral-500">Remuneração</p>
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-medium text-neutral-950">{remunerationLabel}</p>
                {remunerationValue && (
                  <p className="text-sm text-neutral-600 tabular-nums">{remunerationValue}</p>
                )}
              </div>
            </div>
          </div>

          {nicheModalOpen && (
            <Modal title="Todos os nichos" onClose={() => setNicheModalOpen(false)} panelClassName="max-w-md">
              <ul className="flex flex-col gap-2">
                {nicheNames.map((name, i) => (
                  <li key={i} className="text-base text-neutral-950 py-1 border-b border-neutral-100 last:border-b-0">{name}</li>
                ))}
              </ul>
            </Modal>
          )}
          {subNicheModalOpen && (
            <Modal title="Todos os subnichos" onClose={() => setSubNicheModalOpen(false)} panelClassName="max-w-md">
              <ul className="flex flex-col gap-2">
                {subNicheNames.map((name, i) => (
                  <li key={i} className="text-base text-neutral-950 py-1 border-b border-neutral-100 last:border-b-0">{name}</li>
                ))}
              </ul>
            </Modal>
          )}
          {/* Descrição */}
          <div className="p-5 flex flex-col">
            <p className="text-lg font-semibold text-neutral-950">Descrição</p>
            <p className="text-base text-neutral-500">{campaign.description || "-"}</p>
          </div>
          {/* Objetivo geral */}
          <div className="p-5 flex flex-col">
            <p className="text-lg font-semibold text-neutral-950">Objetivo geral</p>
            <p className="text-base text-neutral-500">{campaign.generalObjective || "-"}</p>
          </div>
          {/* O que fazer | O que não fazer — lado a lado (Figma) */}
          <div className="flex flex-col sm:flex-row gap-0">
            <div className="flex-1 min-w-0 p-4">
              <div className="bg-success-50 rounded-lg p-4 flex flex-col gap-4">
                <p className="text-lg font-semibold text-neutral-950">O que fazer</p>
                <ul className="flex flex-col gap-3">
                  {whatToDoList.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex gap-1 items-center">
                      <CheckIcon className="shrink-0" />
                      <span className="text-base text-neutral-950">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex-1 min-w-0 p-4">
              <div className="bg-danger-50 rounded-lg p-4 flex flex-col gap-4">
                <p className="text-lg font-semibold text-neutral-950">O que não fazer</p>
                <ul className="flex flex-col gap-3">
                  {whatNotToDoList.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex gap-1 items-center">
                      <Icon name="X" size={24} color="#dc2626" className="shrink-0" />
                      <span className="text-base text-neutral-950">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[min(100%,457px)] flex flex-col gap-4 shrink-0">
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="flex items-center justify-between p-5">
              <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Fases da campanha</h3>
            </div>
            {campaign.phases && campaign.phases.length > 0 ? (
              <div className="border-t border-[#E5E5E5]">
                {campaign.phases.slice(0, 5).map((phase, index) => {
                  const isExpanded = expandedPhases.has(phase.id);
                  const timeLabel = formatPhasePublishTimePtBr(phase.postTime);
                  return (
                    <div key={phase.id} className="border-b border-[#E5E5E5] last:border-b-0">
                      <button
                        type="button"
                        onClick={() => togglePhase(phase.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            text={`Fase ${index + 1}`}
                            backgroundColor="bg-primary-100"
                            textColor="text-primary-900"
                          />
                          <span className="text-base text-neutral-500">
                            {formatPhasePublishDatePtBr(phase.postDate, "short")}
                            {timeLabel ? ` · ${timeLabel}` : ""}
                          </span>
                        </div>
                        <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} color="#404040" />
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-0 border-t border-neutral-100 bg-neutral-50/50">
                          <div className="flex flex-col gap-4 pt-2">
                            <div>
                              <p className="text-sm text-neutral-500 mb-1">Objetivo</p>
                              <Badge
                                text={phase.objective === "engagement" ? "Engajamento" : phase.objective === "conversion" ? "Conversão" : phase.objective}
                                backgroundColor="bg-primary-50"
                                textColor="text-primary-900"
                              />
                            </div>
                            <div>
                              <p className="text-sm text-neutral-500 mb-1">Data e horário da postagem</p>
                              <p className="text-base text-neutral-950">
                                {formatPhasePublishDatePtBr(phase.postDate, "long")}
                                {timeLabel ? ` às ${timeLabel}` : ""}
                              </p>
                            </div>
                            {phase.formats && phase.formats.length > 0 && (
                              <div>
                                <p className="text-sm text-neutral-500 mb-2">Formatos de conteúdo</p>
                                <div className="flex flex-col gap-2">
                                  {phase.formats.map((format) => (
                                    <div key={format.id} className="p-3 bg-white rounded-xl border border-[#E5E5E5] flex justify-between items-center">
                                      <div>
                                        <p className="text-sm font-medium text-neutral-950">
                                          {getNetworkLabel(format.socialNetwork, format.socialNetwork)}
                                        </p>
                                        <p className="text-xs text-neutral-600">
                                          {contentTypeLabels[format.contentType] || format.contentType}
                                        </p>
                                      </div>
                                      <Badge text={`${format.quantity}x`} backgroundColor="bg-tertiary-50" textColor="text-tertiary-900" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-neutral-500 border-t border-[#E5E5E5]">
                Nenhuma fase cadastrada para esta campanha
              </div>
            )}
          </div>

          {/* Segmentação */}
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="p-5">
              <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Segmentação</h3>
            </div>
            <div className="border-t border-[#E5E5E5]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5E5E5]">
                <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Icon name="MapPin" size={24} color="#404040" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">Localização</p>
                  <p className="text-base font-semibold text-neutral-950">{locationLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5E5E5]">
                <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Icon name="Calendar" size={24} color="#404040" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">Idade</p>
                  <p className="text-base font-semibold text-neutral-950">Não informado</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5E5E5]">
                <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Icon name="Users" size={24} color="#404040" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">Gênero</p>
                  <p className="text-base font-semibold text-neutral-950">{genderLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-5">
                <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Icon name="Users" size={24} color="#404040" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-500">Seguidores</p>
                  <p className="text-base font-semibold text-neutral-950">{followersLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefícios */}
          <div className="bg-white rounded-[28px] overflow-hidden">
            <div className="p-5">
              <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Benefícios</h3>
            </div>
            <div className="px-6 pb-4 pt-0 flex flex-wrap gap-2">
              {benefitsList.length > 0 ? (
                benefitsList.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-3 py-2 rounded-xl bg-primary-100 text-primary-900 text-base"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-sm text-neutral-500">Nenhum benefício informado</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <InfluencerEvaluationSection campaignId={campaignId} participants={participants} />
    </div>
  );
}
