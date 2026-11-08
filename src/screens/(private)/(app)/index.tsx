import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { useIsClientRole } from "@/hooks/use-is-client-role";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useWorkspaceOverview } from "@/hooks/use-workspace-overview";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";
import {
  useWorkspaceContext,
  useWorkspacePermissions,
} from "@/contexts/workspace-context";
import type { CampaignListItem } from "@/shared/services/campaign";
import { getUploadUrl } from "@/lib/utils/api";
import { Button } from "@/components/ui/button";
import { NoWorkspaceState } from "@/components/onboarding/no-workspace-state";
import { I } from "@/components/prototype/ui";
import "@/styles/home-metrics.css";
import "@/styles/home-motion.css";
import { CountUp } from "@/components/home/count-up";
import { MyWorkCard } from "@/components/home/my-work-card";
import { MyTaskModal } from "@/components/home/my-task-modal";
import { useMyOpenTasks } from "@/hooks/use-agency-projects";
import { CampaignTile, type CampaignBrand } from "@/components/campaign-card";
import { brandsByCampaignId, campaignBrand } from "@/lib/campaign-brand";

export const Route = createFileRoute("/(private)/(app)/")({
  component: RouteComponent,
});

type TableRow = {
  campaign: CampaignListItem;
  overview?: {
    metrics: {
      reach: number;
      publishedContent: number;
      activeInfluencers?: number;
    };
  };
  pendingTotal: number;
};

