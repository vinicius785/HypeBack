import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import type { Influencer } from "@/shared/types";
import { useCampaignCuration } from "@/hooks/use-campaign-tab-influencers";
import { useBulkInfluencerActions } from "@/hooks/use-bulk-influencer-actions";
import { useUpdateInfluencerStatus } from "@/hooks/use-campaign-influencers";
import { useNiches } from "@/hooks/use-niches";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useWorkspaceBalance } from "@/hooks/use-balance";

import { resolveNicheDisplayName, splitNicheNames } from "@/shared/utils/niche-display";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { SocialNetworkIcon } from "@/components/social-network-icon";
import { InfluencerProfileCard } from "./shared/influencer-profile-card";
import { RejectionModal } from "./shared/rejection-modal";
import { ReserveBalanceModal } from "./shared/reserve-balance-modal";
import { BulkActionModal } from "./shared/bulk-action-modal";
import { ApprovalCostBadge } from "./shared/approval-cost-badge";
import {
  computeApprovalCostCents,
  fmtBRL,
  type CampaignPhaseForCost,
} from "./shared/prices-utils";
import { Skeleton } from "@/components/ui/skeleton";

const SHOW_APPROVAL_COST_METHODS = new Set(["fixed", "fixed_value", "price"]);

/** Skeleton da aba Curadoria — espelha o layout real */
export function CurationTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="bg-white rounded-[28px] p-4">
        <div className="flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 min-w-[140px] flex flex-col gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Skeleton className="h-6 w-52" />
          <div className="flex gap-1">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-24 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-44 rounded-full" />
            <Skeleton className="h-11 w-48 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-canvas rounded-[22px] p-4 flex flex-col gap-4">
              <div className="flex justify-between">
                <Skeleton className="size-[60px] rounded-2xl shrink-0" />
                <Skeleton className="size-10 rounded-lg shrink-0" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="flex-1 h-16 rounded-lg" />
                <Skeleton className="flex-1 h-16 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="flex-1 h-11 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type CurationProfileStatus = "curation" | "approved" | "rejected";
type CurationColumnKey = "pending" | "approved" | "rejected";

interface ApplicationWithProfile {
  influencerId: string;
  campaignUserId: string;
  influencerName: string;
  influencerUsername: string;
  influencerAvatar: string;
  influencerFollowers: number;
  influencerEngagement: number;
  influencerNiche: string;
  influencerNicheName?: string;
  profileId: string;
  profileType: string;
  profileTypeLabel: string;
  profileUsername: string;
  profileFollowers: number;
  profileKey: string;
  profileStatus: CurationProfileStatus;
  updatedAt?: string | null;
  isExternal?: boolean;
  /** Preços do influenciador para esse perfil (centavos BRL), quando disponíveis. */
  prices?: Record<string, number>;
}

function profileMatchesCurationColumn(
  profileStatus: string | undefined,
  column: CurationColumnKey
): boolean {
  const s = profileStatus?.toLowerCase()?.trim() ?? "";
  if (column === "pending") return s === "curation" || s === "pre_selection_curation";
  if (column === "approved") return s === "approved";
  if (column === "rejected") return s === "rejected";
  return false;
}

