import { useState, useMemo, useEffect } from "react";

import { createFileRoute, Outlet, useLocation, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  PageContainer,
  PageControls,
  PageHeader,
  PageTabs,
  PageToolbar,
  SearchInput,
  SelectControl,
  SortControl,
  ViewSwitcher,
  type ViewOption,
} from "@/components/page/page-kit";
import { Modal } from "@/components/ui/modal";
import { CampaignCard, CampaignRow } from "@/components/campaign-card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useAgencyBrands, useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { useWorkspaceOverview } from "@/hooks/use-workspace-overview";
import { useWorkspaceContext, useWorkspacePermissions } from "@/contexts/workspace-context";
import { getUploadUrl } from "@/lib/utils/api";
import { discardCampaignDraft, listCampaignDrafts } from "@/lib/campaign-draft";
import { LocalDraftCard } from "@/components/local-draft-card";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";

export const Route = createFileRoute("/(private)/(app)/campaigns")({
  // `?brand=<id da marca>` abre a lista já filtrada (vem da página Marcas). `tab`, `openChat`, `focusCampaignUser` e
  // `contentId` são os links de notificação/atalho do detalhe da campanha (rota filha): passam intactos, senão o
  // roteador os descartaria ao navegar.
  validateSearch: (
    search: Record<string, unknown>,
  ): { brand?: string; tab?: string; openChat?: string; focusCampaignUser?: string; contentId?: string } => {
    const text = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);
    return {
      brand: text(search.brand),
      tab: text(search.tab),
      openChat: text(search.openChat),
      focusCampaignUser: text(search.focusCampaignUser),
      contentId: text(search.contentId),
    };
  },
  component: RouteComponent,
});

type FilterKey = "all" | "active" | "draft" | "finished";
type SortKey = "recent" | "pending" | "name";

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Todas",
  active: "Ativas",
  draft: "Rascunhos",
  finished: "Finalizadas",
};

const FILTERS: Record<FilterKey, (status: string) => boolean> = {
  all: () => true,
  active: (s) => s === "active" || s === "published",
  draft: (s) => s === "draft",
  finished: (s) => s === "finished" || s === "completed",
};

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Mais recentes",
  pending: "Mais pendências",
  name: "Nome (A–Z)",
};

const SORT_OPTIONS = (Object.keys(SORT_LABEL) as SortKey[]).map((k) => [k, SORT_LABEL[k]] as const);

const VIEW_OPTIONS: ViewOption<"grid" | "list">[] = [
  { id: "grid", icon: "grid", label: "Cartões" },
  { id: "list", icon: "list", label: "Lista" },
];