function RouteComponent() {
  const navigate = useNavigate();
  const { selectedWorkspace, isInitialized } = useWorkspaceContext();
  const permissions = useWorkspacePermissions();
  const { user } = useAuth();
  const isAgency = useIsAgencyWorkspace();
  const isClient = useIsClientRole();
  const myTasks = useMyOpenTasks(user?.id, { enabled: isAgency });
  const [openTask, setOpenTask] = useState<{ projectId: string; taskId: string } | null>(null);
  const tasksRef = useRef<HTMLElement>(null);
  const { data: campaignsData = [], isLoading, error } = useCampaigns({
    enabled: !!selectedWorkspace,
  });

  const overviewInput = useMemo(
    () =>
      campaignsData.map((c) => ({
        id: c.id,
        title: c.title,
      })),
    [campaignsData],
  );

  const {
    isLoading: isOverviewLoading,
    hasError: overviewHasError,
    aggregateMetrics,
    perCampaign,
    tasks: allTasks,
    enabled: overviewEnabled,
    campaignStats: overviewCampaignStats,
    campaignTable,
    usesAggregatedEndpoint,
  } = useWorkspaceOverview(overviewInput, {
    enabled: !!selectedWorkspace && campaignsData.length > 0,
  });

  const stats = useMemo(() => {
    if (overviewCampaignStats) {
      return {
        total: overviewCampaignStats.total,
        active: overviewCampaignStats.active,
        finished: overviewCampaignStats.finished,
        draft: overviewCampaignStats.draft,
      };
    }
    const total = campaignsData.length;
    const active = campaignsData.filter((c: { status?: unknown }) => {
      const v = getCampaignStatusValue(c.status);
      return v === "active" || v === "published";
    }).length;
    const finished = campaignsData.filter((c: { status?: unknown }) => {
      const v = getCampaignStatusValue(c.status);
      return v === "finished" || v === "completed";
    }).length;
    const draft = campaignsData.filter(
      (c: { status?: unknown }) => getCampaignStatusValue(c.status) === "draft",
    ).length;
    return { total, active, finished, draft };
  }, [overviewCampaignStats, campaignsData]);

  const overviewById = useMemo(() => {
    const m = new Map<string, (typeof perCampaign)[0]>();
    for (const row of perCampaign) m.set(row.campaignId, row);
    return m;
  }, [perCampaign]);

  const legacyTableRows = useMemo((): TableRow[] => {
    return campaignsData
      .map((c) => {
        const o = overviewById.get(c.id);
        const pendingTotal =
          (o?.pendingContent ?? 0) +
          (o?.pendingScripts ?? 0) +
          (o?.participantsAction ?? 0);
        return { campaign: c, overview: o, pendingTotal };
      })
      .sort((a, b) => {
        if (b.pendingTotal !== a.pendingTotal) {
          return b.pendingTotal - a.pendingTotal;
        }
        const tb = new Date(b.campaign.updated_at || 0).getTime();
        const ta = new Date(a.campaign.updated_at || 0).getTime();
        return tb - ta;
      });
  }, [campaignsData, overviewById]);

  const brandById = useMemo(() => brandsByCampaignId(campaignsData), [campaignsData]);

  const displayedTableRows = useMemo((): TableRow[] => {
    if (usesAggregatedEndpoint && campaignTable.length > 0) {
      return [...campaignTable]
        .map((c) => {
          const o = overviewById.get(c.id);
          const pendingTotal =
            c.pending_content_count +
            c.pending_script_count +
            c.participants_action_count;
          const updated = c.updated_at ?? "";
          return {
            campaign: {
              id: c.id,
              title: c.title,
              description: c.description ?? "",
              status: c.status ?? "",
              // O endpoint de métricas não traz a marca: vem da lista de campanhas.
              brand: brandById.get(c.id) ?? null,
              max_influencers: 0,
              created_at: updated,
              updated_at: updated,
            },
            overview: o,
            pendingTotal,
          };
        })
        .sort((a, b) => {
          if (b.pendingTotal !== a.pendingTotal) {
            return b.pendingTotal - a.pendingTotal;
          }
          return (
            new Date(b.campaign.updated_at || 0).getTime() -
            new Date(a.campaign.updated_at || 0).getTime()
          );
        });
    }
    return legacyTableRows;
  }, [
    usesAggregatedEndpoint,
    campaignTable,
    overviewById,
    legacyTableRows,
    brandById,
  ]);

  const showOverview =
    permissions.campaigns_read && overviewEnabled && campaignsData.length > 0;

  // O Cliente aprova roteiros e conteúdos; inscrições de criadores são decisão da agência e não aparecem para ele.
  const tasks = useMemo(() => (isClient ? allTasks.filter((t) => t.kind !== "participant") : allTasks), [isClient, allTasks]);

  const pendingTaskCount = tasks.reduce((acc, t) => acc + t.count, 0);

  const bannerById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campaignsData as Array<{ id?: string; banner?: string | null }>) {
      if (c.id && c.banner) m.set(c.id, c.banner);
    }
    return m;
  }, [campaignsData]);

  const campaignsWithReach = useMemo(
    () => perCampaign.filter((c) => (c.metrics?.reach ?? 0) > 0).length,
    [perCampaign],
  );

  const reachSeries = useMemo(
    () =>
      displayedTableRows
        .map((r) => ({
          id: r.campaign.id,
          label: r.campaign.title,
          at: new Date(r.campaign.updated_at || r.campaign.created_at || 0).getTime(),
          value: r.overview?.metrics.reach ?? 0,
        }))
        .filter((p) => p.value > 0)
        .sort((a, b) => a.at - b.at),
    [displayedTableRows],
  );

  // Sem marca (conta nova que só criou o perfil): a pessoa escolhe entre criar uma e entrar em uma existente.
  if (isInitialized && !selectedWorkspace) return <NoWorkspaceState />;

  if (isLoading) {
    return (
      <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-600 border-t-transparent" />
          <p className="text-neutral-600 text-sm">Carregando dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <p className="text-xl font-semibold text-neutral-950">
            Erro ao carregar dashboard
          </p>
          <span className="text-neutral-600 text-sm">
            {error instanceof Error
              ? error.message
              : "Ocorreu um erro ao buscar os dados. Tente novamente."}
          </span>
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const greeting = getGreeting();
  const workspaceName = selectedWorkspace?.name ?? "Início";
  // Agência: a página é da pessoa (foto, primeiro nome, data), não da empresa.
  const personName = user?.name?.trim() || workspaceName;
  const firstName = personName.split(/\s+/)[0];
  const taskTotals = new Map<string, number>();
  for (const t of tasks) taskTotals.set(t.kind, (taskTotals.get(t.kind) ?? 0) + t.count);
  const personalStats: Array<[string, number, string]> = [
    ["Aguardando você", pendingTaskCount, pendingTaskCount === 1 ? "item para decidir" : "itens para decidir"],
    ["Roteiros", taskTotals.get("script") ?? 0, "para aprovar"],
    ["Conteúdos", taskTotals.get("content") ?? 0, "para aprovar"],
    ["Inscrições", taskTotals.get("participant") ?? 0, "para analisar"],
  ].filter(([label]) => !(isClient && label === "Inscrições")) as Array<[string, number, string]>;

  return (
    <div className="pv">
      <div className="wrap dash" style={{ maxWidth: "none" }}>
        <div className="head fade">
          <div className="hello">
            <WorkspaceBrand
              name={isAgency ? personName : workspaceName}
              photo={isAgency ? (user?.avatar ?? undefined) : selectedWorkspace?.photo}
            />
            <div>
              <h1>
                <span className="hw" style={{ ["--w" as string]: 0 }}>
                  {greeting},
                </span>{" "}
                <span className="hw" style={{ ["--w" as string]: 1 }}>
                  {isAgency ? firstName : workspaceName}
                </span>
              </h1>
              <p>{isAgency ? todayLabel() : "Acompanhe as campanhas, as métricas e as aprovações do seu workspace."}</p>
            </div>
          </div>
        </div>

        {isAgency ? (
          showOverview && (
            <div className="fade">
              <div className="card">
                <div className="stats" role="group" aria-label="O que precisa de você" style={{ ["--stat-n" as string]: personalStats.length }}>
                  {personalStats.map(([l, n, d]) => (
                    <button
                      key={l}
                      type="button"
                      className={`stat${n === 0 ? " zero" : ""}`}
                      onClick={() => tasksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    >
                      <small>{l}</small>
                      <b>{isOverviewLoading ? "—" : <CountUp value={n} />}</b>
                      <span className="d">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
        <div className="fade">
            <div className="card">
              <div className="stats">
                {(
                  [
                    ["Total", stats.total, "campanhas no workspace"],
                    ["Ativas", stats.active, stats.active === 0 ? "nenhuma em andamento" : "em andamento"],
                    ["Finalizadas", stats.finished, "concluídas"],
                    ["Rascunhos", stats.draft, "não publicadas"],
                  ] as const
                ).map(([l, n, d]) => (
                  <div key={l} className="stat">
                    <small>{l}</small>
                    <b>{n}</b>
                    <span className="d">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
  
        )}

        {showOverview && (
          <div className="cols fade">
            <MyWorkCard
              sectionRef={tasksRef}
              title={isAgency ? "Meu trabalho" : "Tarefas e aprovações"}
              loading={isOverviewLoading}
              error={overviewHasError}
              approvals={tasks}
              banners={bannerById}
              onOpenApproval={(task) =>
                navigate({
                  to: "/campaigns/$campaignId",
                  params: { campaignId: task.campaignId },
                  search: { tab: task.tab },
                })
              }
              onViewAll={(tab) => navigate({ to: tab === "tasks" ? "/projects" : "/campaigns" })}
              personal={isAgency ? { tasks: myTasks.tasks, loading: myTasks.isLoading } : undefined}
              onOpenTask={(task) => setOpenTask({ projectId: task.project_id, taskId: task.id })}
            />
            {openTask && (
              <MyTaskModal
                projectId={openTask.projectId}
                taskId={openTask.taskId}
                onOpenTask={(taskId) => setOpenTask({ projectId: openTask.projectId, taskId })}
                onClose={() => setOpenTask(null)}
              />
            )}

            <section className="card mcard" aria-labelledby="metrics-heading">
              {isOverviewLoading ? (
                <>
                  <div className="card-h">
                    <div>
                      <h2 id="metrics-heading">Métricas no workspace</h2>
                      <p className="sub">Carregando…</p>
                    </div>
                  </div>
                  <div className="sk" style={{ height: 60, width: 220, marginBottom: 20 }} />
                  <div className="sk" style={{ height: 150 }} />
                </>
              ) : overviewHasError ? (
                <div className="empty">
                  <b>Métricas indisponíveis</b>
                  <p>Use o painel de cada campanha para detalhes.</p>
                </div>
              ) : (
                <>
                  <div className="card-h">
                    <div>
                      <h2 id="metrics-heading">Métricas no workspace</h2>
                      <p className="sub">Consolidado das campanhas acompanhadas</p>
                    </div>
                  </div>
                  <div className="big">
                    <div>
                      <small>Alcance estimado</small>
                      <b>{aggregateMetrics.reach ? <CountUp value={aggregateMetrics.reach} duration={1200} /> : "—"}</b>
                      <span className="big-src">
                        {campaignsWithReach > 0
                          ? `Estimativa somada de ${campaignsWithReach} ${campaignsWithReach === 1 ? "campanha" : "campanhas"} com alcance medido.`
                          : "Nenhuma campanha com alcance medido ainda."}
                      </span>
                    </div>
                  </div>
                  <ReachRanking
                    series={reachSeries}
                    banners={bannerById}
                    onOpenCampaign={(id) => navigate({ to: "/campaigns/$campaignId", params: { campaignId: id } })}
                    onOpenCampaigns={() => navigate({ to: "/campaigns" })}
                  />
                  <div className="msm">
                    <div>
                      <small>Engajamento médio</small>
                      <b>{aggregateMetrics.engagement ? `${aggregateMetrics.engagement.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</b>
                    </div>
                    <div>
                      <small>Conteúdos publicados</small>
                      <b>{aggregateMetrics.publishedContent}</b>
                    </div>
                    <div>
                      <small>Influenciadores ativos</small>
                      <b>{aggregateMetrics.activeInfluencers}</b>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        <CampaignsCarousel
          banners={bannerById}
          brand={selectedWorkspace}
          rows={displayedTableRows}
          showOverview={showOverview}
          isOverviewLoading={isOverviewLoading}
          canCreate={permissions.campaigns_create}
          total={stats.total}
        />
      </div>
    </div>
  );
}

/** "Quinta-feira, 5 de novembro". */
function todayLabel(): string {
  const t = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const compact = (n: number) =>
  n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Círculo grande do workspace ao lado da saudação (`.brand.big`). */
function WorkspaceBrand({ name, photo }: { name: string; photo?: string }) {
  const url = photo ? getUploadUrl(photo) : undefined;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span className="brand big" style={{ background: "#9e2cfa", overflow: "hidden" }}>
      {url && !broken ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setBroken(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

const RANKING_SIZE = 4;

/** Campanhas que mais alcançaram: foto, nome, alcance e a fatia de cada uma no total, em lista (não há série no tempo). */
function ReachRanking({
  series,
  banners,
  onOpenCampaign,
  onOpenCampaigns,
}: {
  series: Array<{ id: string; label: string; value: number }>;
  banners: Map<string, string>;
  onOpenCampaign: (id: string) => void;
  onOpenCampaigns: () => void;
}) {
  if (series.length === 0) {
    return (
      <div className="rk rk-empty">
        <span>
          <I n="chart" />
        </span>
        <p>As campanhas que mais alcançaram aparecem aqui quando houver alcance medido.</p>
      </div>
    );
  }
  const sorted = [...series].sort((a, b) => b.value - a.value);
  const sum = sorted.reduce((n, r) => n + r.value, 0) || 1;
  const top = sorted.slice(0, RANKING_SIZE);
  const max = top[0].value || 1;
  return (
    <div className="rk">
      <div className="rk-h">
        <b>Campanhas que mais alcançaram</b>
        {sorted.length > RANKING_SIZE && (
          <button type="button" onClick={onOpenCampaigns}>
            Ver todas
            <I n="chev" cls="sm" />
          </button>
        )}
      </div>
      <ul>
        {top.map((r, i) => (
          <li key={r.id} style={{ ["--i" as string]: i }}>
            <button type="button" className="rk-r" onClick={() => onOpenCampaign(r.id)}>
              <RankThumb banner={banners.get(r.id)} name={r.label} />
              <span className="rk-tx">
                <b title={r.label}>{r.label}</b>
                <span className="rk-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max((r.value / max) * 100, 4)}%` }} />
                </span>
              </span>
              <span className="rk-v">
                <b>{compact(r.value)}</b>
                <small>{Math.round((r.value / sum) * 100)}%</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankThumb({ banner, name }: { banner?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const url = banner ? getUploadUrl(banner) : undefined;
  if (!url || broken) return <span className="rk-ph">{initialsOf(name)}</span>;
  return <img className="rk-ph" src={url} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

function CampaignsCarousel({
  banners,
  brand,
  rows,
  showOverview,
  isOverviewLoading,
  canCreate,
  total,
}: {
  banners: Map<string, string>;
  brand?: CampaignBrand;
  rows: TableRow[];
  showOverview: boolean;
  isOverviewLoading: boolean;
  canCreate: boolean;
  total: number;
}) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });
  const metricsReady = showOverview && !isOverviewLoading;

  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) return;
    let down = false;
    let sx = 0;
    let sl = 0;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      down = true;
      moved = false;
      sx = e.clientX;
      sl = tr.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5) {
        moved = true;
        tr.classList.add("drag");
      }
      if (moved) tr.scrollLeft = sl - dx;
    };
    const onUp = () => {
      down = false;
      tr.classList.remove("drag");
    };
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    tr.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    tr.addEventListener("click", onClick, true);
    return () => {
      tr.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      tr.removeEventListener("click", onClick, true);
    };
  }, [rows.length]);

  // Setas só existem quando há mais cartões fora da vista, e se desabilitam nas pontas.
  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) return;
    const update = () =>
      setEdge({
        prev: tr.scrollLeft > 4,
        next: tr.scrollLeft + tr.clientWidth < tr.scrollWidth - 4,
      });
    update();
    tr.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(tr);
    return () => {
      tr.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [rows.length, canCreate]);

  const by = (dir: -1 | 1) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trackRef.current?.scrollBy({ left: dir * 318, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="fade">
      <section className="camp">
        <div className="camp-h">
          <div>
            <h2>Campanhas</h2>
            <p className="sub">Status, alcance e pendências de cada campanha</p>
          </div>
          <div className="camp-act">
            {(edge.prev || edge.next) && (
              <>
                <button
                  type="button"
                  className="trk-b prev"
                  aria-label="Campanhas anteriores"
                  disabled={!edge.prev}
                  onClick={() => by(-1)}
                >
                  <I n="chev" cls="sm rot" />
                </button>
                <button
                  type="button"
                  className="trk-b next"
                  aria-label="Próximas campanhas"
                  disabled={!edge.next}
                  onClick={() => by(1)}
                >
                  <I n="chev" cls="sm" />
                </button>
              </>
            )}
            <button
              type="button"
              className="btn out"
              aria-label={`Ver todas as campanhas (${total})`}
              onClick={() => navigate({ to: "/campaigns" })}
            >
              Ver todas
              <em>{total}</em>
              <I n="chev" cls="sm" />
            </button>
          </div>
        </div>
        <div className="trk-w">
        <div className="track" ref={trackRef}>
          {rows.length === 0 ? (
            <div className="empty" style={{ flex: 1 }}>
              <span className="ei">
                <I n="mega" />
              </span>
              <b>Sua primeira campanha começa aqui</b>
              <p>Defina o briefing, escolha os criadores e acompanhe tudo em um só lugar.</p>
              {canCreate && (
                <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => navigate({ to: "/campaigns/new" })}>
                  <I n="plus" cls="sm" />
                  Nova campanha
                </button>
              )}
            </div>
          ) : (
            <>
              {rows.map((row, i) => (
                <CampaignTile key={row.campaign.id} row={row} i={i} metricsReady={metricsReady} banner={banners.get(row.campaign.id)} brand={campaignBrand(row.campaign, brand)} />
              ))}
              {canCreate && (
                <button
                  type="button"
                  className="cc new"
                  style={{ ["--i" as string]: rows.length }}
                  onClick={() => navigate({ to: "/campaigns/new" })}
                >
                  <span className="ei">
                    <I n="plus" />
                  </span>
                  <b>Nova campanha</b>
                  <small>Comece pelo briefing</small>
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}
