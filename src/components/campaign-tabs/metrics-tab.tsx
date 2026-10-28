import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import type {
  CampaignTopCityRow,
  CampaignAudienceByAgeResponse,
} from "@/shared/services/metrics";
import { I, Av } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import { useCampaignContentsMetricsMap } from "@/hooks/use-campaign-metrics";
import type {
  CampaignContent,
  ContentMetrics,
  IdentifiedPost,
  CampaignPhase,
} from "@/shared/types";
import "@/styles/prototype-metrics.css";

type MetricKey = "reach" | "views" | "inter";
type RangeKey = "7" | "30" | "all";
type FormatKey = "all" | "rl" | "st" | "tk" | "yt";
type SortKey = "views" | "eng" | "rec";

const MT_M: Record<MetricKey, [string, string]> = {
  reach: ["Alcance", "pessoas alcançadas"],
  views: ["Visualizações", "views totais"],
  inter: ["Interações", "curtidas, comentários e envios"],
};
const MT_N = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const RANGES: Array<[RangeKey, string]> = [
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["all", "Tudo"],
];
const FORMATS: Array<[FormatKey, string]> = [
  ["all", "Todos"],
  ["rl", "Reels e Shorts"],
  ["st", "Stories"],
  ["tk", "TikTok"],
  ["yt", "YouTube"],
];
const SORTS: Array<[SortKey, string]> = [
  ["views", "Mais visualizações"],
  ["eng", "Maior engajamento"],
  ["rec", "Mais recentes"],
];
const NET_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const THUMB_BG = ["#e9d3fd", "#d9d9d9", "#cfcfcf", "#f0e1fe", "#e3c4fc", "#dcdcdc"];
const EMPTY_CONTENT_METRICS_MAP: Record<string, ContentMetrics> = {};

function mfmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " mi";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(".", ",") + " mil";
  return String(Math.round(n));
}

function netKey(c: CampaignContent): string {
  const raw = (c.socialNetwork || c.social_network || "").toLowerCase();
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("tik")) return "tiktok";
  if (raw.includes("you")) return "youtube";
  return raw;
}

function netLabel(k: string): string {
  return NET_LABEL[k] ?? (k ? k.charAt(0).toUpperCase() + k.slice(1) : "—");
}

