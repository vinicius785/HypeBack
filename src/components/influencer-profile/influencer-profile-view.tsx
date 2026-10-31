import { useEffect, useState, type ReactNode } from "react";

import { I, Av } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { CampaignInfluencerProfileResponse } from "@/shared/services/influencer";

import "@/styles/prototype-profile.css";

const METRIC_NETWORKS = ["Instagram", "Tiktok", "Youtube"] as const;

const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const TILE_COLORS = ["#e9d3fd", "#dcdcdc", "#cfcfcf", "#f0e1fe", "#d9d9d9", "#e3c4fc"];

function networkTypeToMetricsTab(type: string): (typeof METRIC_NETWORKS)[number] | null {
  switch (type.toLowerCase()) {
    case "instagram": return "Instagram";
    case "tiktok": return "Tiktok";
    case "youtube": return "Youtube";
    default: return null;
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("pt-BR");
}

function socialNetworkUrl(type: string, username: string): string | null {
  const u = username.replace(/^@/, "");
  switch (type.toLowerCase()) {
    case "instagram": return `https://www.instagram.com/${u}`;
    case "tiktok": return `https://www.tiktok.com/@${u}`;
    case "youtube": return `https://www.youtube.com/@${u}`;
    default: return null;
  }
}

/** Plataforma de um conteúdo, deduzida do domínio do link (a API não informa a rede). */
function networkFromUrl(url: string | null | undefined): "instagram" | "tiktok" | "youtube" | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  } catch {
    // link inválido: sem plataforma
  }
  return null;
}