const EMPTY_MESSAGES: Record<FilterKey, { title: string; description: string }> = {
  all: {
    title: "Nenhuma campanha por aqui… ainda!",
    description:
      "Dê o primeiro passo: crie sua primeira campanha e comece a impulsionar sua marca no Hype.",
  },
  active: {
    title: "Nenhuma campanha ativa no momento",
    description: "Veja as outras abas ou crie uma nova campanha.",
  },
  draft: {
    title: "Nenhum rascunho por aqui",
    description: "Campanhas salvas como rascunho aparecem aqui.",
  },
  finished: {
    title: "Nenhuma campanha finalizada",
    description: "Quando uma campanha terminar, ela vai para esta aba.",
  },
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function RouteComponent() {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const isAgency = useIsAgencyWorkspace();
  const { data: agencyBrands = [] } = useAgencyBrands();
  const { brand: brandFromUrl } = Route.useSearch();
  const [brandFilter, setBrandFilter] = useState(brandFromUrl ?? "");
  useEffect(() => setBrandFilter(brandFromUrl ?? ""), [brandFromUrl]);
  const [draftVersion, setDraftVersion] = useState(0);

  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  const {
    workspaces,
    isInitialized,
    selectedWorkspace,
    selectWorkspace,
  } = useWorkspaceContext();

  const permissions = useWorkspacePermissions();
  const hasWorkspace = !!selectedWorkspace;
  const { data: campaignsData = [], isLoading, error } = useCampaigns({
    enabled: hasWorkspace,
  });

  const overviewInput = useMemo(
    () => campaignsData.map((c: any) => ({ id: c.id, title: c.title })),
    [campaignsData],
  );
  const {
    isLoading: isOverviewLoading,
    perCampaign,
    enabled: overviewEnabled,
  } = useWorkspaceOverview(overviewInput, {
    enabled: hasWorkspace && campaignsData.length > 0,
  });
  const metricsReady =
    permissions.campaigns_read && overviewEnabled && !isOverviewLoading;

  const campaigns = useMemo(() => {
    const byId = new Map(perCampaign.map((o) => [o.campaignId, o]));
    return campaignsData.map((campaign: any) => {
      const o = byId.get(campaign.id);
      return {
        id: campaign.id || "",
        title: campaign.title as string,
        description: (campaign.description as string | undefined) ?? "",
        // Status normalizado: filtra rascunhos de forma confiável (#5).
        statusValue: getCampaignStatusValue(campaign.status) ?? "",
        banner: (campaign.banner as string | undefined) || undefined,
        brandId: ((campaign.brand as { id?: string } | null | undefined)?.id ?? "") as string,
        brandName: ((campaign.brand as { name?: string } | null | undefined)?.name ?? undefined) as string | undefined,
        brandPhoto: ((campaign.brand as { photo?: string | null } | null | undefined)?.photo ?? undefined) as string | undefined,
        updatedAt: new Date(campaign.updated_at || campaign.created_at || 0).getTime(),
        reach: metricsReady ? (o?.metrics.reach ?? 0) : undefined,
        published: metricsReady ? (o?.metrics.publishedContent ?? 0) : undefined,
        creators: metricsReady ? (o?.metrics.activeInfluencers ?? 0) : undefined,
        pending: metricsReady
          ? (o?.pendingContent ?? 0) + (o?.pendingScripts ?? 0) + (o?.participantsAction ?? 0)
          : undefined,
      };
    });
  }, [campaignsData, perCampaign, metricsReady]);

  // Rascunho do assistente "Nova campanha": só existe neste navegador, então entra à parte das campanhas da API.
  // Relê ao navegar (voltar do assistente) e ao descartar.
  const localDrafts = useMemo(
    () => listCampaignDrafts(selectedWorkspace?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedWorkspace?.id, location.pathname, draftVersion],
  );

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((c) => FILTERS.active(c.statusValue)).length,
      draft: campaigns.filter((c) => FILTERS.draft(c.statusValue)).length + localDrafts.length,
      finished: campaigns.filter((c) => FILTERS.finished(c.statusValue)).length,
    }),
    [campaigns, localDrafts],
  );

  const filteredCampaigns = useMemo(() => {
    const q = normalize(searchTerm.trim());
    const list = campaigns.filter(
      (c) =>
        FILTERS[filterStatus](c.statusValue) &&
        (!brandFilter || c.brandId === brandFilter) &&
        (!q || normalize(c.title).includes(q)),
    );
    if (sort === "pending") {
      list.sort((a, b) => (b.pending ?? 0) - (a.pending ?? 0));
    } else if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }, [campaigns, searchTerm, filterStatus, sort, brandFilter]);

  if (location.pathname !== "/campaigns") {
    return <Outlet />;
  }

  // Aguardar workspace estar pronto antes de decidir o que mostrar
  if (location.pathname === "/campaigns" && !isInitialized) {
    return (
      <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          <p className="text-neutral-600">Preparando workspace...</p>
        </div>
      </div>
    );
  }

  // Na página de campanhas: sem workspace selecionado → modal ou empty state (só após contexto inicializado)
  if (isInitialized && !hasWorkspace) {
    if (workspaces.length === 0) {
      return (
        <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
          <div className="w-full max-w-xl flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                <Icon name="Building2" color="#9e2cfa" size={32} />
              </div>
              <p className="text-2xl font-medium text-neutral-950">
                Nenhum workspace encontrado
              </p>
              <span className="text-neutral-600">
                Crie uma marca (ou peça um convite a quem já tem uma) para começar a gerenciar suas campanhas.
              </span>
            </div>
            <Link to="/onboarding/create-workspace">
              <Button>
                <p className="text-neutral-50 font-semibold">Criar marca</p>
              </Button>
            </Link>
          </div>
        </div>
      );
    }
    // Tem workspaces mas nenhum selecionado → modal para escolher
    return (
      <>
        <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
          <div className="w-full max-w-xl flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                <Icon name="Building2" color="#9e2cfa" size={32} />
              </div>
              <p className="text-2xl font-medium text-neutral-950">
                Selecione um workspace
              </p>
              <span className="text-neutral-600">
                Escolha o workspace para ver e gerenciar as campanhas.
              </span>
            </div>
            <Button onClick={() => setShowWorkspaceModal(true)}>
              <p className="text-neutral-50 font-semibold">Escolher workspace</p>
            </Button>
          </div>
        </div>

        {showWorkspaceModal && (
          <Modal
            title="Selecione um workspace"
            onClose={() => setShowWorkspaceModal(false)}
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-600 mb-2">
                Selecione o workspace para acessar as campanhas:
              </p>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    selectWorkspace(workspace);
                    setShowWorkspaceModal(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:border-primary-300 hover:bg-primary-50/50 transition-colors text-left"
                >
                  <Avatar
                    size="md"
                    src={getUploadUrl(workspace.photo)}
                    alt={workspace.name}
                  />
                  <div>
                    <p className="font-semibold text-neutral-950">{workspace.name}</p>
                    <p className="text-xs text-neutral-500">Clique para acessar as campanhas</p>
                  </div>
                  <Icon name="ChevronRight" className="ml-auto" size={20} color="#525252" />
                </button>
              ))}
            </div>
          </Modal>
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-neutral-600">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="w-full max-w-xl flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl font-medium text-neutral-950">
              Erro ao carregar campanhas
            </p>
            <span className="text-neutral-600 text-center">
              {error instanceof Error ? error.message : "Ocorreu um erro ao buscar as campanhas. Tente novamente."}
            </span>
          </div>
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const visibleLocalDrafts =
    !brandFilter && (filterStatus === "draft" || filterStatus === "all")
      ? localDrafts.filter(
          (d) =>
            !searchTerm.trim() ||
            normalize(d.title || "campanha sem título").includes(normalize(searchTerm.trim())),
        )
      : [];
  const showLocalDraft = visibleLocalDrafts.length > 0;

  const emptyMessage = searchTerm.trim()
    ? {
        title: `Nada encontrado para “${searchTerm.trim()}”`,
        description: "Confira a ortografia ou limpe a busca.",
      }
    : EMPTY_MESSAGES[filterStatus];

  return (
    <PageContainer>
      <PageHeader
        title="Campanhas"
        subtitle="Crie, acompanhe e aprove tudo em um só lugar."
        actions={
          permissions.campaigns_create ? (
            <Link to="/campaigns/new" params={{}}>
              <Button>
                <Icon name="Plus" color="currentColor" size={16} />
                Nova campanha
              </Button>
            </Link>
          ) : undefined
        }
      />

      <PageControls>
        <PageTabs
          ariaLabel="Situação das campanhas"
          value={filterStatus}
          onChange={setFilterStatus}
          items={(Object.keys(FILTER_LABEL) as FilterKey[]).map((key) => ({ id: key, label: FILTER_LABEL[key], count: counts[key] }))}
        />
        <PageToolbar>
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Pesquisar campanhas" label="Pesquisar campanhas" />
          {isAgency && agencyBrands.length > 0 ? (
            <SelectControl label="Filtrar por marca" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="">Todas as marcas</option>
              {agencyBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.status === "archived" ? `${b.name} (arquivada)` : b.name}
                </option>
              ))}
            </SelectControl>
          ) : null}
          <SortControl options={SORT_OPTIONS} value={sort} onChange={setSort} />
          <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />
        </PageToolbar>
      </PageControls>

      {showLocalDraft ? (
        <div className="pv">
          <div className="cgrid">
            {visibleLocalDrafts.map((draft) => (
              <LocalDraftCard
                key={draft.id}
                draft={draft}
                onDiscard={() => {
                  discardCampaignDraft(draft.id);
                  setDraftVersion((v) => v + 1);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {filteredCampaigns.length === 0 && showLocalDraft ? null : filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[32px] bg-white px-5 py-[70px] text-center">
          <span className="mb-1.5 grid size-[68px] place-items-center rounded-3xl bg-canvas">
            <Icon name={searchTerm.trim() ? "Search" : "Megaphone"} color="#7e7e7e" size={26} />
          </span>
          <b className="text-xl">{emptyMessage.title}</b>
          <p className="max-w-[40ch] text-sm text-neutral-500">{emptyMessage.description}</p>
          {searchTerm.trim() ? (
            <Button variant="outline" className="mt-3 bg-canvas" onClick={() => setSearchTerm("")}>
              Limpar busca
            </Button>
          ) : (
            permissions.campaigns_create && (
              <Link to="/campaigns/new" params={{}} className="mt-3">
                <Button>
                  <Icon name="Plus" color="currentColor" size={16} />
                  Nova campanha
                </Button>
              </Link>
            )
          )}
        </div>
      ) : view === "grid" ? (
        <div className="pv"><div className="cgrid">
          {filteredCampaigns.map((c, i) => (
            <CampaignCard
              key={c.id}
              id={c.id}
              title={c.title}
              description={c.brandName ?? c.description}
              status={c.statusValue}
              banner={c.banner}
              brand={c.brandName ? { name: c.brandName, photo: c.brandPhoto } : selectedWorkspace}
              reach={c.reach}
              published={c.published}
              pending={c.pending}
              creators={c.creators}
              index={i}
            />
          ))}
        </div></div>
      ) : (
        <div className="pv"><div className="clist">
          {filteredCampaigns.map((c, i) => (
            <CampaignRow
              key={c.id}
              id={c.id}
              title={c.title}
              description={c.brandName ?? c.description}
              status={c.statusValue}
              banner={c.banner}
              reach={c.reach}
              published={c.published}
              pending={c.pending}
              creators={c.creators}
              index={i}
            />
          ))}
        </div></div>
      )}
    </PageContainer>
  );
}