function pubDate(c: CampaignContent): Date | null {
  const d = c.publishedAt || c.published_at;
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dayLabel(dt: Date): string {
  return `${dt.getDate()} ${MT_N[dt.getMonth()]}`;
}

function startOfDay(dt: Date): Date {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d;
}

function netIcon(k: string): string {
  return k === "instagram" || k === "tiktok" || k === "youtube" ? k : "share";
}

function metricValue(m: ContentMetrics, k: MetricKey): number {
  return k === "reach" ? m.reach : k === "views" ? m.views : m.likes + m.comments + m.shares;
}

interface SeriesPoint {
  at: Date;
  value: number;
}

function PerformanceChart({ points, max }: { points: SeriesPoint[]; max: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  const W = 760;
  const H = 220;
  const P = 10;
  const n = points.length;
  const xy = points.map((p, i) => [
    P + (i / (n - 1)) * (W - 2 * P),
    H - 14 - (p.value / max) * (H - 40),
  ]);
  const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const labels = [0, 0.5, 1].map((f) => points[Math.round(f * (n - 1))]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const i = Math.round((x / r.width) * (n - 1));
    const y = ((H - 14 - (points[i].value / max) * (H - 40)) / H) * r.height;
    setHover({ x, y, i });
  };

  return (
    <>
      <div
        ref={ref}
        className={`mx-ch${hover ? " hov" : ""}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="mxg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#9e2cfa" stopOpacity=".28" />
              <stop offset="1" stopColor="#9e2cfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="#efefef" strokeWidth="1.5">
            {[0, 1, 2, 3].map((k) => (
              <line key={k} x1="0" x2={W} y1={30 + k * 52} y2={30 + k * 52} />
            ))}
          </g>
          <path d={`${d} L${xy[n - 1][0]} ${H} L${xy[0][0]} ${H} Z`} fill="url(#mxg)" />
          <path
            d={d}
            fill="none"
            stroke="#9e2cfa"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-ln"
          />
        </svg>
        <i
          className="mx-cur"
          style={
            hover
              ? ({ left: (hover.i / (n - 1)) * (ref.current?.clientWidth ?? 0), ["--y" as string]: `${hover.y}px` } as React.CSSProperties)
              : undefined
          }
        />
        <span
          className="mx-tip"
          style={hover ? { left: Math.min(Math.max(hover.x, 60), (ref.current?.clientWidth ?? 0) - 60) } : undefined}
        >
          {hover ? `${dayLabel(points[hover.i].at)} · ${mfmt(points[hover.i].value)}` : ""}
        </span>
        <div className="mx-yl">
          <span>{mfmt(max)}</span>
          <span>{mfmt(max / 2)}</span>
          <span>0</span>
        </div>
      </div>
      <div className="mx-xl">
        {labels.map((p, i) => (
          <span key={i}>{dayLabel(p.at)}</span>
        ))}
      </div>
    </>
  );
}

interface MetricsTabProps {
  contents: CampaignContent[];
  campaignPhases?: CampaignPhase[];
  identifiedPosts?: IdentifiedPost[];
  topCities?: CampaignTopCityRow[];
  audienceByAge?: CampaignAudienceByAgeResponse | null;
  tabAnalyticsLoading?: boolean;
}

export function MetricsTab({
  contents,
  campaignPhases = [],
  identifiedPosts = [],
  topCities = [],
  audienceByAge = null,
  tabAnalyticsLoading = false,
}: MetricsTabProps) {
  const navigate = useNavigate();
  const { campaignId } = useParams({ from: "/(private)/(app)/campaigns/$campaignId" });
  const [selected, setSelected] = useState<CampaignContent | null>(null);
  const [metric, setMetric] = useState<MetricKey>("reach");
  const [range, setRange] = useState<RangeKey>("30");
  const [format, setFormat] = useState<FormatKey>("all");
  const [sort, setSort] = useState<SortKey>("views");
  const [phase, setPhase] = useState<string>("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const contentsMetricsQuery = useCampaignContentsMetricsMap(campaignId ?? "");
  const metricsById = contentsMetricsQuery.data?.by_content_id ?? EMPTY_CONTENT_METRICS_MAP;
  const getM = (id: string): ContentMetrics | null => metricsById[id] ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  useEffect(() => {
    if (!sortOpen && !phaseOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".cfw")) {
        setSortOpen(false);
        setPhaseOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sortOpen, phaseOpen]);

  const published = useMemo(
    () =>
      contents.filter(
        (c) => c.status === "published" && (phase === "all" || c.phase_id === phase)
      ),
    [contents, phase]
  );

  const withMetrics = useMemo(
    () =>
      published
        .map((c) => ({ c, m: metricsById[c.id] ?? null }))
        .filter((x): x is { c: CampaignContent; m: ContentMetrics } => x.m !== null),
    [published, metricsById]
  );

  const kpi = useMemo(() => {
    const sum = (f: (m: ContentMetrics) => number) => withMetrics.reduce((a, x) => a + f(x.m), 0);
    const eng = withMetrics.length
      ? withMetrics.reduce((a, x) => a + (x.m.engagement || 0), 0) / withMetrics.length
      : 0;
    return {
      reach: sum((m) => m.reach),
      views: sum((m) => m.views),
      inter: sum((m) => m.likes + m.comments + m.shares),
      shares: sum((m) => m.shares),
      eng,
    };
  }, [withMetrics]);

  const inReview = useMemo(
    () =>
      contents.filter(
        (c) => c.status !== "published" && c.status !== "rejected" && (phase === "all" || c.phase_id === phase)
      ).length,
    [contents, phase]
  );

  const series = useMemo(() => {
    const today = startOfDay(new Date());
    const dated = withMetrics
      .map((x) => ({ at: pubDate(x.c), m: x.m }))
      .filter((x): x is { at: Date; m: ContentMetrics } => x.at !== null);
    let start: Date;
    if (range === "all") {
      const min = dated.length ? Math.min(...dated.map((x) => startOfDay(x.at).getTime())) : today.getTime();
      start = new Date(Math.max(min, today.getTime() - 119 * 86400000));
    } else {
      start = new Date(today.getTime() - (Number(range) - 1) * 86400000);
    }
    const days = Math.max(2, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);
    const inc = Array.from({ length: days }, () => 0);
    dated.forEach((x) => {
      const idx = Math.round((startOfDay(x.at).getTime() - start.getTime()) / 86400000);
      if (idx >= 0 && idx < days) inc[idx] += metricValue(x.m, metric);
    });
    let acc = 0;
    const points: SeriesPoint[] = inc.map((v, i) => {
      acc += v;
      return { at: new Date(start.getTime() + i * 86400000), value: acc };
    });
    return { points, total: acc };
  }, [withMetrics, range, metric]);

  const netShares = useMemo(() => {
    const byNet = new Map<string, number>();
    withMetrics.forEach((x) => byNet.set(netKey(x.c), (byNet.get(netKey(x.c)) ?? 0) + x.m.views));
    const total = Array.from(byNet.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(byNet.entries())
      .map(([k, v]) => ({ k, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [withMetrics]);

  const topCreators = useMemo(() => {
    const map = new Map<string, { c: CampaignContent; v: number }>();
    withMetrics.forEach((x) => {
      const cur = map.get(x.c.influencerId);
      map.set(x.c.influencerId, { c: x.c, v: (cur?.v ?? 0) + x.m.views });
    });
    return Array.from(map.values())
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
  }, [withMetrics]);

  const grid = useMemo(() => {
    const list = published.filter((c) => {
      const t = (c.contentType || c.content_type || "").toLowerCase();
      const n = netKey(c);
      return (
        format === "all" ||
        (format === "rl" && (t.includes("reel") || t.includes("short"))) ||
        (format === "st" && t.includes("stor")) ||
        (format === "tk" && n === "tiktok") ||
        (format === "yt" && n === "youtube")
      );
    });
    const v = (c: CampaignContent) => getM(c.id)?.views ?? 0;
    const e = (c: CampaignContent) => getM(c.id)?.engagement ?? 0;
    const d = (c: CampaignContent) => pubDate(c)?.getTime() ?? 0;
    return list
      .slice()
      .sort((a, b) => (sort === "views" ? v(b) - v(a) : sort === "eng" ? e(b) - e(a) : d(b) - d(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published, format, sort, metricsById]);

  const audience = useMemo(() => {
    const nets = audienceByAge?.networks;
    if (!nets) return null;
    const ig = nets.instagram?.has_data ? nets.instagram.age_buckets ?? [] : [];
    const yt = nets.youtube?.has_data ? nets.youtube.age_buckets ?? [] : [];
    if (!ig.length && !yt.length) return null;
    const labels = Array.from(new Set([...ig, ...yt].map((b) => b.label).filter(Boolean))).sort(
      (a, b) => (parseInt(/(\d+)/.exec(a)?.[1] ?? "0", 10)) - (parseInt(/(\d+)/.exec(b)?.[1] ?? "0", 10))
    );
    const pct = (arr: typeof ig, l: string) => arr.find((b) => b.label === l)?.percent ?? 0;
    const top = (arr: typeof ig) =>
      arr.length ? arr.reduce((best, cur) => (cur.percent > best.percent ? cur : best), arr[0]).label : null;
    return {
      labels,
      ig: labels.map((l) => pct(ig, l)),
      yt: labels.map((l) => pct(yt, l)),
      hasIg: ig.length > 0,
      hasYt: yt.length > 0,
      topIg: top(ig),
      topYt: top(yt),
    };
  }, [audienceByAge]);

  const phaseLabel =
    phase === "all"
      ? "Todas as fases"
      : `Fase ${campaignPhases.findIndex((p) => p.id === phase) + 1}`;

  const filteredIdentified =
    phase === "all" ? identifiedPosts : identifiedPosts.filter((p) => p.phaseId === phase);

  const maxPoint = Math.max(...series.points.map((p) => p.value), 1);
  const hasSeries = series.total > 0;
  const maxCity = Math.max(...topCities.map((c) => c.engagement_score), 1);
  const maxAge = Math.max(...(audience ? [...audience.ig, ...audience.yt] : [0]), 1);
  const topMax = topCreators[0]?.v || 1;

  const kpis: Array<[string, string, string, string]> = [
    ["Alcance total", mfmt(kpi.reach), "pessoas alcançadas", "eye"],
    ["Visualizações", mfmt(kpi.views), "views totais", "video"],
    [
      "Engajamento médio",
      kpi.eng ? kpi.eng.toFixed(1).replace(".", ",") + "%" : "—",
      "média por conteúdo",
      "trend",
    ],
    ["Interações", mfmt(kpi.inter), `${mfmt(kpi.shares)} compartilhamentos`, "heart"],
    ["Conteúdos no ar", String(published.length), `${inReview} em andamento`, "check"],
  ];

  const sel = selected;
  const selM = sel ? getM(sel.id) : null;
  const selNet = sel ? netKey(sel) : "";
  const selDate = sel ? pubDate(sel) : null;
  const avg = (k: "reach" | "views" | "likes" | "comments" | "shares" | "engagement") =>
    withMetrics.length ? withMetrics.reduce((a, x) => a + x.m[k], 0) / withMetrics.length : 0;
  const deltaOf = (k: "reach" | "views" | "likes" | "comments" | "shares" | "engagement", v: number) => {
    const a = avg(k);
    if (!a) return null;
    const dl = Math.round((v / a - 1) * 100);
    return (
      <em className={dl >= 0 ? "up" : "dn"}>
        {dl >= 0 ? "+" : ""}
        {dl}% vs média
      </em>
    );
  };
  const selPreview = sel ? getUploadUrl(sel.previewUrl) ?? sel.previewUrl : "";
  const selAvatar = sel ? getUploadUrl(sel.influencerAvatar) ?? sel.influencerAvatar : "";

  return (
    <>
      <div className="pv">
        <div className="mx">
          <div className="mx-kp">
            {kpis.map(([l, v, s, i], k) => (
              <div key={l} className="mx-k" style={{ "--k": k } as React.CSSProperties}>
                <span>
                  <I n={i} cls="sm" />
                </span>
                <small>{l}</small>
                <b>{v}</b>
                <em>{s}</em>
              </div>
            ))}
          </div>

          <div className="mx-r">
            <section className="mx-cd mx-main">
              <div className="mx-hd">
                <div>
                  <h3>Desempenho ao longo do tempo</h3>
                  <p>
                    <b>{mfmt(series.total)}</b> {MT_M[metric][1]}
                  </p>
                </div>
                <div className="gtabs">
                  {RANGES.map(([k, l]) => (
                    <button key={k} className={range === k ? "on" : ""} onClick={() => setRange(k)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mx-mt">
                {(Object.keys(MT_M) as MetricKey[]).map((k) => (
                  <button key={k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>
                    {MT_M[k][0]}
                  </button>
                ))}
              </div>
              <div id="mxcw">
                {tabAnalyticsLoading && !hasSeries ? (
                  <div className="ov-empty">
                    <small>Carregando métricas...</small>
                  </div>
                ) : hasSeries ? (
                  <PerformanceChart key={`${metric}-${range}`} points={series.points} max={maxPoint} />
                ) : (
                  <div className="ov-empty">
                    <b>Sem dados ainda</b>
                    <small>Nenhum conteúdo com métricas neste período.</small>
                  </div>
                )}
              </div>
            </section>

            <aside className="mx-sd">
              <section className="mx-cd">
                <div className="mx-hd">
                  <div>
                    <h3>Por rede social</h3>
                    <p>Participação nas visualizações</p>
                  </div>
                </div>
                <div className="mx-nl">
                  {netShares.length === 0 ? (
                    <div className="ov-empty">
                      <b>Sem dados ainda</b>
                    </div>
                  ) : (
                    netShares.map(({ k, pct }) => (
                      <div key={k} className="mx-nr">
                        <span className="mx-ni">
                          <I n={netIcon(k)} cls="sm" />
                        </span>
                        <b>{netLabel(k)}</b>
                        <i>
                          <u style={{ width: `${pct}%` }} />
                        </i>
                        <em>{pct}%</em>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="mx-cd">
                <div className="mx-hd">
                  <div>
                    <h3>Top criadores</h3>
                    <p>Por visualizações</p>
                  </div>
                </div>
                <div className="mx-tl">
                  {topCreators.length === 0 ? (
                    <div className="ov-empty">
                      <b>Sem dados ainda</b>
                    </div>
                  ) : (
                    topCreators.map(({ c, v }, k) => (
                      <div key={c.influencerId} className="mx-tr">
                        <span className="mx-rk">{k + 1}</span>
                        <Av name={c.influencerName} src={c.influencerAvatar} size={38} />
                        <div>
                          <b>{c.influencerName}</b>
                          <small>{netLabel(netKey(c))}</small>
                        </div>
                        <div className="mx-tb">
                          <i>
                            <u style={{ width: `${Math.round((v / topMax) * 100)}%` }} />
                          </i>
                        </div>
                        <em>{mfmt(v)}</em>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>

          <div className="mx-r" style={{ gridTemplateColumns: audience ? undefined : "minmax(0, 1fr)" }}>
            <section className="mx-cd">
              <div className="mx-hd">
                <div>
                  <h3>Cidades com melhor performance</h3>
                  <p>Por engajamento</p>
                </div>
              </div>
              {tabAnalyticsLoading ? (
                <div className="ov-empty">
                  <small>Carregando cidades...</small>
                </div>
              ) : topCities.length === 0 ? (
                <div className="ov-empty">
                  <b>Sem dados ainda</b>
                  <small>
                    Nenhum dado de cidade ainda (posts identificados com métricas e endereços dos influenciadores).
                  </small>
                </div>
              ) : (
                <div className="mxe-cities">
                  {topCities.map((city, idx) => {
                    const rank = city.rank || idx + 1;
                    const label = [city.city_name, city.state].filter(Boolean).join(" · ") || "—";
                    return (
                      <div key={`${city.city_name}-${city.state}-${rank}`} className="mxe-city">
                        <span className="mx-rk">{rank}</span>
                        <b>{label}</b>
                        <i>
                          <u style={{ width: `${Math.round((city.engagement_score / maxCity) * 100)}%` }} />
                        </i>
                        <em>{mfmt(city.engagement_score)}</em>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {audience && (
              <section className="mx-cd">
                <div className="mx-hd">
                  <div>
                    <h3>Público por idade</h3>
                    <p>
                      {audience.topIg && (
                        <>
                          Maior público Instagram: <b>{audience.topIg.replace(/-/g, "–")} anos</b>
                        </>
                      )}
                      {audience.topIg && audience.topYt && " · "}
                      {audience.topYt && (
                        <>
                          YouTube: <b>{audience.topYt.replace(/-/g, "–")} anos</b>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mxe-lg">
                    {audience.hasIg && (
                      <span>
                        <i style={{ background: "var(--brand)" }} />
                        Instagram
                      </span>
                    )}
                    {audience.hasYt && (
                      <span>
                        <i style={{ background: "var(--ink)" }} />
                        YouTube
                      </span>
                    )}
                  </div>
                </div>
                <div className="mxe-age">
                  {audience.labels.map((l, i) => (
                    <div key={l} className="mxe-ag">
                      <div className="mxe-bars">
                        {audience.hasIg && (
                          <i
                            className="ig"
                            title={`Instagram ${audience.ig[i]}%`}
                            style={{ "--h": `${Math.round((audience.ig[i] / maxAge) * 100)}%` } as React.CSSProperties}
                          />
                        )}
                        {audience.hasYt && (
                          <i
                            className="yt"
                            title={`YouTube ${audience.yt[i]}%`}
                            style={{ "--h": `${Math.round((audience.yt[i] / maxAge) * 100)}%` } as React.CSSProperties}
                          />
                        )}
                      </div>
                      <small>{l}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section className="mx-cd mx-ct">
            <div className="mx-hd">
              <div>
                <h3>Conteúdos publicados</h3>
                <p>{grid.length} conteúdos desta campanha</p>
              </div>
              <div className="mx-tools">
                <div className="gtabs">
                  {FORMATS.map(([k, l]) => (
                    <button key={k} className={format === k ? "on" : ""} onClick={() => setFormat(k)}>
                      {l}
                    </button>
                  ))}
                </div>
                {campaignPhases.length > 0 && (
                  <div className={`cfw${phaseOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      className={`cfb${phase !== "all" ? " on" : ""}`}
                      onClick={() => {
                        setSortOpen(false);
                        setPhaseOpen((o) => !o);
                      }}
                    >
                      {phaseLabel}
                      <I n="chev" />
                    </button>
                    <div className="cfm right">
                      <small className="cfh">Fase</small>
                      {[{ id: "all", label: "Todas as fases" }, ...campaignPhases.map((p, i) => ({ id: p.id, label: `Fase ${i + 1}` }))].map(
                        (o) => (
                          <button
                            key={o.id}
                            type="button"
                            className={phase === o.id ? "on" : ""}
                            onClick={() => {
                              setPhase(o.id);
                              setPhaseOpen(false);
                            }}
                          >
                            {o.label}
                            {phase === o.id && <I n="check" cls="sm" />}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
                <div className={`cfw${sortOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="cfb crso"
                    aria-label="Ordenar"
                    title="Ordenar"
                    onClick={() => {
                      setPhaseOpen(false);
                      setSortOpen((o) => !o);
                    }}
                  >
                    <svg
                      className="ico sm"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m3 16 4 4 4-4" />
                      <path d="M7 20V4" />
                      <path d="m21 8-4-4-4 4" />
                      <path d="M17 4v16" />
                    </svg>
                  </button>
                  <div className="cfm right">
                    <small className="cfh">Ordenar por</small>
                    {SORTS.map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        className={sort === k ? "on" : ""}
                        onClick={() => {
                          setSort(k);
                          setSortOpen(false);
                        }}
                      >
                        {l}
                        {sort === k && <I n="check" cls="sm" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-g">
              {grid.length === 0 ? (
                <div className="ov-empty big" style={{ gridColumn: "1 / -1" }}>
                  <span>
                    <I n="video" />
                  </span>
                  <b>Nenhum conteúdo neste filtro</b>
                  <small>Troque o formato para ver mais publicações.</small>
                </div>
              ) : (
                grid.map((c, k) => {
                  const m = getM(c.id);
                  const d = pubDate(c);
                  const img = getUploadUrl(c.previewUrl) ?? c.previewUrl;
                  const isImg = /stor|feed|image|foto/i.test(c.contentType || "");
                  return (
                    <article
                      key={c.id}
                      className="mx-c"
                      role="button"
                      tabIndex={0}
                      style={{ "--k": Math.min(k, 12), "--bg": THUMB_BG[k % 6] } as React.CSSProperties}
                      onClick={() => {
                        setCopied(false);
                        setSelected(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelected(c);
                      }}
                    >
                      <div className="mx-th">
                        {img && <img className="mxe-img" src={img} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
                        <span className="mx-pl">
                          <I n={isImg ? "image" : "video"} />
                        </span>
                        <div className="mx-bd">
                          <span>{c.contentType || "Conteúdo"}</span>
                          <span className="ok">No ar</span>
                        </div>
                        {m && (
                          <div className="mx-ov">
                            <span>
                              <I n="eye" cls="sm" />
                              {mfmt(m.views)}
                            </span>
                            <span>
                              <I n="heart" cls="sm" />
                              {mfmt(m.likes)}
                            </span>
                            <span>
                              <I n="msg" cls="sm" />
                              {mfmt(m.comments)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mx-ft">
                        <Av name={c.influencerName} src={c.influencerAvatar} size={30} />
                        <div>
                          <b>{c.influencerName}</b>
                          <small>
                            {d ? dayLabel(d) : "—"} · {netLabel(netKey(c))}
                          </small>
                        </div>
                        <em>
                          {m ? mfmt(m.views) : "—"}
                          <small>views</small>
                        </em>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="mx-cd mx-ct">
            <div className="mx-hd">
              <div>
                <h3>Publicações identificadas</h3>
                <p>
                  {filteredIdentified.length} publicação(ões) identificadas automaticamente pelas hashtags das fases
                </p>
              </div>
            </div>
            <div className="mx-g">
              {filteredIdentified.length === 0 ? (
                <div className="ov-empty big" style={{ gridColumn: "1 / -1" }}>
                  <span>
                    <I n="search" />
                  </span>
                  <b>Nenhuma publicação identificada</b>
                  <small>Nenhuma publicação identificada para esta fase.</small>
                </div>
              ) : (
                filteredIdentified.map((p, k) => (
                  <article
                    key={p.id}
                    className="mx-c"
                    role="button"
                    tabIndex={0}
                    style={{ "--k": Math.min(k, 12), "--bg": THUMB_BG[k % 6] } as React.CSSProperties}
                    onClick={() => window.open(p.postUrl, "_blank")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") window.open(p.postUrl, "_blank");
                    }}
                  >
                    <div className="mx-th">
                      {p.previewUrl && (
                        <img className="mxe-img" src={p.previewUrl} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                      <span className="mx-pl">
                        <I n="link" />
                      </span>
                      <div className="mx-bd">
                        <span>{p.phaseHashtag}</span>
                      </div>
                      {p.metrics && (
                        <div className="mx-ov">
                          <span>
                            <I n="eye" cls="sm" />
                            {mfmt(p.metrics.views)}
                          </span>
                          <span>
                            <I n="heart" cls="sm" />
                            {mfmt(p.metrics.likes)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mx-ft">
                      <Av name={p.influencerName} src={p.influencerAvatar} size={30} />
                      <div>
                        <b>{p.influencerName}</b>
                        <small>{new Date(p.publishedAt).toLocaleDateString("pt-BR")}</small>
                      </div>
                      <em>
                        {p.metrics ? mfmt(p.metrics.views) : "—"}
                        <small>views</small>
                      </em>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {sel && (
        <div className="pv">
          <div className="ovb on" onClick={() => setSelected(null)} />
          <div className="ovw">
            <section className="ovd on mxd2" role="dialog" aria-label="Conteúdo">
              <div className="mxm" style={{ "--bg": THUMB_BG[0] } as React.CSSProperties}>
                {selPreview && (
                  <img className="mxe-img" src={selPreview} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                <div className="mx-bd">
                  <span>{sel.contentType || "Conteúdo"}</span>
                  <span className="ok">No ar</span>
                </div>
                {sel.postUrl && (
                  <button
                    type="button"
                    className="mxm-pl"
                    aria-label="Abrir post"
                    onClick={() => window.open(sel.postUrl, "_blank")}
                  >
                    <span>
                      <I n="video" />
                    </span>
                  </button>
                )}
                <div className="mxm-cap">
                  <div className="mxm-u">
                    <Av name={sel.influencerName} src={sel.influencerAvatar} size={28} />
                    <b>{sel.influencerName}</b>
                  </div>
                  {sel.caption && <p>{sel.caption}</p>}
                </div>
              </div>
              <div className="mxr">
                <button className="round mxd-x" aria-label="Fechar" onClick={() => setSelected(null)}>
                  <I n="x" cls="sm" />
                </button>
                <div className="mxr-h">
                  <Av name={sel.influencerName} src={selAvatar} size={52} />
                  <div>
                    <b>{sel.influencerName}</b>
                    <small>
                      <I n={netIcon(selNet)} cls="sm" />
                      {netLabel(selNet)}
                      {selDate ? ` · ${dayLabel(selDate)}` : ""}
                    </small>
                  </div>
                </div>
                {selM ? (
                  <>
                    <div className="mxr-g">
                      {(
                        [
                          ["Alcance", "reach", "eye"],
                          ["Visualizações", "views", "video"],
                          ["Curtidas", "likes", "heart"],
                          ["Comentários", "comments", "msg"],
                          ["Compartilhamentos", "shares", "send"],
                          ["Engajamento", "engagement", "star"],
                        ] as const
                      ).map(([l, k, i]) => (
                        <div key={k}>
                          <small>
                            <I n={i} cls="sm" />
                            {l}
                          </small>
                          <b>{k === "engagement" ? `${selM[k].toFixed(1).replace(".", ",")}%` : mfmt(selM[k])}</b>
                          {deltaOf(k, selM[k])}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ov-empty">
                    <b>Métricas indisponíveis</b>
                    <small>Métricas ainda não disponíveis para este conteúdo.</small>
                  </div>
                )}
                {sel.postUrl && (
                  <div className="mxr-l">
                    <span>
                      <I n="link" cls="sm" />
                    </span>
                    <em>{sel.postUrl.replace(/^https?:\/\//, "")}</em>
                    <button
                      type="button"
                      className={copied ? "ok" : ""}
                      onClick={() => {
                        void navigator.clipboard?.writeText(sel.postUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                    >
                      <I n={copied ? "check" : "copy"} cls="sm" />
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                )}
                <div className="mxd-a">
                  {sel.postUrl && (
                    <button className="btn out" onClick={() => window.open(sel.postUrl, "_blank")}>
                      <I n="link" cls="sm" />
                      Ver post
                    </button>
                  )}
                  <button
                    className="btn out"
                    onClick={() =>
                      navigate({
                        to: "/influencer/$influencerId",
                        params: { influencerId: sel.influencerId },
                      })
                    }
                  >
                    <I n="user" cls="sm" />
                    Ver criador
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