/** Texto de situação vindo da API (`status`), em formato legível. */
function prettyStatus(status: string): string {
  const t = status.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatCampaignDate(dateStr: string | null | undefined): string {
  if (!dateStr || !dateStr.trim()) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function mediaUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("http") ? u : (getUploadUrl(u) ?? u);
}

interface GranularGroup {
  label: string;
  items: Array<{ label: string; value: string | number | undefined | null }>;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  return formatCompact(n);
}

function fmtAvg(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000) return formatCompact(n);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export interface InfluencerProfileViewProps {
  data: CampaignInfluencerProfileResponse;
  /**
   * `private` = backoffice logado (mostra seletor de posts analisados, o botão
   * "Ver avaliação" via `onEvaluate` e os dados de contato). `public` = página
   * compartilhável `/u/:username`: sem seletor, sem avaliações interativas e
   * **sem contato nem endereço de entrega** — é um link que o próprio criador
   * divulga, e e-mail/telefone/endereço ali viram coleta fácil.
   *
   * A API já corta esses campos na rota pública
   * (`stripPrivateContactFields`); esconder aqui é a segunda camada, para o
   * dado não aparecer nem se algum outro caminho voltar a mandá-lo.
   */
  mode: "private" | "public";
  /** Nº de posts analisados (controlado pelo wrapper que dispara o refetch). */
  metricsPosts?: number;
  /** Presente (modo private) → renderiza o seletor "Posts analisados". */
  onMetricsPostsChange?: (n: number) => void;
  /** Presente (modo private) → renderiza "Ver avaliação" nos cards de campanha. */
  onEvaluate?: (campaignId: string, campaignName: string) => void;
  /** Barra superior (`.top`) renderizada dentro do escopo `.pv`, acima do perfil. */
  top?: ReactNode;
  /** Rodapé de ações (`.pf-f`): botões `.btn` do protótipo. */
  footer?: ReactNode;
  /** `page` (padrão) = cartão em página; `drawer` = gaveta lateral sobre a página atual. */
  variant?: "page" | "drawer";
  /** Drawer: fechar (backdrop / botão X). */
  onClose?: () => void;
  /** Drawer: aplica a animação de saída (`out`). */
  closing?: boolean;
}

/**
 * Corpo visual do perfil do influenciador — compartilhado entre a página
 * privada (backoffice) e a pública (`/u/:username`). Visual do perfil `pf-*`
 * do protótipo (escopo `.pv`).
 */
export function InfluencerProfileView({
  data,
  mode,
  metricsPosts = 10,
  onMetricsPostsChange,
  onEvaluate,
  top,
  footer,
  variant = "page",
  onClose,
  closing = false,
}: InfluencerProfileViewProps) {
  const showContactData = mode === "private";
  const [metricsTab, setMetricsTab] = useState<(typeof METRIC_NETWORKS)[number]>("Instagram");

  const availableNetworks = METRIC_NETWORKS.filter(
    (n) => data?.metrics_by_network?.[n.toLowerCase()] != null
  );

  useEffect(() => {
    if (availableNetworks.length > 0 && !availableNetworks.includes(metricsTab)) {
      setMetricsTab(availableNetworks[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableNetworks.join(","), metricsTab]);

  const influencer = data.influencer;
  const name = influencer?.name ?? "Influenciador";

  const nicheName = influencer?.niche_name ?? null;
  const subNicheNames = influencer?.sub_niche_names ?? [];

  const isExternal = influencer?.is_external === true;
  const preRegisteredProfiles = influencer?.pre_registered_social_profiles ?? [];

  const totalPosts = data?.total_posts_in_hypeapp ?? 0;
  const campaignsParticipated = data?.campaigns_participated_in_hypeapp ?? 0;
  const trustIndex = data?.trust_index;
  const topContents = data?.top_contents ?? [];
  const hypeappCampaigns = data?.hypeapp_campaigns ?? [];

  const networkKey = metricsTab.toLowerCase();
  const metrics = data?.metrics_by_network?.[networkKey];

  // Redes com perfil conhecido (abas de rede).
  const TAB_ORDER = ["instagram", "tiktok", "youtube"] as const;
  const socialTypes = new Set<string>();
  if (!isExternal) {
    (influencer.social_networks ?? []).forEach((sn) => {
      if (sn.type) socialTypes.add(sn.type.toLowerCase());
    });
  } else {
    preRegisteredProfiles.forEach((p) => {
      if (p.network) socialTypes.add(p.network.toLowerCase());
    });
  }
  availableNetworks.forEach((n) => socialTypes.add(n.toLowerCase()));
  const tabs = TAB_ORDER.filter((t) => socialTypes.has(t));
  const activeTab = tabs.includes(networkKey as (typeof TAB_ORDER)[number])
    ? (networkKey as (typeof TAB_ORDER)[number])
    : tabs[0];

  const activeSN = !isExternal && activeTab
    ? (influencer.social_networks ?? []).find((sn) => sn.type?.toLowerCase() === activeTab)
    : null;
  // A API devolve `avatar` vazio; a foto vem do perfil na rede (como na lista).
  const avatarSrc =
    activeSN?.photo ||
    influencer.avatar ||
    (influencer.social_networks ?? []).find((sn) => sn.photo)?.photo ||
    undefined;

  // Contas vinculadas ao criador, cada uma com as métricas da própria rede.
  const accountCards = (!isExternal
    ? (influencer.social_networks ?? []).map((sn) => {
        const type = (sn.type ?? "").toLowerCase();
        const m = data?.metrics_by_network?.[type];
        const user = (sn.username ?? "").replace(/^@/, "");
        return {
          key: String(sn.id),
          type,
          label: NETWORK_LABEL[type] ?? (sn.name || sn.type),
          username: user,
          url: user ? socialNetworkUrl(type, user) : null,
          followers: m?.followers ?? sn.members,
          likes: m?.likes,
          reach: m?.average_reach,
          engagement: m?.engagement_percent,
          status: sn.status,
        };
      })
    : preRegisteredProfiles.map((p) => {
        const type = (p.network ?? "").toLowerCase();
        return {
          key: type,
          type,
          label: NETWORK_LABEL[type] ?? p.network,
          username: "",
          url: p.profile_url ?? null,
          followers: undefined as number | undefined,
          likes: undefined as number | undefined,
          reach: undefined as number | undefined,
          engagement: undefined as number | undefined,
          status: undefined as string | undefined,
        };
      })
  )
    // UGC é tipo de conteúdo (etiqueta no cabeçalho), não uma rede social.
    .filter((a) => a.type && a.type !== "ugc")
    // Maior audiência primeiro (mesma ordem dos cartões da listagem).
    .sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1));

  const hasUgc = !isExternal
    ? (influencer.social_networks ?? []).some((sn) => (sn.type ?? "").toLowerCase() === "ugc")
    : preRegisteredProfiles.some((p) => (p.network ?? "").toLowerCase() === "ugc");

  // Ao abrir o perfil, a rede selecionada é a de maior audiência.
  const firstSelectable = accountCards.map((a) => networkTypeToMetricsTab(a.type)).find(Boolean) ?? null;
  const creatorId = influencer?.id;
  useEffect(() => {
    if (firstSelectable) setMetricsTab(firstSelectable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  const locationLabel =
    influencer?.location && typeof influencer.location === "object"
      ? [influencer.location.state, influencer.location.city].filter(Boolean).join(", ")
      : "";

  const ratingLabel =
    influencer?.rating != null && influencer?.rating_max != null
      ? `${influencer.rating} / ${influencer.rating_max}`
      : null;

  // Audiência: gênero (donut) e faixas etárias só quando há dado real.
  const gs = metrics?.gender_split;
  const women = gs?.women_percent != null && Number.isFinite(gs.women_percent) ? gs.women_percent : 0;
  const men = gs?.men_percent != null && Number.isFinite(gs.men_percent) ? gs.men_percent : 0;
  const hasGender = women > 0 || men > 0;

  const audienceNetworks = data?.audience_by_age?.networks ?? (() => {
    const built: Record<string, { has_data: boolean; age_buckets: { label: string; percent: number }[] }> = {};
    for (const net of ["instagram", "tiktok", "youtube"] as const) {
      const split = data?.metrics_by_network?.[net]?.age_split;
      if (split?.length) built[net] = { has_data: true, age_buckets: split };
    }
    return built;
  })();
  const ageNet = audienceNetworks[networkKey]?.has_data
    ? audienceNetworks[networkKey]
    : null;
  const ageBuckets = ageNet?.age_buckets ?? [];
  const hasAge = ageBuckets.length > 0;
  const ageMax = Math.max(1, ...ageBuckets.map((b) => b.percent));

  const granularGroups: GranularGroup[] = (() => {
    if (!metrics) return [];
    if (metricsTab === "Instagram") {
      return [
        {
          label: "Posts",
          items: [
            { label: "Curtidas totais", value: fmt(metrics.posts_likes_sum) },
            { label: "Curtidas médias", value: fmtAvg(metrics.posts_likes_avg) },
            { label: "Views totais", value: fmt(metrics.posts_views_sum) },
            { label: "Views médias", value: fmtAvg(metrics.posts_views_avg) },
            { label: "Posts analisados", value: metrics.posts_fetched ?? "—" },
          ],
        },
        {
          label: "Reels",
          items: [
            { label: "Curtidas totais", value: fmt(metrics.reels_likes_sum) },
            { label: "Curtidas médias", value: fmtAvg(metrics.reels_likes_avg) },
            { label: "Views totais", value: fmt(metrics.reels_views_sum) },
            { label: "Views médias", value: fmtAvg(metrics.reels_views_avg) },
            { label: "Alcance total", value: fmt(metrics.reels_reach_sum) },
            { label: "Alcance médio", value: fmtAvg(metrics.reels_reach_avg) },
          ],
        },
      ];
    }
    if (metricsTab === "Tiktok") {
      return [
        {
          label: "Vídeos",
          items: [
            { label: "Curtidas totais", value: fmt(metrics.tiktok_likes_sum) },
            { label: "Curtidas médias", value: fmtAvg(metrics.tiktok_likes_avg) },
            { label: "Views totais", value: fmt(metrics.tiktok_views_sum) },
            { label: "Views médias", value: fmtAvg(metrics.tiktok_views_avg) },
            { label: "Vídeos analisados", value: metrics.tiktok_fetched ?? "—" },
          ],
        },
      ];
    }
    if (metricsTab === "Youtube") {
      return [
        {
          label: "Shorts (≤ 60s)",
          items: [
            { label: "Curtidas totais", value: fmt(metrics.yt_shorts_likes_sum) },
            { label: "Curtidas médias", value: fmtAvg(metrics.yt_shorts_likes_avg) },
            { label: "Views totais", value: fmt(metrics.yt_shorts_views_sum) },
            { label: "Views médias", value: fmtAvg(metrics.yt_shorts_views_avg) },
            { label: "Shorts analisados", value: metrics.yt_shorts_fetched ?? "—" },
          ],
        },
        {
          label: "Vídeos (> 60s)",
          items: [
            { label: "Curtidas totais", value: fmt(metrics.yt_videos_likes_sum) },
            { label: "Curtidas médias", value: fmtAvg(metrics.yt_videos_likes_avg) },
            { label: "Views totais", value: fmt(metrics.yt_videos_views_sum) },
            { label: "Views médias", value: fmtAvg(metrics.yt_videos_views_avg) },
            { label: "Vídeos analisados", value: metrics.yt_videos_fetched ?? "—" },
          ],
        },
      ];
    }
    return [];
  })();
  const visibleGranular = granularGroups.filter((g) =>
    g.items.some((i) => i.value != null && i.value !== "—"),
  );

  const shipping = influencer.shipping_address;
  const showContact = showContactData && (influencer.email || influencer.phone);
  const showShipping = showContactData && shipping;

  const body = (
      <>
        <div className="pf-hd">
          <Av name={name} src={avatarSrc} size={92} />
          <div className="pf-id">
            <h2>
              {name}
              <I n="verified" cls="sm" />
              {isExternal ? <em className="ext">Externo</em> : null}
            </h2>
            {influencer.app_username ? <p className="pf-hn">@{influencer.app_username}</p> : null}
            <div className="pf-mt">
              {tabs.map((t) => (
                <span key={t}>
                  <I n={t} cls="sm" />
                  {NETWORK_LABEL[t]}
                </span>
              ))}
              {locationLabel ? (
                <span>
                  <I n="flag" cls="sm" />
                  {locationLabel}
                </span>
              ) : null}
              {ratingLabel ? (
                <span className="pf-rt">
                  <I n="star" cls="sm" />
                  <b>{ratingLabel}</b>
                  <em>· Hypeapp</em>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {nicheName || subNicheNames.length > 0 || hasUgc ? (
          <div className="pf-ch">
            {hasUgc ? <span>UGC</span> : null}
            {nicheName ? <span>{nicheName}</span> : null}
            {subNicheNames.map((n: string) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        ) : null}

        <p className="pf-bio" style={{ whiteSpace: "pre-wrap" }}>
          {influencer.bio || (activeSN as { bio?: string | null } | null | undefined)?.bio || "Nenhuma descrição informada."}
        </p>

        {!isExternal ? (
          <section className="pf-s">
            <h3>Visão geral do criador</h3>
            <p className="pf-note">Números do criador na HypeApp, somando todas as redes dele. As métricas de audiência ficam em cada rede.</p>
            <div className="pf-tf">
              <div>
                <small>Campanhas no Hypeapp</small>
                <b>{campaignsParticipated}</b>
              </div>
              <div>
                <small>Publicações no Hypeapp</small>
                <b>{totalPosts}</b>
              </div>
              <div>
                <small>Índice de confiança</small>
                <b>{trustIndex != null ? `${trustIndex}% de audiência real` : "Em análise"}</b>
              </div>
            </div>
          </section>
        ) : null}

        {accountCards.length > 0 ? (
          <section className="pf-s">
            <div className="pf-sh">
              <h3>Redes sociais</h3>
              <small className="pf-gl">
                {accountCards.length} {accountCards.length === 1 ? "conta vinculada" : "contas vinculadas"}
              </small>
            </div>
            <div className="pf-nws">
              {accountCards.map((a) => {
                const tab = networkTypeToMetricsTab(a.type);
                const selectable = !!tab && !isExternal;
                const on = a.type === activeTab;
                return (
                  <div key={a.key} className={`pf-nw${on ? " on" : ""}`}>
                    <button
                      type="button"
                      className="pf-nwb"
                      aria-pressed={selectable ? on : undefined}
                      disabled={!selectable}
                      onClick={() => tab && setMetricsTab(tab)}
                    >
                      <span className="pf-nwh">
                        <I n={a.type} cls="sm" />
                        <b>{a.label}</b>
                        {a.username ? <small>@{a.username}</small> : null}
                        {a.status ? <em>{prettyStatus(a.status)}</em> : null}
                      </span>
                      {!isExternal ? (
                        <span className="pf-nwm">
                          <span>
                            <small>{a.type === "youtube" ? "Inscritos" : "Seguidores"}</small>
                            <b>{a.followers != null ? formatCompact(a.followers) : "—"}</b>
                          </span>
                          <span>
                            <small>Curtidas</small>
                            <b>{a.likes != null ? formatCompact(a.likes) : "—"}</b>
                          </span>
                          <span>
                            <small>Alcance médio</small>
                            <b>{a.reach ? formatCompact(a.reach) : "—"}</b>
                          </span>
                          <span>
                            <small>Engajamento</small>
                            <b>{a.engagement != null ? `${a.engagement}%` : "—"}</b>
                          </span>
                        </span>
                      ) : null}
                    </button>
                    {a.url ? (
                      <a className="pf-nwl" href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${a.label} em nova aba`}>
                        <I n="link" cls="sm" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!isExternal && (visibleGranular.length > 0 || onMetricsPostsChange) ? (
          <section className="pf-s">
            <div className="pf-sh">
              <h3>Métricas{activeTab ? ` · ${NETWORK_LABEL[activeTab]}` : ""}</h3>
              {onMetricsPostsChange ? (
                <div className="gtabs" aria-label="Posts analisados">
                  {[10, 30].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={metricsPosts === n ? "on" : ""}
                      onClick={() => onMetricsPostsChange(n)}
                    >
                      Últimos {n}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {visibleGranular.map((g) => (
              <div key={g.label} style={{ marginTop: 12 }}>
                <small className="pf-gl">{g.label}</small>
                <div className="pf-tf pf-tf-w">
                  {g.items.map((it) => (
                    <div key={it.label}>
                      <small>{it.label}</small>
                      <b>{it.value != null ? it.value : "—"}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!isExternal && (hasGender || hasAge) ? (
          <section className="pf-s">
            <h3>Audiência{activeTab ? ` · ${NETWORK_LABEL[activeTab]}` : ""}</h3>
            <div className={`pf-au ${hasGender && hasAge ? "" : "one"}`}>
              {hasGender ? (
                <div className="pf-gn">
                  <svg viewBox="0 0 36 36" className="pf-do">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#efefef" strokeWidth="5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#9e2cfa"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${((women / Math.max(1, women + men)) * 88).toFixed(1)} 88`}
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <div>
                    <b>{gs?.women_percent != null ? `${gs.women_percent}%` : "—"}</b>
                    <small>mulheres</small>
                    <em>{gs?.men_percent != null ? `${gs.men_percent}% homens` : ""}</em>
                  </div>
                </div>
              ) : null}
              {hasAge ? (
                <div className="pf-bars">
                  {ageBuckets.map((b, k) => (
                    <div key={b.label}>
                      <span>{b.label}</span>
                      <i>
                        <b style={{ width: `${(b.percent / ageMax) * 100}%`, animationDelay: `${k * 80}ms` }} />
                      </i>
                      <em>{b.percent}%</em>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="pf-s">
          <h3>Conteúdos recentes</h3>
          <p className="pf-note">Publicações de todas as redes, com a plataforma de origem.</p>
          {topContents.length > 0 ? (
            <div className="pf-gr">
              {topContents.slice(0, 6).map((c, k) => {
                const thumb = mediaUrl(c.image_url);
                const isVideo = c.is_video === true;
                const style = {
                  "--c": TILE_COLORS[k % TILE_COLORS.length],
                  ...(thumb
                    ? { backgroundImage: `url("${thumb}")`, backgroundSize: "cover", backgroundPosition: "center" }
                    : {}),
                } as React.CSSProperties;
                const origin = networkFromUrl(c.post_url);
                const inner = (
                  <>
                    {origin ? (
                      <span className="pf-or" title={NETWORK_LABEL[origin]}>
                        <I n={origin} cls="sm" />
                        <em className="sr-only">{NETWORK_LABEL[origin]}</em>
                      </span>
                    ) : null}
                    {isVideo || !thumb ? (
                      <span>
                        <I n={isVideo ? "video" : "image"} cls="sm" />
                      </span>
                    ) : null}
                    <small>{c.views != null ? `${formatCompact(c.views)} views` : "—"}</small>
                  </>
                );
                return c.post_url ? (
                  <a
                    key={c.id}
                    className="pf-t"
                    style={style}
                    href={c.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={isVideo ? "Assistir vídeo no app" : "Abrir postagem"}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={c.id} className="pf-t" style={style}>
                    {inner}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pf-cur">
              <small>Nenhum conteúdo identificado ainda.</small>
            </div>
          )}
        </section>

        <section className="pf-s">
          <h3>Histórico de campanhas</h3>
          <p className="pf-note">Todas as campanhas do criador, sem repetir por rede social.</p>
          {hypeappCampaigns.length > 0 ? (
            <div className="pf-hs">
              {hypeappCampaigns.map((c) => {
                const logo = mediaUrl(c.logo_url);
                return (
                  <div key={c.id}>
                    <span className="pf-hc" style={{ overflow: "hidden" }}>
                      {logo ? (
                        <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <I n="mega" cls="sm" />
                      )}
                    </span>
                    <div>
                      <b>{c.campaign_name ?? "—"}</b>
                      <small>
                        {[c.brand_name, formatCampaignDate(c.date)].filter(Boolean).join(" · ")}
                        {" · "}
                        {c.views != null ? formatCompact(c.views) : "0"} views ·{" "}
                        {c.likes != null ? formatCompact(c.likes) : "0"} curtidas
                      </small>
                      {c.description ? (
                        <small style={{ display: "block", marginTop: 2 }}>{c.description}</small>
                      ) : null}
                      {(c.delivery_thumbnails?.length ?? 0) > 0 ? (
                        <div className="pf-dl">
                          {c.delivery_thumbnails!.slice(0, 5).map((t, i) => (
                            <img key={i} src={mediaUrl(t) ?? ""} alt="" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <em>
                      {c.rating != null ? (
                        <>
                          <I n="star" cls="sm" />
                          {String(c.rating).replace(".", ",")}
                        </>
                      ) : (
                        "—"
                      )}
                    </em>
                    {onEvaluate ? (
                      <button
                        type="button"
                        className="btn out pf-ev"
                        disabled={c.rating == null}
                        title={c.rating == null ? "Ainda não avaliado" : "Ver avaliação"}
                        onClick={() => onEvaluate(c.id, c.campaign_name ?? "Campanha")}
                      >
                        <I n="eye" cls="sm" />
                        Ver avaliação
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pf-cur">
              <small>Nenhuma campanha no momento.</small>
            </div>
          )}
        </section>

        {showContact ? (
          <section className="pf-s">
            <h3>Contato</h3>
            <div className="pf-tf pf-tf-2">
              {influencer.email ? (
                <div>
                  <small>E-mail</small>
                  <b>
                    <a href={`mailto:${influencer.email}`} style={{ wordBreak: "break-all" }}>
                      {influencer.email}
                    </a>
                  </b>
                </div>
              ) : null}
              {influencer.phone ? (
                <div>
                  <small>Telefone</small>
                  <b>
                    <a href={`tel:${influencer.phone}`}>{influencer.phone}</a>
                  </b>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {showShipping && shipping ? (
          <section className="pf-s">
            <h3>Endereço de entrega (permuta/produto)</h3>
            <div className="pf-cur" style={{ display: "block", lineHeight: 1.6, fontSize: 14 }}>
              <div>
                {shipping.street}, {shipping.number}
                {shipping.complement ? ` — ${shipping.complement}` : ""}
              </div>
              <div>
                {shipping.neighborhood} · {shipping.city}/{shipping.state}
              </div>
              <div>CEP {shipping.zip}</div>
            </div>
          </section>
        ) : null}
      </>
  );

  if (variant === "drawer") {
    return (
      <div className="pv">
        <div className={`ovb on${closing ? " out" : ""}`} onClick={onClose} />
        <aside className={`ovp pf on${closing ? " out" : ""}`} role="dialog" aria-label="Perfil do criador">
          <button type="button" className="round ov-x" onClick={onClose} aria-label="Fechar">
            <I n="x" cls="sm" />
          </button>
          <div className="pf-sc">{body}</div>
          {footer ? <div className="pf-f">{footer}</div> : null}
        </aside>
      </div>
    );
  }

  const card = (
    <div className="pf-card">
      <div className="pf-sc">{body}</div>
      {footer ? <div className="pf-f">{footer}</div> : null}
    </div>
  );

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        {top}
        {card}
      </div>
    </div>
  );
}
