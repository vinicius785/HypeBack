import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
import { I } from "@/components/prototype/ui";
import { CampaignTile, type CampaignBrand } from "@/components/campaign-card";

export const Route = createFileRoute("/(private)/(app)/")({
  component: RouteComponent,
});

const TASKS_PAGE_SIZE = 3;

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
  const { selectedWorkspace } = useWorkspaceContext();
  const permissions = useWorkspacePermissions();
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
    tasks,
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
  ]);

  const showOverview =
    permissions.campaigns_read && overviewEnabled && campaignsData.length > 0;

  const pendingTaskCount = tasks.reduce((acc, t) => acc + t.count, 0);

  const [tasksPage, setTasksPage] = useState(1);
  const tasksTotalPages = Math.max(
    1,
    Math.ceil(tasks.length / TASKS_PAGE_SIZE),
  );

  useEffect(() => {
    setTasksPage((p) => Math.min(p, tasksTotalPages));
  }, [tasksTotalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (tasksPage - 1) * TASKS_PAGE_SIZE;
    return tasks.slice(start, start + TASKS_PAGE_SIZE);
  }, [tasks, tasksPage]);

  const tasksRangeStart =
    tasks.length === 0 ? 0 : (tasksPage - 1) * TASKS_PAGE_SIZE + 1;
  const tasksRangeEnd = Math.min(
    tasksPage * TASKS_PAGE_SIZE,
    tasks.length,
  );

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
          label: r.campaign.title,
          at: new Date(r.campaign.updated_at || r.campaign.created_at || 0).getTime(),
          value: r.overview?.metrics.reach ?? 0,
        }))
        .filter((p) => p.value > 0)
        .sort((a, b) => a.at - b.at),
    [displayedTableRows],
  );

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

  return (
    <div className="pv">
      <div className="wrap dash" style={{ maxWidth: "none" }}>
        <div className="head fade">
          <div className="hello">
            <WorkspaceBrand name={workspaceName} photo={selectedWorkspace?.photo} />
            <div>
              <h1>
                {greeting}, {workspaceName}
              </h1>
              <p>Acompanhe as campanhas, as métricas e as aprovações do seu workspace.</p>
            </div>
          </div>
          <div className="btns">
            {permissions.campaigns_read && (
              <button type="button" className="btn out" onClick={() => navigate({ to: "/campaigns" })}>
                <I n="grid" cls="sm" />
                Campanhas
              </button>
            )}
            {permissions.campaigns_create && (
              <button type="button" className="btn" onClick={() => navigate({ to: "/campaigns/new" })}>
                <I n="plus" cls="sm" />
                Nova campanha
              </button>
            )}
          </div>
        </div>

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

        {showOverview && (
          <div className="cols fade">
            <section className="tkcard" aria-labelledby="tasks-heading">
              <div className="card-h" style={{ marginBottom: 22 }}>
                <div>
                  <h2 id="tasks-heading">Tarefas e aprovações</h2>
                  <p className="sub">
                    {isOverviewLoading ? "Carregando pendências…" : "O que precisa da sua decisão"}
                  </p>
                </div>
              </div>
              {isOverviewLoading ? (
                <>
                  <div className="sk dk" style={{ height: 64, width: 140 }} />
                  <div className="tks">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="sk dk" style={{ height: 72, borderRadius: 22 }} />
                    ))}
                  </div>
                </>
              ) : overviewHasError ? (
                <div className="empty dk">
                  <b>Pendências indisponíveis</b>
                  <p>Abra a campanha nas abas de aprovação para conferir.</p>
                </div>
              ) : tasks.length === 0 ? (
                <>
                  <div className="tk-n">
                    <b>0</b>
                    <span>itens pendentes</span>
                  </div>
                  <div className="tks">
                    <div className="empty dk">
                      <span className="ei">
                        <I n="check" />
                      </span>
                      <b>Tudo em dia</b>
                      <p>Sem conteúdos, roteiros ou participantes aguardando sua ação.</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="tk-n">
                    <b>{pendingTaskCount}</b>
                    <span>itens aguardando você</span>
                  </div>
                  <TaskBar tasks={tasks} />
                  <div className="tks">
                    {paginatedTasks.map((task, i) => (
                      <button
                        key={`${task.campaignId}-${task.kind}-${(tasksPage - 1) * TASKS_PAGE_SIZE + i}`}
                        type="button"
                        className="tk"
                        style={{ ["--i" as string]: i }}
                        onClick={() =>
                          navigate({
                            to: "/campaigns/$campaignId",
                            params: { campaignId: task.campaignId },
                            search: { tab: task.tab },
                          })
                        }
                      >
                        <span
                          className="ti"
                          style={{
                            background: task.kind === "script" ? "#9e2cfa" : "#fff",
                            color: task.kind === "script" ? "#fff" : "#050505",
                          }}
                        >
                          <I n={task.kind === "script" ? "file" : task.kind === "content" ? "image" : "users"} />
                        </span>
                        <span className="tx">
                          <b>{task.label}</b>
                          <small>{task.campaignTitle}</small>
                        </span>
                        <span className="tk-c" aria-label={`${task.count} ${task.count === 1 ? "item" : "itens"}`}>
                          {task.count}
                        </span>
                        <span className="go">Revisar</span>
                      </button>
                    ))}
                  </div>
                  {tasks.length > TASKS_PAGE_SIZE && (
                    <div className="ctl" style={{ marginTop: 16, justifyContent: "space-between" }}>
                      <small style={{ color: "var(--dim)" }}>
                        {tasksRangeStart}–{tasksRangeEnd} de {tasks.length}
                      </small>
                      <span style={{ display: "inline-flex", gap: 8 }}>
                        <button type="button" className="round" aria-label="Anterior" disabled={tasksPage <= 1} onClick={() => setTasksPage((p) => Math.max(1, p - 1))}>
                          <I n="chev" cls="sm rot" />
                        </button>
                        <button type="button" className="round" aria-label="Próxima" disabled={tasksPage >= tasksTotalPages} onClick={() => setTasksPage((p) => Math.min(tasksTotalPages, p + 1))}>
                          <I n="chev" cls="sm" />
                        </button>
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

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
                      <b>{aggregateMetrics.reach ? aggregateMetrics.reach.toLocaleString("pt-BR") : "—"}</b>
                      <span className="big-src">
                        {campaignsWithReach > 0
                          ? `Estimativa somada de ${campaignsWithReach} ${campaignsWithReach === 1 ? "campanha" : "campanhas"} com alcance medido.`
                          : "Nenhuma campanha com alcance medido ainda."}
                      </span>
                    </div>
                  </div>
                  <ReachChart
                    series={reachSeries}
                    total={stats.total}
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

const TASK_STYLE: Record<string, [string, string]> = {
  script: ["Roteiros", "#9e2cfa"],
  content: ["Conteúdos", "#ffffff"],
  participant: ["Inscrições", "#7e7e7e"],
};

function TaskBar({ tasks }: { tasks: Array<{ kind: string; count: number }> }) {
  const totals = new Map<string, number>();
  for (const t of tasks) totals.set(t.kind, (totals.get(t.kind) ?? 0) + t.count);
  const entries = [...totals.entries()];
  const style = (k: string) => TASK_STYLE[k] ?? [k, "rgba(255,255,255,.3)"];
  return (
    <>
      <div className="tk-bar">
        {entries.map(([k, n]) => (
          <i key={k} style={{ flex: n, background: style(k)[1] }} title={`${style(k)[0]}: ${n}`} />
        ))}
      </div>
      <div className="tk-leg">
        {entries.map(([k, n]) => (
          <span key={k}>
            <i style={{ background: style(k)[1] }} />
            {style(k)[0]} {n}
          </span>
        ))}
      </div>
    </>
  );
}

/** Alcance por campanha — mesma linha/área e cursor do gráfico do protótipo. */
function ReachChart({
  series,
  total,
  onOpenCampaigns,
}: {
  series: Array<{ label: string; at: number; value: number }>;
  total: number;
  onOpenCampaigns: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  if (series.length < 2) {
    return (
      <div className="mh-empty">
        <span className="ei">
          <I n="chart" />
        </span>
        <div>
          <b>Histórico de alcance ainda indisponível</b>
          <p>
            O gráfico compara o alcance entre campanhas e aparece quando pelo menos duas tiverem alcance medido
            ({series.length} de {total} hoje).
          </p>
        </div>
        <button type="button" className="link" onClick={onOpenCampaigns}>
          Ver campanhas
          <I n="chev" cls="sm" />
        </button>
      </div>
    );
  }

  const W = 560;
  const H = 150;
  const vals = series.map((s) => s.value);
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const span = mx - mn || 1;
  const pts = vals.map((y, i) => [
    (i / (vals.length - 1)) * W,
    H - 12 - ((y - mn) / span) * (H - 34),
  ]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${W},${H} L0,${H} Z`;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const i = Math.round((x / r.width) * (vals.length - 1));
    setHover({
      x: (i / (vals.length - 1)) * r.width,
      y: (pts[i][1] / H) * r.height,
      i,
    });
  };

  const fmt = (t: number) =>
    new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const axis = [0, Math.floor((series.length - 1) / 2), series.length - 1].map((i) => fmt(series[i].at));

  return (
    <>
      <div
        ref={ref}
        className={`chart ${hover ? "hov" : ""}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <path className="ar" d={area} fill="#9e2cfa" fillOpacity={0.08} />
          <path className="ln" pathLength={1} d={d} fill="none" stroke="#9e2cfa" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <i className="cur" style={hover ? { left: hover.x, ["--y" as string]: `${hover.y}px` } : undefined} />
        <b
          className="tip"
          style={
            hover
              ? { left: Math.min(Math.max(hover.x, 70), (ref.current?.clientWidth ?? 0) - 70) }
              : undefined
          }
        >
          {hover ? `${series[hover.i].label.slice(0, 22)} · ${compact(series[hover.i].value)}` : ""}
        </b>
      </div>
      <div className="axis">
        {axis.map((a, i) => (
          <span key={i}>{a}</span>
        ))}
      </div>
    </>
  );
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
        <div className="trk-w">
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
                <CampaignTile key={row.campaign.id} row={row} i={i} metricsReady={metricsReady} banner={banners.get(row.campaign.id)} brand={brand} />
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