function expandCurationProfiles(
  influencers: Influencer[],
  column: CurationColumnKey
): ApplicationWithProfile[] {
  const applications: ApplicationWithProfile[] = [];
  const statusMap: Record<string, CurationProfileStatus> = {
    curation: "curation",
    pre_selection_curation: "curation",
    approved: "approved",
    rejected: "rejected",
  };

  const cardAvatar = (profilePhoto: string | null | undefined, inf: Influencer) => {
    const fromPhoto =
      typeof profilePhoto === "string" && profilePhoto.trim() !== ""
        ? profilePhoto.trim()
        : "";
    return fromPhoto || inf.avatar || "";
  };

  influencers.forEach((inf) => {
    const profiles = inf.social_networks || [];
    const relevantProfiles = profiles.filter((profile) =>
      profileMatchesCurationColumn(profile.status, column)
    );

    if (relevantProfiles.length === 0) {
      const infStatus = inf.status?.toLowerCase()?.trim();
      const baseCard = {
        influencerId: inf.id,
        campaignUserId: inf.campaign_user_id ?? "",
        influencerName: inf.name,
        influencerUsername: inf.username,
        influencerAvatar: inf.avatar,
        influencerFollowers: inf.followers,
        influencerEngagement: inf.engagement,
        influencerNiche: inf.niche || "",
        influencerNicheName: inf.nicheName,
        profileId: "",
        profileType: "",
        profileTypeLabel: "Geral",
        profileUsername: inf.username,
        profileFollowers: inf.followers,
        profileKey: `${inf.campaign_user_id ?? inf.id}-general`,
        updatedAt: inf.updated_at,
        isExternal: inf.is_external,
      };

      if (column === "pending" && (infStatus === "curation" || infStatus === "pre_selection_curation") && profiles.length === 0) {
        applications.push({ ...baseCard, profileStatus: "curation" });
      } else if (column === "approved" && infStatus === "approved" && profiles.length === 0) {
        applications.push({ ...baseCard, profileStatus: "approved" });
      } else if (column === "rejected" && infStatus === "rejected" && profiles.length === 0) {
        applications.push({ ...baseCard, profileStatus: "rejected" });
      }
      return;
    }

    relevantProfiles.forEach((profile) => {
      const s = profile.status?.toLowerCase()?.trim();
      const profileStatus: CurationProfileStatus = statusMap[s ?? ""] ?? "curation";
      const members =
        profile.members != null && !Number.isNaN(Number(profile.members))
          ? Number(profile.members)
          : inf.followers;
      applications.push({
        influencerId: inf.id,
        campaignUserId: inf.campaign_user_id ?? "",
        influencerName: inf.name,
        influencerUsername: inf.username,
        influencerAvatar: cardAvatar(profile.photo, inf),
        influencerFollowers: members,
        influencerEngagement: inf.engagement,
        influencerNiche: inf.niche || "",
        influencerNicheName: inf.nicheName,
        profileId: String(profile.id),
        profileType: profile.type,
        profileTypeLabel: getNetworkLabel(profile.type, profile.name || profile.type),
        profileUsername: (profile.username ?? "").trim() || inf.username,
        profileFollowers: members,
        profileKey: `${inf.campaign_user_id ?? inf.id}-${profile.id}`,
        profileStatus,
        updatedAt: inf.updated_at,
        isExternal: inf.is_external,
        prices: profile.prices,
      });
    });
  });

  return applications;
}

interface CurationTabProps {
  focusCampaignUserId?: string | null;
  onFocusUserConsumed?: () => void;
  /** payment_method da campanha — controla exibição do custo de aprovação */
  paymentType?: string | null;
  /** Phases da campanha (formats + prices) — necessário para calcular custo local. */
  phasesWithFormats?: ReadonlyArray<CampaignPhaseForCost>;
}

