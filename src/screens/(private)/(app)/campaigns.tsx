import { useState, useMemo, useRef, useEffect } from "react";
import { clsx } from "clsx";

import { createFileRoute, Outlet, useLocation, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CampaignCard, CampaignRow } from "@/components/campaign-card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useWorkspaceOverview } from "@/hooks/use-workspace-overview";
import { useWorkspaceContext, useWorkspacePermissions } from "@/contexts/workspace-context";
import { getUploadUrl } from "@/lib/utils/api";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";

export const Route = createFileRoute("/(private)/(app)/campaigns")({
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
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);
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

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((c) => FILTERS.active(c.statusValue)).length,
      draft: campaigns.filter((c) => FILTERS.draft(c.statusValue)).length,
      finished: campaigns.filter((c) => FILTERS.finished(c.statusValue)).length,
    }),
    [campaigns],
  );

  const filteredCampaigns = useMemo(() => {
    const q = normalize(searchTerm.trim());
    const list = campaigns.filter(
      (c) =>
        FILTERS[filterStatus](c.statusValue) &&
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
  }, [campaigns, searchTerm, filterStatus, sort]);

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
                Crie um workspace no onboarding para começar a gerenciar suas campanhas.
              </span>
            </div>
            <Link to="/onboarding">
              <Button>
                <p className="text-neutral-50 font-semibold">Ir para onboarding</p>
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

  const emptyMessage = searchTerm.trim()
    ? {
        title: `Nada encontrado para “${searchTerm.trim()}”`,
        description: "Confira a ortografia ou limpe a busca.",
      }
    : EMPTY_MESSAGES[filterStatus];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-1.5 text-[40px] font-semibold leading-[1.05] tracking-[-0.04em]">
            Campanhas
          </h1>
          <p className="text-[15px] text-neutral-500">
            Crie, acompanhe e aprove tudo em um só lugar.
          </p>
        </div>
        {permissions.campaigns_create && (
          <Link to="/campaigns/new" params={{}}>
            <Button>
              <Icon name="Plus" color="currentColor" size={16} />
              Nova campanha
            </Button>
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          className="inline-flex max-w-full overflow-x-auto rounded-full bg-white p-[5px] [scrollbar-width:none]"
        >
          {(Object.keys(FILTER_LABEL) as FilterKey[]).map((key) => {
            const on = filterStatus === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilterStatus(key)}
                className={clsx(
                  "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors duration-300",
                  on ? "bg-neutral-950 text-white" : "text-neutral-500 hover:text-neutral-950",
                )}
              >
                {FILTER_LABEL[key]}
                <em
                  className={clsx(
                    "rounded-full px-[7px] py-0.5 text-[11.5px] font-bold not-italic transition-colors",
                    on ? "bg-primary-600 text-white" : "bg-canvas text-neutral-950",
                  )}
                >
                  {counts[key]}
                </em>
              </button>
            );
          })}
        </div>

        <label className="flex h-[52px] min-w-[150px] max-w-[320px] flex-1 items-center gap-2.5 rounded-full bg-white px-[18px] text-neutral-500 ring-2 ring-transparent focus-within:ring-primary-600">
          <Icon name="Search" color="currentColor" size={16} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </label>

        <span className="flex-1" />

        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            className="inline-flex h-[52px] items-center gap-2 whitespace-nowrap rounded-full bg-white px-[18px] text-sm font-semibold"
          >
            <Icon name="ArrowDownUp" color="currentColor" size={16} />
            {SORT_LABEL[sort]}
          </button>
          <div
            role="menu"
            className={clsx(
              "absolute right-0 top-[calc(100%+8px)] z-30 min-w-[210px] origin-top-right rounded-[22px] bg-white p-2 shadow-[0_18px_40px_-12px_rgba(5,5,5,0.35)] transition-all duration-300 ease-hype",
              sortOpen ? "visible scale-100 opacity-100" : "invisible -translate-y-1.5 scale-[0.98] opacity-0",
            )}
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setSort(key);
                  setSortOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2.5 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold hover:bg-canvas"
              >
                {SORT_LABEL[key]}
                {sort === key && <Icon name="Check" color="#9e2cfa" size={16} />}
              </button>
            ))}
          </div>
        </div>

        <div className="inline-flex rounded-full bg-white p-[5px]">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={v === "grid" ? "Cartões" : "Lista"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={clsx(
                "grid size-[42px] place-items-center rounded-full transition-colors duration-300",
                view === v ? "bg-neutral-950 text-white" : "text-neutral-500",
              )}
            >
              <Icon name={v === "grid" ? "LayoutGrid" : "List"} color="currentColor" size={16} />
            </button>
          ))}
        </div>
      </div>

      {filteredCampaigns.length === 0 ? (
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
              description={c.description}
              status={c.statusValue}
              banner={c.banner}
              brand={selectedWorkspace}
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
              description={c.description}
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
    </div>
  );
}
