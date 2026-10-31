import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { createFileRoute, useNavigate, useParams, Outlet, useLocation } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getUploadUrl } from "@/lib/utils/api";

import { OverviewTab } from "@/components/campaign-tabs/overview-tab";
import { I } from "@/components/prototype/ui";
import { TopActions } from "@/components/header";
import {
  NEEDME,
  STAGE_OF_TILE,
  toFlowParticipants,
  type FlowId,
  type FlowParticipant,
  type StageKey,
} from "@/components/campaign-tabs/campaign-flow";
import { ManagementTab } from "@/components/campaign-tabs/management-tab";
import { InfluencerSelectionTab } from "@/components/campaign-tabs/influencer-selection-tab";
import { ApplicationsTab } from "@/components/campaign-tabs/applications-tab";
import { ProposalsTab } from "@/components/campaign-tabs/proposals-tab";
import { CurationTab } from "@/components/campaign-tabs/curation-tab";
import { ShipmentTab } from "@/components/campaign-tabs/shipment-tab";
import { ContentApprovalTab } from "@/components/campaign-tabs/content-approval-tab";
import { ScriptApprovalTab } from "@/components/campaign-tabs/script-approval-tab";
import { ContractsTab } from "@/components/campaign-tabs/contracts-tab";
import { MetricsTab } from "@/components/campaign-tabs/metrics-tab";
import { GroupsTab } from "@/components/campaign-tabs/groups-tab";
import { ShareCampaignModal } from "@/components/share-campaign-modal";
import { Modal } from "@/components/ui/modal";
import { InputDate } from "@/components/ui/input-date";
import { validateMuralEndDate, formatDateForInput, addDays } from "@/shared/utils/date-validations";

import { useCampaign } from "@/hooks/use-campaigns";
import { useActivateMural, useDeactivateMural } from "@/hooks/use-campaign-mural";
import { useCampaignDashboard } from "@/hooks/use-campaign-dashboard";
import {
  useIdentifiedPosts,
  useCampaignTabContentsMetrics,
  useCampaignTopCities,
  useCampaignAudienceByAge,
} from "@/hooks/use-campaign-metrics";
import { useCampaignManagement } from "@/hooks/use-campaign-management";
import {
  checkCampaignPublicationTracking,
  mapApiPhasesToCampaignPhases,
} from "@/shared/services/dashboard";
import { formatReais } from "@/shared/utils/masks";
import {
  getCampaignStatusDisplayLabel,
  getCampaignStatusValue,
} from "@/shared/utils/campaign-status";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import type { WorkspacePermissions } from "@/shared/types";

export const Route = createFileRoute("/(private)/(app)/campaigns/$campaignId")({
  component: RouteComponent,
});

/** Abas da campanha filtradas por `permissions` do workspace (@see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md). */
const CAMPAIGN_TAB_DEFS: Array<{
  id: string;
  label: string;
  visible: (p: WorkspacePermissions) => boolean;
}> = [
    { id: "dashboard", label: "Dashboard", visible: (p) => p.campaigns_read },
    {
      id: "selection",
      label: "Seleção de influenciadores",
      visible: (p) => p.influencers_read,
    },
    // Só aparece em campanhas "valor individual por criador" (gate por
    // payment_method no filtro de visibleTabs, além da permissão).
    {
      id: "proposals",
      label: "Propostas",
      visible: (p) => p.influencers_read,
    },
    { id: "applications", label: "Inscrições", visible: (p) => p.campaigns_read },
    { id: "curation", label: "Curadoria", visible: (p) => p.influencers_approve || p.influencers_reject },
    { id: "management", label: "Gerenciamento", visible: (p) => p.campaigns_read },
    { id: "groups", label: "Grupo", visible: (p) => p.campaigns_read },
    { id: "contracts", label: "Contratos", visible: (p) => p.contracts_read },
    {
      id: "script-approval",
      label: "Aprovações de roteiro",
      visible: (p) => p.scripts_read,
    },
    // Envio ocorre após a aprovação do roteiro e antes da aprovação do conteúdo
    { id: "shipment", label: "Envios", visible: (p) => p.campaigns_read },
    {
      id: "approval",
      label: "Aprovações de conteúdo",
      visible: (p) => p.content_read,
    },
    {
      id: "metrics",
      label: "Métricas e conteúdos",
      visible: (p) => p.campaigns_read,
    },
  ];

function RouteComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { campaignId } = useParams({ from: "/(private)/(app)/campaigns/$campaignId" });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showMuralDateModal, setShowMuralDateModal] = useState(false);
  const [tempMuralEndDate, setTempMuralEndDate] = useState("");
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);

  /** Deep links vindos de notificações — guardados antes de limpar a URL */
  const [pendingOpenChat, setPendingOpenChat] = useState<string | null>(null);
  const [pendingFocusCampaignUser, setPendingFocusCampaignUser] = useState<
    string | null
  >(null);
  const [pendingContentId, setPendingContentId] = useState<string | null>(null);

  const handleOpenChatConsumed = useCallback(() => setPendingOpenChat(null), []);
  const handleFocusUserConsumed = useCallback(
    () => setPendingFocusCampaignUser(null),
    []
  );
  const handleHighlightContentConsumed = useCallback(
    () => setPendingContentId(null),
    []
  );

  const permissions = useWorkspacePermissions();

  // Query principal da campanha (dados básicos) — deve vir antes dos effects que dependem de visibleTabs
  const queryClient = useQueryClient();
  const {
    data: campaign,
    isLoading: isLoadingCampaign,
    error: campaignError,
  } = useCampaign(campaignId);

  const isSwapCampaign = campaign?.payment_method === "swap";
  const isIndividualPrice = campaign?.payment_method === "individual_price";

  const visibleTabs = useMemo(
    () =>
      CAMPAIGN_TAB_DEFS.filter((t) => {
        if (t.id === "shipment" && !isSwapCampaign) return false;
        // Aba de propostas só faz sentido em "valor individual por criador".
        if (t.id === "proposals" && !isIndividualPrice) return false;
        // …e só para quem tem permissão de ver valores dos criadores.
        if (t.id === "proposals" && !permissions.influencer_values_read)
          return false;
        return t.visible(permissions);
      }).map(({ id, label }) => ({ id, label })),
    [permissions, isSwapCampaign, isIndividualPrice],
  );

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  // Ler search params da URL para navegação de notificações
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tabParam = sp.get("tab");
    const openChat = sp.get("openChat");
    const focusCampaignUser = sp.get("focusCampaignUser");
    const contentId = sp.get("contentId");

    const validTabIds = new Set(visibleTabs.map((t) => t.id));
    let targetTab: string | null =
      tabParam && validTabIds.has(tabParam) ? tabParam : null;

    if (!targetTab) {
      if (openChat && validTabIds.has("management")) targetTab = "management";
      else if (contentId && validTabIds.has("approval")) targetTab = "approval";
      else if (focusCampaignUser && validTabIds.has("curation"))
        targetTab = "curation";
    }

    if (targetTab && !validTabIds.has(targetTab)) {
      targetTab = visibleTabs[0]?.id ?? null;
    }

    if (
      !targetTab &&
      !openChat &&
      !focusCampaignUser &&
      !contentId
    ) {
      return;
    }

    if (targetTab) {
      setActiveTab(targetTab);
    }
    if (openChat) setPendingOpenChat(openChat);
    if (focusCampaignUser) setPendingFocusCampaignUser(focusCampaignUser);
    if (contentId) setPendingContentId(contentId);

    const next = new URLSearchParams(location.search);
    for (const k of ["tab", "openChat", "focusCampaignUser", "contentId"]) {
      next.delete(k);
    }
    const rest = Object.fromEntries(next);
    navigate({
      to: location.pathname,
      search: Object.keys(rest).length > 0 ? rest : undefined,
      replace: true,
    });
  }, [location.search, location.pathname, navigate, visibleTabs]);

  const checkPublicationTrackingMutation = useMutation({
    mutationFn: () => checkCampaignPublicationTracking(campaignId),
    onSuccess: (result) => {
      toast.success(
        `Varredura concluída: ${result.published}/${result.checked} publicados`
      );

      if ((result.errors?.length ?? 0) > 0) {
        toast.warning(
          `A varredura terminou com ${result.errors.length} erro(s) pontuais.`
        );
      }

      void queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "dashboard"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "identified-posts"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "metrics"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "metrics-tab"],
      });
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string | string[];
        errors?: string[];
      };
      const msg = Array.isArray(e?.message)
        ? e.message.join(", ")
        : e?.message || e?.errors?.join(", ") || "Erro ao verificar publicações";
      toast.error(msg);
    },
  });

  // Dashboard: influenciadores, conteúdos e métricas (fases vêm de GET campanha quando a API envia `phases`)
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
  } = useCampaignDashboard(campaignId);

  // Query de posts identificados (ainda não está no dashboard)
  const {
    data: identifiedPosts = [],
  } = useIdentifiedPosts(campaignId);

  const metricsTabActive = activeTab === "metrics";
  const tabContentsMetricsQuery = useCampaignTabContentsMetrics(campaignId, {
    enabled: metricsTabActive,
  });
  const topCitiesQuery = useCampaignTopCities(campaignId, 5, {
    enabled: metricsTabActive,
  });
  const audienceByAgeQuery = useCampaignAudienceByAge(campaignId, {
    enabled: metricsTabActive,
  });
  const tabAnalyticsLoading =
    metricsTabActive &&
    (tabContentsMetricsQuery.isLoading ||
      topCitiesQuery.isLoading ||
      audienceByAgeQuery.isLoading);

  const {
    data: managementData,
    isLoading: isLoadingManagement,
    error: managementError,
  } = useCampaignManagement(campaignId, {
    enabled: true,
  });

  const { mutate: activateMural, isPending: isActivatingMural } = useActivateMural(campaignId);
  const { mutate: deactivateMural, isPending: isDeactivatingMural } = useDeactivateMural(campaignId);

  // Buscar nichos para determinar o nicho principal

  const phasesFromCampaignDetail = useMemo(() => {
    if (campaign?.phases === undefined || campaign.phases === null) {
      return null;
    }
    return mapApiPhasesToCampaignPhases(campaign.phases);
  }, [campaign?.phases]);

  const phases =
    phasesFromCampaignDetail !== null
      ? phasesFromCampaignDetail
      : dashboardData?.phases ?? [];
  const influencers = dashboardData?.influencers || [];
  const contents = dashboardData?.contents || [];
  const metrics = dashboardData?.metrics;

  const campaignFormData = useMemo(() => {
    if (!campaign) return null;

    // Processar nichos: API retorna `niches` (raízes) e `secondary_niches` (filhos)
    type NicheObj = { id: number; name: string; parent_id: number | null };
    const toNicheObj = (n: any): NicheObj | null =>
      typeof n === "object" && n !== null
        ? { id: Number(n.id), name: String(n.name ?? ""), parent_id: n.parent_id ?? null }
        : null;
    const allNicheObjects: NicheObj[] = [
      ...(Array.isArray(campaign.niches)
        ? (campaign.niches.map(toNicheObj).filter((n): n is NicheObj => n !== null))
        : []),
      ...(Array.isArray(campaign.secondary_niches)
        ? (campaign.secondary_niches.map(toNicheObj).filter((n): n is NicheObj => n !== null))
        : []),
    ];

    const mainNicheIds: string[] = [];
    const subnicheIds: string[] = [];
    allNicheObjects.forEach((n) => {
      const id = String(n.id);
      if (n.parent_id == null) {
        mainNicheIds.push(id);
      } else {
        subnicheIds.push(id);
      }
    });

    // Nomes para o dashboard (não precisam de lookup)
    const nicheNames = allNicheObjects.filter((n) => n.parent_id == null).map((n) => n.name).filter(Boolean);
    const subNicheNames = allNicheObjects.filter((n) => n.parent_id != null).map((n) => n.name).filter(Boolean);

    return {
      title: campaign.title || "",
      description: campaign.description || "",
      mainNiche: mainNicheIds.join(","),
      primaryNicheName: nicheNames[0] ?? "",
      subniches: subnicheIds.join(","),
      nicheNames,
      subNicheNames,
      influencersCount: campaign.max_influencers?.toString() || "0",
      minFollowers: campaign.segment_min_followers?.toString() || "0",
      state: Array.isArray(campaign.segment_state)
        ? campaign.segment_state.join(",")
        : campaign.segment_state || "",
      city: Array.isArray(campaign.segment_city)
        ? campaign.segment_city.join(",")
        : campaign.segment_city || "",
      gender: Array.isArray(campaign.segment_genders)
        ? campaign.segment_genders.join(", ")
        : campaign.segment_genders || "all",
      paymentType: campaign.payment_method || "",
      paymentFixedAmount: campaign.payment_method === "fixed" && campaign.payment_method_details?.amount
        ? formatReais(campaign.payment_method_details.amount)
        : "",
      paymentSwapItem: campaign.payment_method === "swap" && campaign.payment_method_details?.description
        ? campaign.payment_method_details.description.split(" - Valor de mercado:")[0]?.trim() || ""
        : "",
      paymentSwapMarketValue: campaign.payment_method === "swap" && campaign.payment_method_details?.amount
        ? formatReais(campaign.payment_method_details.amount)
        : "",
      paymentCpaActions: campaign.payment_method === "cpa" && campaign.payment_method_details?.description
        ? campaign.payment_method_details.description
          .replace("Ações que geram CPA:", "")
          .split(" - Valor:")[0]
          ?.trim() || ""
        : "",
      paymentCpaValue: campaign.payment_method === "cpa" && campaign.payment_method_details?.amount
        ? formatReais(campaign.payment_method_details.amount)
        : "",
      paymentCpmValue: campaign.payment_method === "cpm" && campaign.payment_method_details?.amount
        ? formatReais(campaign.payment_method_details.amount)
        : "",
      benefits: campaign.benefits
        ? (Array.isArray(campaign.benefits)
          ? campaign.benefits
          : campaign.benefits.split(/\n/).map(line => line.trim()).filter(line => line).length > 0
            ? campaign.benefits.split(/\n/).map(line => line.trim()).filter(line => line)
            : [""])
        : [""],
      generalObjective: campaign.objective || "",
      whatToDo: Array.isArray(campaign.rules_does)
        ? campaign.rules_does
        : campaign.rules_does
          ? [campaign.rules_does]
          : [""],
      whatNotToDo: Array.isArray(campaign.rules_does_not)
        ? campaign.rules_does_not
        : campaign.rules_does_not
          ? [campaign.rules_does_not]
          : [""],
      banner: campaign.banner || "",
      imageRightsPeriod: campaign.image_rights_period?.toString() || "0",
      brandFiles: "",
      phasesCount: phases.length.toString(),
      phases, // GET campanha (`phases`) ou, em fallback, dashboard
    };
  }, [campaign, phases]);

  // `metrics` aqui já vem em camelCase — o hook `useCampaignDashboard` faz a
  // transformação snake→camel dos campos do backend. Front só consome.
  const progressPercentage = metrics?.progress ?? 0;

  const formattedMetrics = useMemo(
    () => ({
      reach: metrics?.reach ?? 0,
      engagement: metrics?.engagement ?? 0,
      publishedContent: metrics?.publishedContent ?? 0,
      activeInfluencers: metrics?.activeInfluencers ?? 0,
    }),
    [metrics],
  );

  const flowParticipants = useMemo(
    () => toFlowParticipants(managementData?.participants ?? []),
    [managementData?.participants],
  );
  const needMeCount = flowParticipants.filter((p) =>
    NEEDME.includes(p.column),
  ).length;
  const creatorsCount = flowParticipants.filter(
    (p) =>
      ![
        "applications",
        "pre_selection",
        "pre_selection_curation",
        "curation",
        "invited",
        "rejected",
      ].includes(p.column),
  ).length;

  const [boardFocus, setBoardFocus] = useState<
    { stage: StageKey; filter: "me" | "all"; nonce: number } | undefined
  >(undefined);

  const dtabsRef = useRef<HTMLElement>(null);
  const topTabKey = activeTab === "dashboard" ? "overview" : ["groups", "contracts", "metrics"].includes(activeTab) ? "gest" : "manage";
  useLayoutEffect(() => {
    const root = dtabsRef.current;
    if (!root) return;
    const place = () => {
      const on = root.querySelector<HTMLElement>("button[data-dtab].on");
      const ind = root.querySelector<HTMLElement>(".ind");
      if (!on || !ind) return;
      ind.style.width = `${on.offsetWidth}px`;
      ind.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    place();
    const t = window.setTimeout(place, 520);
    window.addEventListener("resize", place);
    // Reposiciona quando o layout muda depois do primeiro render (fontes, animação de entrada, badges).
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(root);
    root.querySelectorAll("button[data-dtab]").forEach((b) => ro?.observe(b));
    void document.fonts?.ready.then(place);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", place);
      ro?.disconnect();
    };
  }, [topTabKey, isLoadingCampaign, needMeCount]);

  // A barra pode montar depois do efeito acima (carregando a campanha): reposiciona o indicador a cada render.
  useLayoutEffect(() => {
    const root = dtabsRef.current;
    const on = root?.querySelector<HTMLElement>("button[data-dtab].on");
    const ind = root?.querySelector<HTMLElement>(".ind");
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  });

  /** "Revisar / Curar / Responder…" na visão geral: abre o quadro já filtrado. */
  const goTile = useCallback((tile: string) => {
    setActiveTab("management");
    setBoardFocus({
      stage: STAGE_OF_TILE[tile] ?? "rot",
      filter: "me",
      nonce: Date.now(),
    });
  }, []);

  /** Botão de ação de um card: abre a tela de trabalho correspondente. */
  const openFlow = useCallback((target: FlowId | "contracts") => {
    setActiveTab(target);
  }, []);

  const remind = useCallback((p: FlowParticipant) => {
    setPendingOpenChat(String(p.raw.user_id ?? p.raw.id));
    setActiveTab("management");
  }, []);

  // Loading state (agora só 2 queries: campaign e dashboard)
  const isLoading = isLoadingCampaign || isLoadingDashboard;

  // Se estiver na rota de edição ou no perfil do influenciador, renderizar apenas o Outlet (após todos os hooks)
  if (location.pathname.includes("/edit")) {
    return <Outlet />;
  }
  if (location.pathname.includes("/influencer/")) {
    return <Outlet />;
  }

  // Error handling
  if (campaignError) {
    toast.error("Erro ao carregar campanha");
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-950 mb-2">
            Erro ao carregar campanha
          </p>
          <p className="text-sm text-neutral-600 mb-4">
            Não foi possível carregar os dados da campanha.
          </p>
          <Button onClick={() => navigate({ to: "/campaigns" })}>
            Voltar para campanhas
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !campaignFormData) {
    // Esqueleto no mesmo layout do protótipo (nada de abas antigas).
    return (
      <div className="mx-auto flex h-full max-w-[1180px] flex-col">
        <div className="pv">
          <div className="wrap" style={{ maxWidth: "none" }}>
            <div className="top">
              <nav className="crumb" aria-label="Navegação">
                <button
                  type="button"
                  className="crumb-back"
                  onClick={() => navigate({ to: "/campaigns" })}
                >
                  <I n="back" cls="sm" />
                  Campanhas
                </button>
              </nav>
              <div className="gap" />
              <TopActions />
            </div>
            <div className="dhead">
              <div className="dh-l">
                <span className="dh-img sk" />
                <div>
                  <div className="sk" style={{ height: 34, width: 280, marginBottom: 10 }} />
                  <div className="sk" style={{ height: 16, width: 200 }} />
                </div>
              </div>
              <div className="btns">
                <div className="sk" style={{ height: 50, width: 110, borderRadius: 999 }} />
                <div className="sk" style={{ height: 50, width: 140, borderRadius: 999 }} />
                <div className="sk" style={{ height: 50, width: 150, borderRadius: 999 }} />
              </div>
            </div>
            <div className="sk" style={{ height: 52, width: 420, borderRadius: 999 }} />
            <div className="sk" style={{ height: 300, borderRadius: 28 }} />
            <div className="sk" style={{ height: 260, borderRadius: 28 }} />
          </div>
        </div>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col h-full max-w-7xl mx-auto items-center justify-center px-4 py-16">
        <p className="text-lg font-semibold text-neutral-950 text-center mb-2">
          Sem permissão neste workspace
        </p>
        <p className="text-sm text-neutral-600 text-center max-w-md mb-6">
          Você não tem permissão para visualizar as abas desta campanha com o workspace
          atual. Troque de workspace no topo da página ou fale com um administrador.
        </p>
        <Button onClick={() => navigate({ to: "/campaigns" })}>
          Voltar para campanhas
        </Button>
      </div>
    );
  }

  const canWriteCampaigns = permissions.campaigns_write;

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <OverviewTab
            participants={flowParticipants}
            isLoading={isLoadingManagement}
            progress={progressPercentage}
            reach={formattedMetrics.reach}
            engagement={formattedMetrics.engagement}
            phases={phases}
            onGoTile={goTile}
            onRemind={remind}
          />
        );
      case "management":
        return (
          <ManagementTab
            participants={managementData?.participants ?? []}
            isLoading={isLoadingManagement}
            error={managementError}
            openChatInfluencerId={pendingOpenChat ?? undefined}
            onOpenChatConsumed={handleOpenChatConsumed}
            paymentType={campaign?.payment_method}
            focus={boardFocus}
            onOpenFlow={openFlow}
            progress={progressPercentage}
            phases={phases}
          />
        );
      case "groups":
        return (
          <GroupsTab
            campaignId={campaignId}
            canWrite={permissions.campaigns_write}
          />
        );
      case "selection":
        return (
          <InfluencerSelectionTab
            influencers={influencers}
            campaignPhases={phases.map((phase: any, index: number) => ({
              id: phase.id,
              label: `Fase ${index + 1}`,
              publish_date: phase.publish_date,
            }))}
            maxInfluencers={campaign?.max_influencers || 0}
            phasesWithFormats={phases}
            onOpenMuralModal={() => setShowMuralDateModal(true)}
            paymentMethod={campaign?.payment_method}
          />
        );
      case "proposals":
        return <ProposalsTab campaignId={campaignId} />;
      case "applications":
        return (
          <ApplicationsTab
            focusCampaignUserId={pendingFocusCampaignUser}
            onFocusUserConsumed={handleFocusUserConsumed}
            paymentType={campaign?.payment_method}
            phasesWithFormats={phases}
          />
        );
      case "curation":
        return (
          <CurationTab
            focusCampaignUserId={pendingFocusCampaignUser}
            onFocusUserConsumed={handleFocusUserConsumed}
            paymentType={campaign?.payment_method}
            phasesWithFormats={phases}
          />
        );
      case "shipment":
        return (
          <ShipmentTab campaignId={campaignId} />
        );
      case "approval":
        return (
          <ContentApprovalTab
            campaignPhases={phases}
            highlightContentId={pendingContentId}
            onHighlightContentConsumed={handleHighlightContentConsumed}
          />
        );
      case "script-approval":
        return (
          <ScriptApprovalTab
            campaignPhases={phases}
          />
        );
      case "contracts":
        return (
          <ContractsTab
            influencers={influencers.map((inf: any) => ({
              // `inf.id` é o `campaign_users.id` (= campaign_user_id no backend).
              id: inf.id,
              // `user_id` casa com contratos legados cujo `influencer_id` ainda referencia o user.
              user_id: inf.user_id,
              name: inf.name,
              avatar: inf.avatar,
              username: inf.username,
              status: inf.status,
            }))}
          />
        );
      case "metrics":
        return (
          <MetricsTab
            contents={contents}
            campaignPhases={phases}
            identifiedPosts={identifiedPosts}
            topCities={topCitiesQuery.data ?? []}
            audienceByAge={audienceByAgeQuery.data ?? null}
            tabAnalyticsLoading={tabAnalyticsLoading}
          />
        );
      default:
        return null;
    }
  };

  const statusValue = getCampaignStatusValue(campaign?.status) ?? "";
  const FLOWS = [
    "selection",
    "proposals",
    "applications",
    "curation",
    "script-approval",
    "shipment",
    "approval",
  ];
  const GEST_IDS = ["groups", "contracts", "metrics"];
  const GEST_LABEL: Record<string, string> = {
    groups: "Grupo",
    contracts: "Contratos",
    metrics: "Métricas e conteúdos",
  };
  const visibleIds = new Set(visibleTabs.map((t) => t.id));
  const gestSubs = GEST_IDS.filter((id) => visibleIds.has(id));
  const topTab: "overview" | "manage" | "gest" =
    activeTab === "dashboard"
      ? "overview"
      : GEST_IDS.includes(activeTab)
        ? "gest"
        : "manage";
  const inFlow = FLOWS.includes(activeTab);

  const pickTop = (t: "overview" | "manage" | "gest") => {
    if (t === "overview") setActiveTab("dashboard");
    else if (t === "manage") setActiveTab("management");
    else setActiveTab(gestSubs[0] ?? "groups");
  };

  return (
    <div className="mx-auto flex h-full max-w-[1180px] flex-col">
      <div className="flex-1 pb-6">
        <div className="pv">
          <div className="wrap" style={{ maxWidth: "none" }}>
            <div className="top">
              <nav className="crumb" aria-label="Navegação">
                <button
                  type="button"
                  className="crumb-back"
                  onClick={() => navigate({ to: "/campaigns" })}
                >
                  <I n="back" cls="sm" />
                  Campanhas
                </button>
                <span className="crumb-sep" aria-hidden="true">/</span>
                <span className="crumb-cur" title={campaignFormData.title}>
                  {campaignFormData.title || "Campanha"}
                </span>
              </nav>
              <div className="gap" />
              <TopActions />
            </div>

            <div className="dhead fade">
              <div className="dh-l">
                <span className="dh-img">
                  {campaign?.banner ? (
                    <img
                      src={getUploadUrl(campaign.banner)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="dh-ph">{(campaignFormData.title || "?").slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <div className="dh-info">
                  <div className="dh-t">
                    <h1>{campaignFormData.title}</h1>
                    {statusValue === "published" && canWriteCampaigns ? (
                      <button
                        type="button"
                        className="pill p"
                        title="Despublicar campanha"
                        onClick={() => setShowUnpublishModal(true)}
                      >
                        {getCampaignStatusDisplayLabel(campaign?.status)}
                      </button>
                    ) : (
                      <span
                        className={`pill ${
                          statusValue === "published" || statusValue === "active"
                            ? "p"
                            : statusValue === "finished" || statusValue === "completed"
                              ? "k"
                              : ""
                        }`}
                      >
                        {getCampaignStatusDisplayLabel(campaign?.status)}
                      </span>
                    )}
                  </div>
                  {campaignFormData.description ? (
                    <p className="dh-d">{campaignFormData.description}</p>
                  ) : null}
                  <div className="dh-m">
                    <span>
                      <b>{creatorsCount}</b> criadores
                    </span>
                    <span className="dh-pg" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.max(0, Math.round(progressPercentage)))}%` }} />
                    </span>
                    <span>
                      <b>{Math.round(progressPercentage)}%</b> concluído
                    </span>
                  </div>
                </div>
              </div>
              <div className="dh-act">
                {canWriteCampaigns && statusValue === "draft" && (
                  <button type="button" className="btn" onClick={() => setShowMuralDateModal(true)}>
                    <I n="send" cls="sm" />
                    Publicar
                  </button>
                )}
                {canWriteCampaigns && (
                  <button
                    type="button"
                    className={statusValue === "draft" ? "btn out" : "btn"}
                    disabled={checkPublicationTrackingMutation.isPending}
                    onClick={() => checkPublicationTrackingMutation.mutate()}
                  >
                    <I n="refresh" cls="sm" />
                    {checkPublicationTrackingMutation.isPending
                      ? "Verificando..."
                      : "Verificar publicações"}
                  </button>
                )}
                {canWriteCampaigns && (
                  <button
                    type="button"
                    className="btn out"
                    onClick={() =>
                      navigate({
                        to: "/campaigns/$campaignId/edit",
                        params: { campaignId },
                      })
                    }
                  >
                    <I n="notepad" cls="sm" />
                    Editar
                  </button>
                )}
                <span className="dh-qs">
                  <button
                    type="button"
                    className={canWriteCampaigns ? "dh-q" : "btn"}
                    onClick={() =>
                      window.open(`/campaigns/${campaignId}/invite`, "_blank", "noopener")
                    }
                  >
                    <I n="eye" cls="sm" />
                    Ver convite
                  </button>
                  <button type="button" className="dh-q" onClick={() => setIsShareModalOpen(true)}>
                    <I n="share" cls="sm" />
                    Compartilhar
                  </button>
                </span>
              </div>
            </div>

            <nav className="dtabs fade" ref={dtabsRef}>
              <i className="ind" />
              {(
                [
                  ["overview", "Visão geral"],
                  ["manage", "Gerenciamento"],
                  ["gest", "Gestão"],
                ] as const
              )
                .filter(([id]) => id !== "gest" || gestSubs.length > 0)
                .map(([id, label]) => (
                  <span key={id} style={{ display: "contents" }}>
                    <button
                      type="button"
                      data-dtab={id}
                      className={topTab === id ? "on" : ""}
                      onClick={() => pickTop(id)}
                    >
                      {label}
                      {id === "manage" && needMeCount > 0 ? <em>{needMeCount}</em> : null}
                    </button>
                    {id === "gest" && (
                      <span className={`dsub ${topTab === "gest" ? "open" : ""}`}>
                        {gestSubs.map((k, j) => (
                          <button
                            key={k}
                            type="button"
                            className={activeTab === k ? "sel" : ""}
                            style={{ ["--j" as string]: j }}
                            onClick={() => setActiveTab(k)}
                          >
                            {GEST_LABEL[k]}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                ))}
            </nav>
          </div>
        </div>

        {/* Conteúdo das abas */}
        <div className="mt-7">
          {inFlow && (
            <div className="pv" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className="back"
                onClick={() => setActiveTab("management")}
              >
                <span>
                  <I n="back" cls="sm" />
                </span>
                Voltar ao quadro
              </button>
            </div>
          )}
          {renderTabContent()}
        </div>
      </div>

      {/* Modal de compartilhamento */}
      {campaign && (
        <ShareCampaignModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          campaignId={campaignId}
          campaignTitle={campaign.title}
        />
      )}

      {showUnpublishModal && (
        <Modal
          title="Despublicar campanha"
          onClose={() =>
            !isDeactivatingMural && setShowUnpublishModal(false)
          }
          panelClassName="max-w-md"
        >
          <p className="mb-6 text-sm text-neutral-600">
            A campanha voltará ao estado de rascunho e deixará de constar como
            publicada. Confirme se deseja continuar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-w-[120px]"
              disabled={isDeactivatingMural}
              onClick={() => setShowUnpublishModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1 min-w-[120px] bg-danger-600 hover:bg-danger-700 text-white border-0"
              disabled={isDeactivatingMural}
              onClick={() => {
                // Despublicar usa o endpoint dedicado do mural (simétrico ao
                // publicar/ativar Descobrir). O PUT genérico de campanha não
                // aceita `status` (forbidNonWhitelisted) e retornava 400.
                deactivateMural(undefined, {
                  onSuccess: () => {
                    toast.success("Campanha despublicada.");
                    setShowUnpublishModal(false);
                    void queryClient.invalidateQueries({
                      queryKey: ["campaigns", campaignId],
                    });
                    void queryClient.invalidateQueries({
                      queryKey: ["campaigns", campaignId, "dashboard"],
                    });
                  },
                  onError: (err: unknown) => {
                    const e = err as {
                      message?: string | string[];
                      errors?: string[];
                    };
                    const msg = Array.isArray(e?.message)
                      ? e.message.join(", ")
                      : e?.message ||
                      e?.errors?.join(", ") ||
                      "Não foi possível despublicar a campanha.";
                    toast.error(msg);
                  },
                });
              }}
            >
              {isDeactivatingMural
                ? "Despublicando…"
                : "Despublicar"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal Ativar Descobrir (aberto pelo botão Publicar ou pela aba de seleção) */}
      {showMuralDateModal && (() => {
        const phase1Date = phases?.[0]?.postDate || "";
        const validation = tempMuralEndDate
          ? validateMuralEndDate(tempMuralEndDate, phase1Date)
          : { valid: true };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = formatDateForInput(addDays(today, 1));
        const maxDate = validation.maxDate;

        return (
          <Modal
            title="Ativar Descobrir - Definir data limite"
            onClose={() => {
              setShowMuralDateModal(false);
              setTempMuralEndDate("");
            }}
          >
            <div className="flex flex-col gap-6">
              <div className="bg-primary-50 rounded-2xl p-4 mb-2">
                <p className="text-sm font-medium text-primary-900 mb-2">
                  O que é o Descobrir?
                </p>
                <p className="text-sm text-primary-800">
                  O Descobrir permite que influenciadores encontrem e se inscrevam na sua campanha.
                  Ao ativar, sua campanha ficará visível na seção de descoberta do app, aumentando
                  o alcance e facilitando o processo de seleção de influenciadores.
                </p>
              </div>
              <p className="text-sm text-neutral-600">
                Defina até quando o Descobrir ficará ativo para receber inscrições. A data limite precisa ser maior que a data atual e pelo menos 7 dias menor que a data prevista da fase 1.
              </p>
              <InputDate
                label="Data limite para receber inscrições"
                value={tempMuralEndDate}
                onChange={setTempMuralEndDate}
                min={minDate}
                max={maxDate}
                error={validation.error}
              />
              {phase1Date && (
                <p className="text-xs text-neutral-500">
                  Data da fase 1: {new Date(phase1Date).toLocaleDateString("pt-BR")} |
                  Data máxima permitida: {maxDate ? new Date(maxDate).toLocaleDateString("pt-BR") : "N/A"}
                </p>
              )}
              {tempMuralEndDate && validation.valid && (
                <div className="bg-primary-50 rounded-2xl p-4">
                  <p className="text-sm text-primary-900">
                    O Descobrir ficará ativo até{" "}
                    <strong>{new Date(tempMuralEndDate).toLocaleDateString("pt-BR")}</strong>. Você poderá desativá-lo a qualquer momento antes desta data.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMuralDateModal(false);
                    setTempMuralEndDate("");
                  }}
                  disabled={isActivatingMural}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!tempMuralEndDate) return;
                    activateMural(
                      { end_date: tempMuralEndDate },
                      {
                        onSuccess: () => {
                          toast.success("Descobrir ativado com sucesso!");
                          setShowMuralDateModal(false);
                          setTempMuralEndDate("");
                        },
                        onError: (error: Error) => {
                          toast.error(error?.message || "Erro ao ativar Descobrir");
                        },
                      }
                    );
                  }}
                  disabled={!tempMuralEndDate || isActivatingMural || !validation.valid}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white border-0"
                >
                  {isActivatingMural ? "Ativando..." : "Ativar Descobrir"}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