export function CurationTab({
  focusCampaignUserId = null,
  onFocusUserConsumed,
  paymentType,
  phasesWithFormats = [],
}: CurationTabProps) {
  const showApprovalCost =
    !!paymentType && SHOW_APPROVAL_COST_METHODS.has(paymentType);

  // Saldo real (BRL) do workspace — fonte de verdade para gating.
  const balanceQ = useWorkspaceBalance();
  const availableCents = balanceQ.data?.available_cents ?? null;
  const committedCents = balanceQ.data?.committed_cents ?? null;
  const navigate = useNavigate();
  const { campaignId } = useParams({
    from: "/(private)/(app)/campaigns/$campaignId",
  });
  const { data: niches = [] } = useNiches();

  // Modal de reprovação individual
  const [rejectTarget, setRejectTarget] = useState<Influencer | null>(null);

  // Modal de confirmação de reserva de saldo (aprovação com custo)
  const [reserveTarget, setReserveTarget] = useState<ApplicationWithProfile | null>(null);

  // Modal de perfil (redes sociais)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedProfileInfluencer, setSelectedProfileInfluencer] = useState<Influencer | null>(null);

  // Modal de ação em massa
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | null>(null);
  const [bulkRejectionFeedback, setBulkRejectionFeedback] = useState("");

  // Filtro de status: Pendentes | Aprovados | Reprovados
  const [statusFilter, setStatusFilter] = useState<CurationColumnKey>("pending");
  // Colunas já visitadas — queries só são habilitadas na primeira visita
  const [seenColumns, setSeenColumns] = useState<Set<CurationColumnKey>>(
    () => new Set<CurationColumnKey>(["pending"]),
  );

  const markColumnSeen = useCallback(
    (col: CurationColumnKey) => {
      setStatusFilter(col);
      setSeenColumns((prev) => {
        if (prev.has(col)) return prev;
        const next = new Set(prev);
        next.add(col);
        return next;
      });
    },
    [],
  );

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [filterNiche, setFilterNiche] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAge, setFilterAge] = useState("");

  const {
    approve: bulkApprove,
    reject: bulkReject,
    isApproving,
    isRejecting,
  } = useBulkInfluencerActions({ campaignId });
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateInfluencerStatus(campaignId);

  // Quando há um focusCampaignUserId precisamos buscar todas as colunas para encontrar o usuário
  const enableAll = !!focusCampaignUserId;
  const qPending = useCampaignCuration(campaignId, "pending", { enabled: enableAll || seenColumns.has("pending") });
  const qApproved = useCampaignCuration(campaignId, "approved", { enabled: enableAll || seenColumns.has("approved") });
  const qRejected = useCampaignCuration(campaignId, "rejected", { enabled: enableAll || seenColumns.has("rejected") });

  const pendingInfluencers = qPending.data ?? [];
  const approvedInfluencers = qApproved.data ?? [];
  const rejectedInfluencers = qRejected.data ?? [];

  const pendingCards = useMemo(() => expandCurationProfiles(pendingInfluencers, "pending"), [pendingInfluencers]);
  const approvedCards = useMemo(() => expandCurationProfiles(approvedInfluencers, "approved"), [approvedInfluencers]);
  const rejectedCards = useMemo(() => expandCurationProfiles(rejectedInfluencers, "rejected"), [rejectedInfluencers]);

  // Loading/error relativos à coluna ativa (outras colunas carregam em background)
  const activeQuery = statusFilter === "pending" ? qPending : statusFilter === "approved" ? qApproved : qRejected;
  const tabLoading = activeQuery.isLoading;
  const tabError = activeQuery.isError;
  const tabErrorMessage =
    (activeQuery.error as Error)?.message ||
    "Não foi possível carregar a curadoria.";

  const allCurationCards = useMemo(
    () => [...pendingCards, ...approvedCards, ...rejectedCards],
    [pendingCards, approvedCards, rejectedCards]
  );

  // A API devolve todos os nichos do criador num rótulo único
  // ("Moda, Beleza, Skincare"): principal primeiro, sub-nichos depois.
  const nicheNamesForApp = useCallback(
    (app: ApplicationWithProfile) =>
      splitNicheNames(
        resolveNicheDisplayName(app.influencerNiche, niches, app.influencerNicheName)
      ),
    [niches]
  );

  const filteredApplications = useMemo(() => {
    const base =
      statusFilter === "pending" ? pendingCards : statusFilter === "approved" ? approvedCards : rejectedCards;
    return base.filter((app) => {
      if (debouncedSearch) {
        const lower = debouncedSearch.toLowerCase();
        const matches =
          app.influencerName.toLowerCase().includes(lower) ||
          app.influencerUsername.toLowerCase().includes(lower) ||
          app.profileUsername.toLowerCase().includes(lower);
        if (!matches) return false;
      }
      if (filterNiche && !nicheNamesForApp(app).includes(filterNiche)) return false;
      return true;
    });
  }, [statusFilter, pendingCards, approvedCards, rejectedCards, debouncedSearch, filterNiche, nicheNamesForApp]);

  const filteredKeys = useMemo(
    () => filteredApplications.map((app) => app.profileKey),
    [filteredApplications]
  );

  const { selected: selectedInfluencers, toggle: handleSelectApplication, toggleAll: handleSelectAll, clear: clearSelection, isAllSelected } =
    useBulkSelection(filteredKeys);

  // Limpa seleção ao trocar o filtro de status
  useEffect(() => {
    clearSelection();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Custo de aprovação por card (centavos BRL) — só para a coluna "pending"
  // em modalidades monetárias. Cálculo local, sem chamadas blockchain.
  const costByProfileKey = useMemo<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    if (!showApprovalCost || !paymentType) return map;
    for (const app of pendingCards) {
      const cents = computeApprovalCostCents(
        paymentType,
        app.profileType,
        app.prices,
        phasesWithFormats,
      );
      map.set(app.profileKey, cents);
    }
    return map;
  }, [showApprovalCost, paymentType, pendingCards, phasesWithFormats]);

  const nicheOptions = useMemo(() => {
    const uniqueNiches = new Set<string>();
    allCurationCards.forEach((app) => {
      nicheNamesForApp(app).forEach((name) => uniqueNiches.add(name));
    });
    return Array.from(uniqueNiches)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((name) => ({ value: name, label: name }));
  }, [allCurationCards, nicheNamesForApp]);

  // Focus handling (abre modal de perfil automaticamente via prop)
  const focusHandledRef = useRef<string | null>(null);
  useEffect(() => {
    focusHandledRef.current = null;
  }, [focusCampaignUserId]);

  useEffect(() => {
    if (!focusCampaignUserId) return;
    if (focusHandledRef.current === focusCampaignUserId) return;
    if (tabLoading) return;

    const id = String(focusCampaignUserId);
    const matchesFocus = (inf: Influencer) =>
      String(inf.id) === id || (inf.campaign_user_id != null && String(inf.campaign_user_id) === id);
    const fullInf = [...pendingInfluencers, ...approvedInfluencers, ...rejectedInfluencers].find(matchesFocus);

    if (!fullInf) {
      if (!qPending.isFetching && !qApproved.isFetching && !qRejected.isFetching) {
        focusHandledRef.current = focusCampaignUserId;
        onFocusUserConsumed?.();
      }
      return;
    }

    const cardMatchesFocus = (a: ApplicationWithProfile) =>
      String(a.campaignUserId) === id || String(a.influencerId) === id;
    if (pendingCards.some(cardMatchesFocus)) markColumnSeen("pending");
    else if (approvedCards.some(cardMatchesFocus)) markColumnSeen("approved");
    else if (rejectedCards.some(cardMatchesFocus)) markColumnSeen("rejected");

    setSelectedProfileInfluencer(fullInf);
    setIsProfileModalOpen(true);
    focusHandledRef.current = focusCampaignUserId;
    onFocusUserConsumed?.();
  }, [
    focusCampaignUserId,
    tabLoading,
    pendingInfluencers,
    approvedInfluencers,
    rejectedInfluencers,
    pendingCards,
    approvedCards,
    rejectedCards,
    qPending.isFetching,
    qApproved.isFetching,
    qRejected.isFetching,
    onFocusUserConsumed,
  ]);

  // ── Handlers de ação ────────────────────────────────────────────────────────

  // Executa a aprovação de fato (reserva o saldo no backend). `onDone` roda no sucesso.
  const approve = (app: ApplicationWithProfile, onDone?: () => void) => {
    updateStatus(
      {
        influencer_id: app.influencerId,
        status: "approved",
        feedback: "Aprovado pelo usuário",
        network_id: app.profileId ? Number(app.profileId) : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${app.profileTypeLabel} aprovado com sucesso!`);
          onDone?.();
        },
        onError: (error: Error) => toast.error(error?.message || "Erro ao aprovar influenciador"),
      }
    );
  };

  const handleApprove = (app: ApplicationWithProfile) => {
    // Com custo: confirma a reserva de saldo antes. Sem custo (ex.: permuta):
    // aprova direto, pois nada é debitado/reservado.
    if (showApprovalCost) {
      setReserveTarget(app);
      return;
    }
    approve(app);
  };

  const handleConfirmReserve = () => {
    if (!reserveTarget) return;
    approve(reserveTarget, () => setReserveTarget(null));
  };

  const handleReject = (app: ApplicationWithProfile) => {
    const influencer =
      pendingInfluencers.find((inf) => String(inf.id) === String(app.influencerId)) ??
      approvedInfluencers.find((inf) => String(inf.id) === String(app.influencerId)) ??
      rejectedInfluencers.find((inf) => String(inf.id) === String(app.influencerId));
    if (influencer) setRejectTarget(influencer);
  };

  const handleConfirmRejection = (feedback: string) => {
    if (!rejectTarget) return;
    const selectedApp = filteredApplications.find((a) => a.influencerId === rejectTarget.id);
    updateStatus(
      {
        influencer_id: rejectTarget.id,
        status: "rejected",
        feedback,
        network_id: selectedApp?.profileId ? Number(selectedApp.profileId) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Influenciador reprovado");
          setRejectTarget(null);
        },
        onError: (error: Error) => toast.error(error?.message || "Erro ao reprovar influenciador"),
      }
    );
  };

  const handleBulkApprove = () => {
    if (bulkApprovalGate.blocked) {
      toast.error(bulkApprovalGate.reason ?? "Saldo insuficiente para aprovar os selecionados.");
      return;
    }
    const selectedApps = filteredApplications.filter((app) => selectedInfluencers.has(app.profileKey));
    const appsByNetworkId = new Map<string | number, typeof selectedApps>();
    selectedApps.forEach((app) => {
      const key = app.profileId || "general";
      if (!appsByNetworkId.has(key)) appsByNetworkId.set(key, []);
      appsByNetworkId.get(key)!.push(app);
    });

    if (appsByNetworkId.size === 1) {
      const [networkId, apps] = Array.from(appsByNetworkId.entries())[0];
      bulkApprove(
        { influencerIds: apps.map((a) => a.influencerId), network_id: networkId !== "general" ? Number(networkId) : undefined },
        {
          onSuccess: () => {
            clearSelection();
            setBulkActionType(null);
          },
        }
      );
    } else {
      const promises = selectedApps.map((app) =>
        updateStatus(
          { influencer_id: app.influencerId, status: "approved", feedback: "Aprovado pelo usuário", network_id: app.profileId ? Number(app.profileId) : undefined },
          { onError: (error: Error) => toast.error(`Erro ao aprovar ${app.profileTypeLabel}: ${error?.message || "Erro desconhecido"}`) }
        )
      );
      Promise.all(promises).then(() => {
        clearSelection();
        setBulkActionType(null);
        toast.success(`${selectedApps.length} perfil(is) aprovado(s)`);
      });
    }
  };

  const handleBulkReject = () => {
    if (!bulkRejectionFeedback.trim()) return;
    const selectedApps = filteredApplications.filter((app) => selectedInfluencers.has(app.profileKey));
    const appsByNetworkId = new Map<string | number, typeof selectedApps>();
    selectedApps.forEach((app) => {
      const key = app.profileId || "general";
      if (!appsByNetworkId.has(key)) appsByNetworkId.set(key, []);
      appsByNetworkId.get(key)!.push(app);
    });

    if (appsByNetworkId.size === 1) {
      const [networkId, apps] = Array.from(appsByNetworkId.entries())[0];
      bulkReject(
        { influencerIds: apps.map((a) => a.influencerId), feedback: bulkRejectionFeedback, network_id: networkId !== "general" ? Number(networkId) : undefined },
        {
          onSuccess: () => {
            clearSelection();
            setBulkRejectionFeedback("");
            setBulkActionType(null);
          },
        }
      );
    } else {
      const promises = selectedApps.map((app) =>
        updateStatus(
          { influencer_id: app.influencerId, status: "rejected", feedback: bulkRejectionFeedback, network_id: app.profileId ? Number(app.profileId) : undefined },
          { onError: (error: Error) => toast.error(`Erro ao reprovar ${app.profileTypeLabel}: ${error?.message || "Erro desconhecido"}`) }
        )
      );
      Promise.all(promises).then(() => {
        clearSelection();
        setBulkRejectionFeedback("");
        setBulkActionType(null);
        toast.success(`${selectedApps.length} perfil(is) reprovado(s)`);
      });
    }
  };

  const handleBulkConfirm = () => {
    if (bulkActionType === "approve") handleBulkApprove();
    else if (bulkActionType === "reject") handleBulkReject();
  };

  // ── Gating de aprovação por saldo (BRL) ────────────────────────────────────
  // Soma o custo dos selecionados em centavos vs `available_cents` do workspace.
  // Fail-open quando saldo não carregou ou custo é desconhecido.
  const bulkApprovalGate = useMemo<{ blocked: boolean; reason: string | null }>(() => {
    if (!showApprovalCost) return { blocked: false, reason: null };
    if (statusFilter !== "pending") return { blocked: false, reason: null };
    if (availableCents == null) return { blocked: false, reason: null };
    if (selectedInfluencers.size === 0) return { blocked: false, reason: null };

    let totalCents = 0;
    let anyUnknown = false;
    for (const app of filteredApplications) {
      if (!selectedInfluencers.has(app.profileKey)) continue;
      const cents = costByProfileKey.get(app.profileKey);
      if (cents == null) {
        anyUnknown = true;
        continue;
      }
      totalCents += cents;
    }

    if (anyUnknown && totalCents === 0) {
      return { blocked: false, reason: null };
    }

    if (totalCents > availableCents) {
      return {
        blocked: true,
        reason: `Saldo insuficiente: necessário ${fmtBRL(totalCents)}, disponível ${fmtBRL(availableCents)}.`,
      };
    }

    return { blocked: false, reason: null };
  }, [
    showApprovalCost,
    statusFilter,
    availableCents,
    selectedInfluencers,
    filteredApplications,
    costByProfileKey,
  ]);

  // ── Helpers de exibição ─────────────────────────────────────────────────────

  const nicheNamesForCard = (app: ApplicationWithProfile) => nicheNamesForApp(app);

  const metaLabelForCard = (app: ApplicationWithProfile) => {
    if (app.profileStatus === "curation") return "Enviado em: —";
    if (app.profileStatus === "approved") return "Aprovado em: —";
    return "Reprovado em: —";
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (tabLoading) return <CurationTabSkeleton />;

  if (tabError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Curadoria de perfis e conteúdo</h2>
          <p className="text-base text-neutral-500 max-w-2xl">
            Centralize a análise: valide perfis, organize aprovações e garanta que tudo esteja alinhado com as regras da campanha.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-4 text-danger-900">
          <p className="text-sm">{tabErrorMessage}</p>
          <Button type="button" variant="outline" className="w-max" onClick={() => { void qPending.refetch(); void qApproved.refetch(); void qRejected.refetch(); }}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Título */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Curadoria de perfis e conteúdo</h2>
          <p className="text-base text-neutral-500 max-w-2xl">
            Centralize a análise: valide perfis, organize aprovações e garanta que tudo esteja alinhado com as regras da campanha.
          </p>
        </div>

        {/* Barra de filtros */}
        <div className="bg-white rounded-[28px] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] flex flex-col gap-1">
              <label className="text-base font-medium text-neutral-950">Buscar influenciador</label>
              <div className="bg-neutral-100 rounded-full px-4 py-3 flex items-center gap-2">
                <Icon name="Search" color="#A3A3A3" size={20} />
                <input
                  type="text"
                  placeholder="Nome ou @username"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[140px] flex flex-col gap-1">
              <label className="text-base font-medium text-neutral-950">Nicho</label>
              <Select
                placeholder="Selecione um nicho"
                options={[{ value: "", label: "Selecione um nicho" }, ...nicheOptions]}
                value={filterNiche}
                onChange={setFilterNiche}
                isSearchable
              />
            </div>
            <div className="flex-1 min-w-[140px] flex flex-col gap-1">
              <label className="text-base font-medium text-neutral-950">Localização</label>
              <Select
                placeholder="Selecione o local"
                options={[{ value: "", label: "Selecione o local" }]}
                value={filterLocation}
                onChange={setFilterLocation}
              />
            </div>
            <div className="flex-1 min-w-[140px] flex flex-col gap-1">
              <label className="text-base font-medium text-neutral-950">Idade</label>
              <Select
                placeholder="Selecione a idade"
                options={[{ value: "", label: "Selecione a idade" }]}
                value={filterAge}
                onChange={setFilterAge}
              />
            </div>
          </div>
        </div>

        {/* Aprovações da Curadoria */}
        <div className="bg-white rounded-[28px] p-5">
          {/* Status tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">Aprovações da Curadoria</h3>
            <div className="flex gap-1">
              {(["pending", "approved", "rejected"] as const).map((status) => {
                const labels = { pending: `Pendentes (${pendingCards.length})`, approved: `Aprovados (${approvedCards.length})`, rejected: `Reprovados (${rejectedCards.length})` };
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => markColumnSeen(status)}
                    className={`h-11 px-4 rounded-full text-base font-semibold transition-colors ${
                      statusFilter === status
                        ? "bg-primary-600 text-white"
                        : "border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                    }`}
                  >
                    {labels[status]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toolbar de seleção */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <label className="text-base font-normal text-neutral-950 cursor-pointer">
                Selecionar todos ({filteredApplications.length})
              </label>
            </div>
            {selectedInfluencers.size > 0 && statusFilter === "pending" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkActionType("approve")}
                  disabled={bulkApprovalGate.blocked}
                  title={bulkApprovalGate.blocked ? (bulkApprovalGate.reason ?? undefined) : undefined}
                  className="h-11 rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Múltiplas aprovações
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBulkActionType("reject")}
                  className="h-11 rounded-full font-semibold text-danger-600 border-danger-200 hover:bg-danger-50"
                >
                  Múltiplas reprovações
                </Button>
              </div>
            )}
          </div>

          {/* Grid de cards */}
          {filteredApplications.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Users" color="#A3A3A3" size={48} />
              <p className="text-neutral-600 mt-4">
                {statusFilter === "pending" ? "Nenhum influenciador pendente" : statusFilter === "approved" ? "Nenhum aprovado" : "Nenhum reprovado"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredApplications.map((app) => {
                const isPending = app.profileStatus === "curation";
                const cardCostCents =
                  isPending && showApprovalCost
                    ? costByProfileKey.get(app.profileKey) ?? null
                    : null;
                const cardCanApprove =
                  !isPending || !showApprovalCost || availableCents == null || cardCostCents == null
                    ? undefined
                    : cardCostCents <= availableCents;
                const cardBlocked = cardCanApprove === false;

                return (
                  <InfluencerProfileCard
                    key={app.profileKey}
                    // Custo já calculado upstream (costSlot). Não exibimos o
                    // breakdown de preços do influenciador aqui — só o badge.
                    data={{ ...app, prices: undefined }}
                    nicheNames={nicheNamesForCard(app)}
                    isSelected={selectedInfluencers.has(app.profileKey)}
                    selectable={isPending}
                    onSelect={() => handleSelectApplication(app.profileKey)}
                    metaLabel={metaLabelForCard(app)}
                    statusBadge={!isPending ? (app.profileStatus === "approved" ? "approved" : "rejected") : undefined}
                    onApprove={isPending ? () => handleApprove(app) : undefined}
                    onReject={
                      isPending || app.profileStatus === "approved"
                        ? () => handleReject(app)
                        : undefined
                    }
                    onViewProfile={() => navigate({ to: "/influencer/$influencerId", params: { influencerId: app.influencerId } })}
                    costSlot={
                      isPending && showApprovalCost ? (
                        <ApprovalCostBadge
                          costCents={cardCostCents}
                          canApprove={cardCanApprove}
                          reason={
                            cardBlocked
                              ? `Saldo do workspace insuficiente (${fmtBRL(availableCents ?? 0)} disponível).`
                              : null
                          }
                          isLoading={balanceQ.isLoading}
                        />
                      ) : null
                    }
                    disableApprove={cardBlocked}
                    disableApproveReason={
                      cardBlocked
                        ? "Saldo do workspace insuficiente para esta aprovação."
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de reprovação individual */}
      {rejectTarget && (
        <RejectionModal
          influencer={rejectTarget}
          onConfirm={handleConfirmRejection}
          onClose={() => setRejectTarget(null)}
        />
      )}

      {/* Modal de confirmação de reserva de saldo (aprovação com custo) */}
      <ReserveBalanceModal
        target={
          reserveTarget
            ? {
                name: reserveTarget.influencerName,
                username: reserveTarget.influencerUsername,
                avatar: reserveTarget.influencerAvatar,
              }
            : null
        }
        costCents={reserveTarget ? costByProfileKey.get(reserveTarget.profileKey) ?? null : null}
        availableCents={availableCents}
        committedCents={committedCents}
        title="Reservar saldo para aprovar"
        confirmLabel="Confirmar aprovação"
        isSubmitting={isUpdatingStatus}
        onConfirm={handleConfirmReserve}
        onClose={() => setReserveTarget(null)}
      />

      {/* Modal de visualização de redes sociais */}
      {isProfileModalOpen && selectedProfileInfluencer && (
        <Modal
          title={`Redes Sociais - ${selectedProfileInfluencer.name}`}
          onClose={() => { setIsProfileModalOpen(false); setSelectedProfileInfluencer(null); }}
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar src={selectedProfileInfluencer.avatar} alt={selectedProfileInfluencer.name} size="lg" />
              <div>
                <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">{selectedProfileInfluencer.name}</h3>
                <p className="text-neutral-600">@{selectedProfileInfluencer.username}</p>
              </div>
            </div>

            {selectedProfileInfluencer.social_networks && selectedProfileInfluencer.social_networks.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-neutral-950 mb-3">
                  Redes Sociais Utilizadas ({selectedProfileInfluencer.social_networks.length})
                </p>
                <div className="bg-canvas rounded-[22px] p-4">
                  <div className="flex flex-col gap-3">
                    {selectedProfileInfluencer.social_networks.map((network) => (
                      <div key={network.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200">
                        <div className="flex items-center gap-3">
                          <SocialNetworkIcon networkType={network.type} size={20} color="#404040" />
                          <div>
                            <p className="text-sm font-semibold text-neutral-950">
                              {getNetworkLabel(network.type, network.name || network.type)}
                            </p>
                            {network.username && <p className="text-xs text-neutral-600">@{network.username}</p>}
                            {network.name && network.name !== network.username && <p className="text-xs text-neutral-600">{network.name}</p>}
                          </div>
                        </div>
                        {network.members !== undefined && network.members > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-neutral-950">{network.members.toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-neutral-600">seguidores</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-canvas rounded-[22px] p-4 text-center">
                <p className="text-sm text-neutral-600">Nenhuma rede social cadastrada</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-600 mb-1">Seguidores totais</p>
                <p className="text-lg font-semibold text-neutral-950">
                  {Number(selectedProfileInfluencer.followers ?? 0).toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Engajamento</p>
                <p className="text-lg font-semibold text-neutral-950">
                  {selectedProfileInfluencer.engagement != null && !Number.isNaN(Number(selectedProfileInfluencer.engagement))
                    ? `${Number(selectedProfileInfluencer.engagement)}%`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-neutral-600 mb-1">Nicho</p>
                <Badge
                  text={resolveNicheDisplayName(selectedProfileInfluencer.niche, niches, selectedProfileInfluencer.nicheName) ?? "-"}
                  backgroundColor="bg-tertiary-50"
                  textColor="text-tertiary-900"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => { setIsProfileModalOpen(false); setSelectedProfileInfluencer(null); }}
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal de ação em massa */}
      <BulkActionModal
        actionType={bulkActionType}
        count={selectedInfluencers.size}
        rejectionFeedback={bulkRejectionFeedback}
        onRejectionFeedbackChange={setBulkRejectionFeedback}
        onConfirm={handleBulkConfirm}
        onClose={() => { setBulkActionType(null); setBulkRejectionFeedback(""); }}
        isLoading={isApproving || isRejecting}
      />
    </>
  );
}
