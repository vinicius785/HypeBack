import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { I, Av } from "@/components/prototype/ui";
import { CampaignPickerModal } from "@/components/influencer-lists/campaign-picker-modal";
import { ListMembershipModal } from "@/components/influencer-lists/list-membership-modal";
import { InfluencerProfileDrawer } from "@/components/influencer-profile/profile-drawer";
import { useWorkspaceContext, useWorkspacePermissions } from "@/contexts/workspace-context";
import { useNiches } from "@/hooks/use-niches";
import { useInfluencerLists, useInfluencerList, useInfluencerMembershipMap } from "@/hooks/use-influencer-lists";
import {
  useCreatorsCatalog,
  useCreateInfluencerList,
  useUpdateInfluencerList,
  useDeleteInfluencerList,
  useAddToInfluencerList,
  useRemoveFromInfluencerList,
} from "@/hooks/use-creators-catalog";
import { useInfluencerAccounts } from "@/hooks/use-influencer-accounts";
import { InviteNetworksModal } from "@/components/influencer-lists/invite-networks-modal";
import { groupCreators, isSocialNetworkType, type CreatorGroup } from "@/shared/utils/group-creators";
import type {
  CatalogItem,
  CatalogOrderBy,
  CatalogOrderDir,
  CatalogSocialNetwork,
} from "@/shared/services/creators-catalog";
import type { Niche } from "@/shared/types";

// Lazy: o Leaflet (~130kB) só baixa quando o usuário ativa "Perto de mim".
const NearMeMap = lazy(() =>
  import("@/components/creators/near-me-map").then((m) => ({ default: m.NearMeMap })),
);

export const Route = createFileRoute("/(private)/(app)/creators")({
  component: RouteComponent,
});

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ActiveTab = "catalog" | "lists";
type FilterKey = "net" | "niche" | "uf" | "gen" | "fol" | "eng";
type Opt = [value: string, label: string];

interface CatalogFilters {
  q: string;
  net: string;
  niche: string;
  uf: string;
  gen: string;
  fol: string;
  eng: string;
  /** Valor combinado "campo_direção" (ex.: "followers_desc"); "" = padrão. */
  sort: string;
}

const EMPTY_FILTERS: CatalogFilters = {
  q: "",
  net: "all",
  niche: "",
  uf: "",
  gen: "",
  fol: "",
  eng: "",
  sort: "",
};

/** UGC é tipo de conteúdo (mesmo parâmetro `social_network` da API), não uma rede. */
const CONTENT_OPTS: Opt[] = [
  ["", "Qualquer"],
  ["ugc", "UGC"],
];

const FILTER_KEYS: FilterKey[] = ["net", "niche", "uf", "gen", "fol", "eng"];

const FILTER_LABEL: Record<FilterKey, string> = {
  net: "Rede",
  niche: "Nicho",
  uf: "Estado",
  gen: "Gênero",
  fol: "Seguidores",
  eng: "Engajamento",
};

const UFS: Opt[] = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
  ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
  ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
];

const STATIC_OPTS: Record<Exclude<FilterKey, "niche">, Opt[]> = {
  net: [
    ["all", "Todas as redes"],
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
  ],
  uf: [["", "Todo o Brasil"], ...UFS.map(([k, v]): Opt => [k, `${k} · ${v}`])],
  gen: [
    ["", "Todos"],
    ["female", "Feminino"],
    ["male", "Masculino"],
    ["other", "Outro"],
    ["prefer_not_to_say", "Prefiro não dizer"],
  ],
  fol: [
    ["", "Qualquer tamanho"],
    ["a", "Até 20 mil"],
    ["b", "20 a 50 mil"],
    ["c", "50 a 100 mil"],
    ["d", "100 mil ou mais"],
  ],
  eng: [
    ["", "Qualquer"],
    ["2", "2% ou mais"],
    ["4", "4% ou mais"],
    ["6", "6% ou mais"],
  ],
};

/** Faixas de seguidores do protótipo → filtros do servidor. */
const FOLLOWER_RANGES: Record<string, { min?: number; max?: number }> = {
  a: { max: 20_000 },
  b: { min: 20_000, max: 50_000 },
  c: { min: 50_000, max: 100_000 },
  d: { min: 100_000 },
};

const SORT_OPTIONS: Opt[] = [
  ["", "Relevância"],
  ["followers_desc", "Seguidores (maior)"],
  ["followers_asc", "Seguidores (menor)"],
  ["engagement_desc", "Engajamento (maior)"],
  ["engagement_asc", "Engajamento (menor)"],
  ["name_asc", "Nome (A–Z)"],
  ["recent_desc", "Mais recentes"],
];

const NET_ICON: Record<string, string> = {
  instagram: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
};

/** Quebra o valor combinado de ordenação em campo + direção para a API. */
function parseOrder(order: string): {
  order_by?: CatalogOrderBy;
  order_dir?: CatalogOrderDir;
} {
  if (!order) return {};
  const idx = order.lastIndexOf("_");
  if (idx <= 0) return {};
  return {
    order_by: order.slice(0, idx) as CatalogOrderBy,
    order_dir: order.slice(idx + 1) as CatalogOrderDir,
  };
}

function fmtFollowers(n: number): string {
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} mi`;
  if (n >= 1_000) return `${n >= 100_000 ? Math.round(n / 1_000) : trim(n / 1_000)} mil`;
  return String(n);
}

function fmtEngagement(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1).replace(".", ",")}%`;
}

function fmtDistance(km: number): string {
  return `${km >= 10 ? Math.round(km) : km.toFixed(1).replace(".", ",")} km`;
}


// ---------------------------------------------------------------------------
// "Perto de mim" — geolocalização do admin via Geolocation API
// ---------------------------------------------------------------------------

const RADIUS_OPTIONS = [10, 25, 50, 100, 200];

const DEFAULT_RADIUS_KM = 50;

/** Chave antiga em que a posição era guardada; só é apagada (privacidade). */
const LEGACY_NEAR_ME_KEY = "hypeapp:near-me-location:v1";

interface NearMeLocation {
  lat: number;
  lng: number;
}

type GeoResult = { ok: true; loc: NearMeLocation } | { ok: false; message: string };

/**
 * Pede a localização atual (precisão baixa: basta para "perto de mim").
 * Nunca é guardada: o filtro só existe enquanto o usuário o mantém na tela.
 */
function requestLocation(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, message: "Seu navegador não permite obter a localização." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, loc: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (err) =>
        resolve({
          ok: false,
          message:
            err.code === err.PERMISSION_DENIED
              ? "Permissão negada. Libere a localização nas configurações do navegador e tente de novo."
              : "Não foi possível obter sua localização agora. Tente novamente.",
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}


// ---------------------------------------------------------------------------
// Shell da página (cabeçalho + abas) — marcação do protótipo
// ---------------------------------------------------------------------------

function PageShell({
  tab,
  setTab,
  canLists,
  exploreCount,
  listCount,
  children,
}: {
  tab: ActiveTab;
  setTab: (t: ActiveTab) => void;
  canLists: boolean;
  exploreCount?: number;
  listCount?: number;
  children: React.ReactNode;
}) {
  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);

  const moveInd = useCallback(() => {
    const on = segRef.current?.querySelector<HTMLElement>("button.on");
    const ind = indRef.current;
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }, []);

  useLayoutEffect(() => {
    moveInd();
  }, [moveInd, tab, exploreCount, listCount, canLists]);

  useEffect(() => {
    window.addEventListener("resize", moveInd);
    return () => window.removeEventListener("resize", moveInd);
  }, [moveInd]);

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        <div className="head fade crhd">
          <div>
            <h1>Criadores</h1>
            <p>Descubra, salve e convide perfis para as suas campanhas.</p>
          </div>
        </div>
        <div className="tools fade crt">
          <div className="seg" id="crseg" ref={segRef}>
            <i className="ind" ref={indRef} />
            <button type="button" className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>
              Explorar
              {exploreCount != null && <em>{exploreCount}</em>}
            </button>
            {canLists && (
              <button type="button" className={tab === "lists" ? "on" : ""} onClick={() => setTab("lists")}>
                Minhas listas
                {listCount != null && <em>{listCount}</em>}
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de filtros (gaveta lateral com aplicação explícita)
// ---------------------------------------------------------------------------

type DraftKey = Exclude<FilterKey, never>;

interface FilterDraft {
  net: string;
  niche: string;
  uf: string;
  gen: string;
  fol: string;
  eng: string;
  near: NearMeLocation | null;
  radius: number;
}

const draftCount = (d: FilterDraft) =>
  FILTER_KEYS.filter((k) => d[k as DraftKey] && d[k as DraftKey] !== "all").length + (d.near ? 1 : 0);

function PillGroup({
  label,
  opts,
  value,
  onPick,
}: {
  label: string;
  opts: Opt[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="cf-pills" role="radiogroup" aria-label={label}>
      {opts.map(([v, l]) => (
        <button key={v || "any"} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onPick(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

const CLOSE_MS = 300;

function FiltersDrawer({
  initial,
  nicheOpts,
  onApply,
  onClose,
}: {
  initial: FilterDraft;
  nicheOpts: Opt[];
  onApply: (d: FilterDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterDraft>(initial);
  const [closing, setClosing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const asideRef = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    asideRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const set = <K extends keyof FilterDraft>(k: K, v: FilterDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const useMyLocation = async () => {
    setLocating(true);
    setGeoError("");
    const res = await requestLocation();
    setLocating(false);
    if (res.ok) set("near", res.loc);
    else setGeoError(res.message);
  };

  const clear = () => {
    setGeoError("");
    setDraft({ net: "all", niche: "", uf: "", gen: "", fol: "", eng: "", near: null, radius: DEFAULT_RADIUS_KM });
  };

  const n = draftCount(draft);
  const cls = closing ? " out" : "";

  return createPortal(
    <div className="pv">
      <div className={`ovb on${cls}`} onClick={close} />
      <aside ref={asideRef} className={`ovp cf on${cls}`} role="dialog" aria-modal="true" aria-label="Filtros de criadores">
        <div className="ov-h">
          <div>
            <h2>Filtros</h2>
            <small>{n > 0 ? `${n} ${n === 1 ? "filtro selecionado" : "filtros selecionados"}` : "Nenhum filtro selecionado"}</small>
          </div>
          <button type="button" className="round" onClick={close} aria-label="Fechar filtros">
            <I n="x" cls="sm" />
          </button>
        </div>

        <div className="ov-s cf-b">
          <section className="cf-g">
            <h3>Redes sociais</h3>
            <PillGroup label="Rede social" opts={STATIC_OPTS.net} value={draft.net} onPick={(v) => set("net", v)} />
          </section>

          <section className="cf-g">
            <h3>Tipo de conteúdo</h3>
            <PillGroup
              label="Tipo de conteúdo"
              opts={CONTENT_OPTS}
              value={draft.net === "ugc" ? "ugc" : ""}
              onPick={(v) => set("net", v === "ugc" ? "ugc" : draft.net === "ugc" ? "all" : draft.net)}
            />
            <small className="cf-hint">UGC é um tipo de conteúdo, não uma rede. Escolhê-lo troca a rede selecionada.</small>
          </section>

          <section className="cf-g">
            <h3>Nicho</h3>
            <label className="cf-sel">
              <span className="sr-only">Nicho</span>
              <select value={draft.niche} onChange={(e) => set("niche", e.target.value)}>
                {nicheOpts.map(([v, l]) => (
                  <option key={v || "all"} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <I n="chev" cls="sm" />
            </label>
          </section>

          <section className="cf-g">
            <h3>Localização</h3>
            <label className="cf-sel">
              <span className="sr-only">Estado</span>
              <select value={draft.uf} onChange={(e) => set("uf", e.target.value)}>
                {STATIC_OPTS.uf.map(([v, l]) => (
                  <option key={v || "all"} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <I n="chev" cls="sm" />
            </label>

            <div className="cf-near">
              {draft.near ? (
                <>
                  <div className="cf-nh">
                    <span>
                      <I n="locate" cls="sm" /> Perto de você
                    </span>
                    <button type="button" className="lnk" onClick={() => set("near", null)}>
                      Remover
                    </button>
                  </div>
                  <small>Raio de busca</small>
                  <PillGroup
                    label="Raio de busca"
                    opts={RADIUS_OPTIONS.map((v): Opt => [String(v), `${v} km`])}
                    value={String(draft.radius)}
                    onPick={(v) => set("radius", Number(v))}
                  />
                </>
              ) : (
                <>
                  <button type="button" className="btn out" disabled={locating} onClick={useMyLocation}>
                    <I n="locate" cls="sm" />
                    {locating ? "Localizando…" : "Buscar perto de mim"}
                  </button>
                  <small>Usa a localização aproximada deste navegador. Ela não é guardada.</small>
                </>
              )}
              {geoError && (
                <small className="cf-err" role="alert">
                  {geoError}
                </small>
              )}
            </div>
          </section>

          <section className="cf-g">
            <h3>Perfil demográfico</h3>
            <PillGroup label="Gênero" opts={STATIC_OPTS.gen} value={draft.gen} onPick={(v) => set("gen", v)} />
          </section>

          <section className="cf-g">
            <h3>Audiência</h3>
            <PillGroup label="Quantidade de seguidores" opts={STATIC_OPTS.fol} value={draft.fol} onPick={(v) => set("fol", v)} />
          </section>

          <section className="cf-g">
            <h3>Desempenho</h3>
            <PillGroup label="Engajamento" opts={STATIC_OPTS.eng} value={draft.eng} onPick={(v) => set("eng", v)} />
          </section>
        </div>

        <div className="cf-f">
          <button type="button" className="btn out" onClick={clear} disabled={n === 0}>
            Limpar filtros
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onApply(draft);
              close();
            }}
          >
            Aplicar filtros
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Cards / linhas
// ---------------------------------------------------------------------------

interface CardProps {
  group: CreatorGroup;
  k: number;
  selected: boolean;
  near: boolean;
  saved: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onInvite: () => void;
  onSave: () => void;
}

const NET_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  ugc: "UGC",
};

const netLabel = (sn: CatalogSocialNetwork) => NET_LABEL[sn.type] ?? (sn.name || sn.type || "Rede");

/** Foto do criador: a do usuário, ou a da primeira conta de rede que tiver uma. */
const groupPhoto = (g: CreatorGroup) =>
  g.user.photo ?? g.accounts.find((a) => a.social_network.photo)?.social_network.photo ?? undefined;

const MAX_NETWORK_ROWS = 3;

interface AccountRow {
  id: string;
  type: string;
  label: string;
  username: string;
  members: number;
  engagement: number | null;
}

/**
 * Contas do criador para o cartão. Começa com as que o catálogo já trouxe e,
 * assim que a lista completa chega (endpoint de perfis, com cache), passa a
 * mostrar todas — a paginação do catálogo é por conta, não por pessoa.
 */
function useAccountRows(group: CreatorGroup): { networks: AccountRow[]; ugc: boolean } {
  const { data } = useInfluencerAccounts(group.user.id);
  return useMemo(() => {
    let rows: AccountRow[];
    if (data && data.length > 0) {
      rows = [...data]
        .sort((a, b) => b.members - a.members)
        .map((p) => {
          const fromCatalog = group.accounts.find((a) => String(a.social_network.id) === p.id)?.social_network;
          return {
            id: p.id,
            type: p.type.toLowerCase(),
            label: NET_LABEL[p.type.toLowerCase()] ?? (p.type_label || p.type),
            username: p.username,
            members: p.members || fromCatalog?.members || 0,
            engagement: p.engagement_percent ?? fromCatalog?.engagement_percent ?? null,
          };
        });
    } else {
      rows = group.accounts.map(({ social_network: sn }) => ({
        id: String(sn.id),
        type: sn.type,
        label: netLabel(sn),
        username: sn.username,
        members: sn.members,
        engagement: sn.engagement_percent,
      }));
    }
    // UGC é tipo de conteúdo: vira uma etiqueta, não uma linha de rede social.
    return { networks: rows.filter((r) => isSocialNetworkType(r.type)), ugc: rows.some((r) => !isSocialNetworkType(r.type)) };
  }, [data, group.accounts]);
}

function CreatorCard({ group, k, selected, near, saved, onSelect, onOpen, onInvite, onSave }: CardProps) {
  const names = group.niches.map((n) => n.name).filter((s) => s.trim().length > 0);
  const { networks: rows, ugc } = useAccountRows(group);
  const shown = rows.slice(0, MAX_NETWORK_ROWS);
  const hidden = rows.length - shown.length;
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article className={`crd ${selected ? "sel" : ""}`} style={{ "--k": Math.min(k, 14) } as React.CSSProperties} onClick={onOpen}>
      <button type="button" className={`crd-ck ${selected ? "on" : ""}`} aria-label={`Selecionar ${group.user.name}`} aria-pressed={selected} onClick={stop(onSelect)}>
        <I n="check" cls="sm" />
      </button>
      <div className="crd-h">
        <Av name={group.user.name} src={groupPhoto(group)} size={60} />
        <div>
          <b>{group.user.name}</b>
          <small>
            {rows.length === 0 ? "Sem redes sociais" : `${rows.length} ${rows.length === 1 ? "rede social" : "redes sociais"}`}
          </small>
        </div>
      </div>
      <div className="crd-n">
        {ugc && <span className="crd-ugc">UGC</span>}
        {names.slice(0, 2).map((n) => (
          <span key={n}>{n}</span>
        ))}
        {names.length > 2 && <span>+{names.length - 2}</span>}
        {near && group.distance_km != null && (
          <span className="crd-d">
            <I n="flag" cls="sm" />
            {fmtDistance(group.distance_km)}
          </span>
        )}
      </div>
      {rows.length > 0 ? (
      <ul className="crd-nw" aria-label="Redes sociais do criador">
        {shown.map((a) => (
          <li key={a.id}>
            <span className="crd-ni" title={a.label}>
              <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
            </span>
            <span className="crd-nu">
              <b>{a.label}</b>
              <small>@{a.username}</small>
            </span>
            <span className="crd-nv">
              <b>{fmtFollowers(a.members)}</b>
              <small>{fmtEngagement(a.engagement)} eng.</small>
            </span>
          </li>
        ))}
        {hidden > 0 && <li className="crd-nm">+{hidden} {hidden === 1 ? "rede" : "redes"} no perfil</li>}
      </ul>
      ) : null}
      <div className="crd-a">
        <button type="button" className="btn out" onClick={stop(onOpen)}>
          Ver perfil
        </button>
        <button type="button" className="btn" onClick={stop(onInvite)}>
          Convidar
        </button>
        <button type="button" className={`round crd-sv ${saved ? "on" : ""}`} aria-label="Salvar em lista" onClick={stop(onSave)}>
          <I n="heart" cls="sm" />
        </button>
      </div>
    </article>
  );
}

function CreatorRow({ group, k, selected, near, saved, onSelect, onOpen, onInvite, onSave }: CardProps) {
  const { networks: rows, ugc } = useAccountRows(group);
  const names = group.niches.map((n) => n.name).filter((s) => s.trim().length > 0);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={`crw ${selected ? "sel" : ""}`} style={{ "--k": Math.min(k, 14) } as React.CSSProperties} onClick={onOpen}>
      <button type="button" className={`crd-ck ${selected ? "on" : ""}`} aria-label={`Selecionar ${group.user.name}`} aria-pressed={selected} onClick={stop(onSelect)}>
        <I n="check" cls="sm" />
      </button>
      <div className="crw-i">
        <Av name={group.user.name} src={groupPhoto(group)} size={44} />
        <div>
          <b>{group.user.name}</b>
          <small>
            {rows.length === 0 ? "Sem redes sociais" : `${rows.length} ${rows.length === 1 ? "rede social" : "redes sociais"}`}
          </small>
        </div>
      </div>
      <span className="crw-n">{[...(ugc ? ["UGC"] : []), ...names].join(" · ")}</span>
      <span className="crw-nets">
        {rows.map((a) => (
          <span key={a.id} title={`${a.label} · @${a.username} · ${fmtEngagement(a.engagement)} de engajamento`}>
            <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
            <b>{fmtFollowers(a.members)}</b>
          </span>
        ))}
      </span>
      <span className="crw-v">
        {near && group.distance_km != null ? (
          <>
            <b>{fmtDistance(group.distance_km)}</b>
            <small>de você</small>
          </>
        ) : null}
      </span>
      <span className="crw-a">
        <button type="button" className={`round crd-sv ${saved ? "on" : ""}`} aria-label="Salvar em lista" onClick={stop(onSave)}>
          <I n="heart" cls="sm" />
        </button>
        <button type="button" className="btn out" onClick={stop(onOpen)}>
          Ver perfil
        </button>
        <button type="button" className="btn" onClick={stop(onInvite)}>
          Convidar
        </button>
      </span>
    </div>
  );
}

function CardSkeleton({ k }: { k: number }) {
  return (
    <div className="crd" style={{ "--k": k, cursor: "default" } as React.CSSProperties}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Skeleton className="size-[60px] rounded-full" />
        <div style={{ flex: 1 }}>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-7 w-2/3 rounded-full" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Salvar vários criadores em uma lista (barra de seleção)
// ---------------------------------------------------------------------------

function BulkSaveModal({
  userIds,
  onClose,
}: {
  userIds: number[];
  onClose: () => void;
}) {
  const { data: lists = [], isLoading } = useInfluencerLists();
  const addMutation = useAddToInfluencerList();
  const [busy, setBusy] = useState(false);

  async function handlePick(listId: string) {
    setBusy(true);
    try {
      for (const userId of userIds) {
        await addMutation.mutateAsync({ listId, userId });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Salvar em lista" panelClassName="max-w-md">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-500">
          Adicionar {userIds.length} {userIds.length === 1 ? "criador" : "criadores"} a qual lista?
        </p>
        {isLoading ? (
          <Skeleton className="h-12 w-full rounded-2xl" />
        ) : lists.length === 0 ? (
          <p className="text-sm text-neutral-500">Você ainda não tem listas. Crie uma em "Minhas listas".</p>
        ) : (
          lists.map((l) => (
            <Button
              key={l.id}
              variant="outline"
              className="h-12 justify-between rounded-2xl"
              disabled={busy}
              onClick={() => handlePick(l.id)}
            >
              <span className="truncate">{l.name}</span>
              <span className="text-xs text-neutral-400">{l.influencer_count}</span>
            </Button>
          ))
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Catalog Tab
// ---------------------------------------------------------------------------

interface SelectedForList {
  userId: number;
  name: string;
}

interface InviteTarget {
  userId: number;
  name: string;
  /** Contas já carregadas do criador (reserva do seletor de redes). */
  accounts: CatalogItem[];
  /** Contas escolhidas para o convite; ausente = ainda vai perguntar. */
  profileIds?: string[];
}

function CatalogTab({ onTotal }: { onTotal: (n: number | undefined) => void }) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<"grid" | "list" | "map">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedForList, setSelectedForList] = useState<SelectedForList | null>(null);
  const [bulkSave, setBulkSave] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const membershipMap = useInfluencerMembershipMap();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // "Perto de mim" é um critério de busca: só existe quando o usuário o liga
  // (painel de filtros ou mapa). A posição não é guardada entre visitas.
  const [nearMeLocation, setNearMeLocation] = useState<NearMeLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [mapLocating, setMapLocating] = useState(false);
  const [mapGeoError, setMapGeoError] = useState("");

  useEffect(() => {
    // Remove a posição que versões anteriores deixaram salva no navegador.
    try {
      localStorage.removeItem(LEGACY_NEAR_ME_KEY);
    } catch {
      // localStorage indisponível: nada a limpar.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Fecha o menu de ordenação ao clicar fora.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.(".cfw")) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  const queryFilters = useMemo(() => {
    const range = FOLLOWER_RANGES[filters.fol];
    return {
      q: debouncedQ || undefined,
      social_network: filters.net !== "all" ? filters.net : undefined,
      niche: filters.niche ? Number(filters.niche) : undefined,
      state: filters.uf || undefined,
      followers_min: range?.min,
      followers_max: range?.max,
      gender: filters.gen || undefined,
      engagement_min: filters.eng ? Number(filters.eng) : undefined,
      ...parseOrder(filters.sort),
      ...(nearMeLocation
        ? { lat: nearMeLocation.lat, lng: nearMeLocation.lng, radius_km: radiusKm }
        : {}),
    };
  }, [debouncedQ, filters, nearMeLocation, radiusKm]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useCreatorsCatalog(queryFilters);

  const { data: niches = [] } = useNiches();

  const nicheOpts = useMemo<Opt[]>(() => {
    const topLevel = (niches as Niche[]).filter((n) => !n.parent_id);
    return [["", "Todos os nichos"], ...topLevel.map((n): Opt => [String(n.id), n.name])];
  }, [niches]);

  const optsFor = useCallback(
    (k: FilterKey): Opt[] =>
      k === "niche" ? nicheOpts : k === "net" ? [...STATIC_OPTS.net, ["ugc", "Conteúdo UGC"]] : STATIC_OPTS[k],
    [nicheOpts],
  );

  // O catálogo vem por conta de rede social; a tela mostra pessoas (agrupadas
  // por `user.id`, o vínculo que a API já informa).
  const accountItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const creators = useMemo(() => groupCreators(accountItems), [accountItems]);

  // Um item por criador no mapa (a conta com localização aproximada).
  const mapItems = useMemo(
    () =>
      creators.map((c) => ({
        ...(c.accounts.find((a) => a.approx_location) ?? c.accounts[0]),
        distance_km: c.distance_km,
      })),
    [creators],
  );
  const nearMeLocatedCount = useMemo(() => mapItems.filter((i) => i.approx_location).length, [mapItems]);

  // O número de criadores só é exato quando todas as páginas já foram carregadas
  // (a API conta contas de rede social, não pessoas).
  const creatorsExact = !isLoading && !hasNextPage;
  useEffect(() => {
    onTotal(creatorsExact ? creators.length : undefined);
  }, [creatorsExact, creators.length, onTotal]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Grade e lista: rolagem infinita (carrega antes de o fim aparecer). O observador é recriado a
  // cada página para disparar de novo quando o fim da lista ainda está à vista.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || view === "map") return;
    // A margem só vale em relação à raiz: usa o contêiner que rola (o <main>), não a janela.
    let root: HTMLElement | null = el.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) handleLoadMore();
      },
      { root, rootMargin: "900px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, view, accountItems.length]);

  // Mapa: traz todos os criadores do filtro, sem botão.
  useEffect(() => {
    if (view === "map" && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [view, hasNextPage, isFetchingNextPage, fetchNextPage, accountItems.length]);

  function setFilter<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * O mapa só existe com "Perto de mim". Ao tirar o filtro estando nele, volta para os cartões
   * em vez de cair no convite para usar a localização (que a pessoa acabou de remover).
   */
  function removeNearMe() {
    setNearMeLocation(null);
    setView((v) => (v === "map" ? "grid" : v));
  }

  /** Remove todos os critérios (mantém a ordenação escolhida e a visualização, exceto o mapa). */
  function clearCriteria() {
    setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }));
    if (nearMeLocation) removeNearMe();
    setRadiusKm(DEFAULT_RADIUS_KM);
  }

  function toggleSel(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const openProfile = (userId: number) => setProfileId(String(userId));

  const applyDraft = (d: FilterDraft) => {
    setFilters((prev) => ({ ...prev, net: d.net, niche: d.niche, uf: d.uf, gen: d.gen, fol: d.fol, eng: d.eng }));
    if (nearMeLocation && !d.near) removeNearMe();
    else setNearMeLocation(d.near);
    setRadiusKm(d.radius);
  };

  const enableNearFromMap = async () => {
    setMapLocating(true);
    setMapGeoError("");
    const res = await requestLocation();
    setMapLocating(false);
    if (res.ok) setNearMeLocation(res.loc);
    else setMapGeoError(res.message);
  };

  const activeKeys = FILTER_KEYS.filter((k) => filters[k] && filters[k] !== "all");
  const nearOn = !!nearMeLocation;
  const activeCount = activeKeys.length + (nearOn ? 1 : 0);
  const selectedCreators = creators.filter((c) => selected.has(c.key));
  const sortActive = !!filters.sort;
  const sortLabel = SORT_OPTIONS.find((s) => s[0] === filters.sort)?.[1] ?? "Relevância";
  const searching = !!debouncedQ;
  // Sem contagem de resultados: o catálogo pagina por conta de rede social, então
  // qualquer número seria de contas ou de criadores parcialmente carregados.
  const contextLine = [
    nearOn ? `Num raio de ${radiusKm} km da sua localização` : "",
    activeKeys.length > 0 ? `${activeKeys.length} ${activeKeys.length === 1 ? "filtro aplicado" : "filtros aplicados"}` : "",
    searching ? `Busca por “${debouncedQ}”` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const renderItem = (group: CreatorGroup, k: number) => {
    const props: CardProps = {
      group,
      k,
      selected: selected.has(group.key),
      near: nearOn,
      saved: (membershipMap.get(group.user.id) ?? []).length > 0,
      onSelect: () => toggleSel(group.key),
      onOpen: () => openProfile(group.user.id),
      onInvite: () => setInviteTarget({ userId: group.user.id, name: group.user.name, accounts: group.accounts }),
      onSave: () => setSelectedForList({ userId: group.user.id, name: group.user.name }),
    };
    return view === "list" ? <CreatorRow key={group.key} {...props} /> : <CreatorCard key={group.key} {...props} />;
  };

  const VIEWS: Array<["grid" | "list" | "map", string, string]> = [
    ["grid", "grid", "Cartões"],
    ["list", "list", "Lista"],
    ["map", "map", "Mapa"],
  ];

  return (
    <>
      <>
        <div id="crfb" className="fade cx-bar">
          <label className="cx-find">
            <I n="search" cls="sm" />
            <input
              type="search"
              placeholder="Buscar criador por nome, @ ou palavra-chave"
              aria-label="Buscar criador"
              value={filters.q}
              autoComplete="off"
              onChange={(e) => setFilter("q", e.target.value)}
            />
            {filters.q && (
              <button type="button" className="cx-x" aria-label="Limpar busca" onClick={() => setFilter("q", "")}>
                <I n="x" cls="sm" />
              </button>
            )}
          </label>

          <button type="button" className={`cx-fb ${activeCount > 0 ? "on" : ""}`} aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}>
            <I n="funnel" cls="sm" />
            Filtros
            {activeCount > 0 && <em aria-label={`${activeCount} filtros ativos`}>{activeCount}</em>}
          </button>

          <div className="cx-ctl">
            <div className={`cfw ${sortOpen ? "open" : ""}`}>
              <button
                type="button"
                className={`cfb crso ${sortActive ? "on" : ""}`}
                aria-label={`Ordenar: ${sortLabel}`}
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                title={`Ordenar: ${sortLabel}`}
                onClick={() => setSortOpen((v) => !v)}
              >
                <svg className="ico sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
              </button>
              <div className="cfm right" role="menu">
                <small className="cfh">Ordenar por</small>
                {SORT_OPTIONS.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filters.sort === v}
                    className={filters.sort === v ? "on" : ""}
                    onClick={() => {
                      setFilter("sort", v);
                      setSortOpen(false);
                    }}
                  >
                    {l}
                    {filters.sort === v && <I n="check" cls="sm" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="vt crvt" role="group" aria-label="Visualização">
              {VIEWS.map(([v, icon, label]) => (
                <button key={v} type="button" className={view === v ? "on" : ""} aria-label={label} aria-pressed={view === v} title={label} onClick={() => setView(v)}>
                  <I n={icon} cls="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="fade cx-act" aria-label="Filtros ativos">
            <small>Filtros ativos:</small>
            {activeKeys.map((k) => {
              const o = optsFor(k).find((x) => x[0] === filters[k]);
              return (
                <button key={k} type="button" className="crx" aria-label={`Remover filtro ${FILTER_LABEL[k]}`} onClick={() => setFilter(k, EMPTY_FILTERS[k])}>
                  {o ? o[1].split(" · ")[0] : filters[k]}
                  <I n="x" cls="sm" />
                </button>
              );
            })}
            {nearOn && (
              <button type="button" className="crx" aria-label="Remover filtro Perto de mim" onClick={removeNearMe}>
                Perto de mim · {radiusKm} km
                <I n="x" cls="sm" />
              </button>
            )}
            <button type="button" className="lnk" onClick={clearCriteria}>
              Limpar filtros
            </button>
          </div>
        )}

        <div id="crres" className="fade">
          {!isLoading && contextLine && (
            <p className="cx-res" aria-live="polite">
              {contextLine}
            </p>
          )}

          {view === "map" ? (
            <div className="crmap cx-map">
              {!nearMeLocation ? (
                <div className="cx-mapem">
                  <span>
                    <I n="map" />
                  </span>
                  <b>Veja os criadores no mapa</b>
                  <p>Para mostrar quem está perto, usamos a localização aproximada deste navegador. Seus filtros e a busca continuam valendo.</p>
                  <button type="button" className="btn" disabled={mapLocating} onClick={enableNearFromMap}>
                    <I n="locate" cls="sm" />
                    {mapLocating ? "Localizando…" : "Usar minha localização"}
                  </button>
                  {mapGeoError && (
                    <small className="cf-err" role="alert">
                      {mapGeoError}
                    </small>
                  )}
                </div>
              ) : (
                <>
                  {nearMeLocatedCount > 0 ? (
                    <Suspense fallback={<div style={{ height: 420, background: "var(--bg)" }} />}>
                      <NearMeMap
                        origin={{ lat: nearMeLocation.lat, lng: nearMeLocation.lng, radiusKm }}
                        items={mapItems}
                        onViewProfile={openProfile}
                        heightClass="h-[min(560px,62vh)]"
                      />
                    </Suspense>
                  ) : isLoading ? (
                    <div style={{ height: 420, background: "var(--bg)" }} />
                  ) : (
                    <div className="ov-empty">
                      <b>Nenhum criador com localização neste raio</b>
                      <small>Aumente o raio para ver mais</small>
                    </div>
                  )}
                  <div className="crmap-b">
                    <div>
                      <b>
                        {isLoading ? "Buscando criadores…" : `${nearMeLocatedCount} ${nearMeLocatedCount === 1 ? "criador no mapa" : "criadores no mapa"}${hasNextPage ? " · carregando o restante…" : ""}`}
                      </b>
                      <small>
                        Raio de busca a partir da sua localização
                      </small>
                    </div>
                    <div className="n4tm crmap-r" role="group" aria-label="Raio de busca">
                      {RADIUS_OPTIONS.map((v) => (
                        <button key={v} type="button" aria-pressed={radiusKm === v} className={radiusKm === v ? "on" : ""} onClick={() => setRadiusKm(v)}>
                          {v} km
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : isLoading ? (
            <div className="crg">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} k={i} />
              ))}
            </div>
          ) : creators.length === 0 ? (
            <div className="ov-empty big lvx-em cre">
              <span>
                <I n="search" />
              </span>
              <b>Nenhum criador encontrado</b>
              <small>Ajuste os filtros ou limpe a busca para ver mais perfis.</small>
              <button type="button" className="btn out" onClick={() => { clearCriteria(); setFilter("q", ""); }}>
                Limpar filtros
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="crg">{creators.map(renderItem)}</div>
          ) : (
            <div className="crwl">
              <div className="crwh">
                <span />
                <span>Criador</span>
                <span>Nichos</span>
                <span>Redes</span>
                <span>{nearOn ? "Distância" : ""}</span>
                <span />
              </div>
              {creators.map(renderItem)}
            </div>
          )}

          {view !== "map" && (
            <div ref={loadMoreRef} style={{ padding: "16px 0", display: "flex", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
              {isFetchingNextPage && "Carregando mais..."}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="crb on">
            <span>
              <b>{selected.size}</b> {selected.size > 1 ? "selecionados" : "selecionado"}
            </span>
            <button type="button" className="btn out" onClick={() => setBulkSave(true)}>
              <I n="heart" cls="sm" />
              Salvar em lista
            </button>
            {selectedCreators.length === 1 && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setInviteTarget({
                    userId: selectedCreators[0].user.id,
                    name: selectedCreators[0].user.name,
                    accounts: selectedCreators[0].accounts,
                  })
                }
              >
                <I n="send" cls="sm" />
                Convidar
              </button>
            )}
            <button type="button" className="round" aria-label="Limpar seleção" onClick={() => setSelected(new Set())}>
              <I n="x" cls="sm" />
            </button>
          </div>
        )}
      </>

      {filtersOpen && (
        <FiltersDrawer
          initial={{
            net: filters.net,
            niche: filters.niche,
            uf: filters.uf,
            gen: filters.gen,
            fol: filters.fol,
            eng: filters.eng,
            near: nearMeLocation,
            radius: radiusKm,
          }}
          nicheOpts={nicheOpts}
          onApply={applyDraft}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {profileId && <InfluencerProfileDrawer influencerId={profileId} onClose={() => setProfileId(null)} />}
      {selectedForList && (
        <ListMembershipModal
          userId={selectedForList.userId}
          influencerName={selectedForList.name}
          onClose={() => setSelectedForList(null)}
        />
      )}
      {bulkSave && (
        <BulkSaveModal
          userIds={selectedCreators.map((c) => c.user.id)}
          onClose={() => setBulkSave(false)}
        />
      )}
      {inviteTarget && !inviteTarget.profileIds && (
        <InviteNetworksModal
          userId={inviteTarget.userId}
          name={inviteTarget.name}
          known={inviteTarget.accounts.map(({ social_network: sn }) => ({
            id: String(sn.id),
            type: sn.type,
            label: netLabel(sn),
            username: sn.username,
            members: sn.members,
          }))}
          onConfirm={(profileIds) => setInviteTarget((t) => (t ? { ...t, profileIds } : t))}
          onClose={() => setInviteTarget(null)}
        />
      )}
      {inviteTarget && inviteTarget.profileIds && (
        <CampaignPickerModal
          mode="invite"
          influencerId={String(inviteTarget.userId)}
          influencerName={inviteTarget.name}
          profileIds={inviteTarget.profileIds}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// ListDetailModal
// ---------------------------------------------------------------------------

interface ListDetailModalProps {
  listId: string;
  listName: string;
  onClose: () => void;
}

function ListDetailModal({ listId, listName, onClose }: ListDetailModalProps) {
  const { data, isLoading } = useInfluencerList(listId);
  const removeMutation = useRemoveFromInfluencerList();
  const navigate = useNavigate();

  const influencers = data?.influencers ?? [];

  async function handleRemove(userId: number) {
    await removeMutation.mutateAsync({ listId, userId });
  }

  return (
    <Modal onClose={onClose} title={listName} panelClassName="max-w-2xl">
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : influencers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="Users" size={36} color="#d4d4d4" />
            <p className="text-neutral-500">Esta lista ainda não tem criadores</p>
            <p className="text-sm text-neutral-400">
              Vá ao catálogo e clique em "Adicionar à lista" nos cards
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500 mb-1">
              {influencers.length} {influencers.length === 1 ? "criador" : "criadores"}
            </p>
            {influencers.map((influencer) => {
              return (
              <div
                key={influencer.id}
                className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3"
              >
                <UserAvatar
                  name={influencer.name}
                  src={influencer.photo}
                  className="size-10 rounded-xl"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">{influencer.name}</p>
                  {influencer.email && (
                    <p className="truncate text-xs text-neutral-400">{influencer.email}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/influencer/$influencerId",
                        params: { influencerId: String(influencer.id) },
                      })
                    }
                    className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
                    title="Ver perfil"
                  >
                    <Icon name="ExternalLink" size={15} color="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(influencer.id)}
                    disabled={removeMutation.isPending}
                    className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Remover da lista"
                  >
                    <Icon name="Trash2" size={15} color="currentColor" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Lists Tab
// ---------------------------------------------------------------------------

function ListCard({
  list,
  k,
  onOpen,
  onEdit,
  onDelete,
}: {
  list: { id: string; name: string; created_at: string; influencer_count: number };
  k: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data } = useInfluencerList(list.id);
  const members = data?.influencers ?? [];
  const extra = list.influencer_count - 4;
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article className="crd lc" style={{ "--k": k } as React.CSSProperties} onClick={onOpen}>
      <div className="lc-st">
        {members.slice(0, 4).map((m) => (
          <Av key={m.id} name={m.name} src={m.photo ?? undefined} size={44} />
        ))}
        {extra > 0 && <em>+{extra}</em>}
      </div>
      <b>{list.name}</b>
      <small>
        {list.influencer_count} {list.influencer_count === 1 ? "criador" : "criadores"} · criada em{" "}
        {new Date(list.created_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </small>
      <div className="crd-a">
        <button type="button" className="btn out" onClick={stop(onOpen)}>
          Abrir lista
        </button>
        <button type="button" className="round crd-sv" aria-label="Renomear lista" onClick={stop(onEdit)}>
          <I n="notepad" cls="sm" />
        </button>
        <button type="button" className="round crd-sv" aria-label="Excluir lista" onClick={stop(onDelete)}>
          <I n="trash" cls="sm" />
        </button>
      </div>
    </article>
  );
}

function ListsTab() {
  const { data: lists = [], isLoading } = useInfluencerLists();
  const createMutation = useCreateInfluencerList();
  const updateMutation = useUpdateInfluencerList();
  const deleteMutation = useDeleteInfluencerList();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingList, setEditingList] = useState<{ id: string; name: string } | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [viewingList, setViewingList] = useState<{ id: string; name: string } | null>(null);

  async function handleCreate() {
    if (!newListName.trim()) return;
    await createMutation.mutateAsync(newListName.trim());
    setNewListName("");
    setShowCreateModal(false);
  }

  async function handleUpdate() {
    if (!editingList || !editingList.name.trim()) return;
    await updateMutation.mutateAsync({ listId: editingList.id, name: editingList.name.trim() });
    setEditingList(null);
  }

  async function handleDelete() {
    if (!deletingListId) return;
    await deleteMutation.mutateAsync(deletingListId);
    setDeletingListId(null);
  }

  return (
    <>
      <>
        <div id="crres" className="fade lsm">
          {isLoading ? (
            <div className="crg crgl">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="crd lc" style={{ "--k": i, cursor: "default" } as React.CSSProperties}>
                  <Skeleton className="h-11 w-40 rounded-full" />
                  <Skeleton className="mt-2 h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2 h-11 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="crg crgl">
              {lists.map((list, k) => (
                <ListCard
                  key={list.id}
                  list={list}
                  k={k}
                  onOpen={() => setViewingList({ id: list.id, name: list.name })}
                  onEdit={() => setEditingList({ id: list.id, name: list.name })}
                  onDelete={() => setDeletingListId(list.id)}
                />
              ))}
              <button type="button" className="lc nw" style={{ "--k": lists.length } as React.CSSProperties} onClick={() => setShowCreateModal(true)}>
                <span>
                  <I n="plus" />
                </span>
                <b>Nova lista</b>
                <small>Organize criadores por tema, nicho ou campanha</small>
              </button>
            </div>
          )}
        </div>
      </>

      {showCreateModal && (
        <Modal
          onClose={() => { setShowCreateModal(false); setNewListName(""); }}
          title="Nova lista"
        >
          <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Nome da lista</label>
              <input
                autoFocus
                type="text"
                placeholder="Ex: Top creators fashion"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => { setShowCreateModal(false); setNewListName(""); }}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-full bg-primary-600 hover:bg-primary-700"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newListName.trim()}
              >
                Criar lista
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingList && (
        <Modal onClose={() => setEditingList(null)} title="Renomear lista">
          <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Nome</label>
              <input
                autoFocus
                type="text"
                value={editingList.name}
                onChange={(e) =>
                  setEditingList((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setEditingList(null)}>
                Cancelar
              </Button>
              <Button
                className="rounded-full bg-primary-600 hover:bg-primary-700"
                onClick={handleUpdate}
                disabled={updateMutation.isPending || !editingList.name.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingListId && (
        <Modal onClose={() => setDeletingListId(null)} title="Excluir lista">
          <div className="flex flex-col gap-4 p-1">
            <p className="text-sm text-neutral-600">
              Tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setDeletingListId(null)}>
                Cancelar
              </Button>
              <Button
                className="rounded-full bg-red-500 hover:bg-red-600 text-white"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {viewingList && (
        <ListDetailModal
          listId={viewingList.id}
          listName={viewingList.name}
          onClose={() => setViewingList(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Route Component
// ---------------------------------------------------------------------------

function RouteComponent() {
  const { selectedWorkspace } = useWorkspaceContext();
  const permissions = useWorkspacePermissions();
  const navigate = useNavigate();
  const search = useSearch({ from: "/(private)/(app)/creators" });
  const activeTab: ActiveTab =
    (search as Record<string, string>).tab === "lists" && permissions.catalog_write
      ? "lists"
      : "catalog";

  // O cabeçalho/abas ficam montados ao trocar de aba; só o conteúdo muda.
  const [exploreCount, setExploreCount] = useState<number | undefined>(undefined);
  const { data: myLists = [], isLoading: listsLoading } = useInfluencerLists();
  const canLists = !!permissions.catalog_write;
  const [visitedLists, setVisitedLists] = useState(activeTab === "lists");
  useEffect(() => {
    if (activeTab === "lists") setVisitedLists(true);
  }, [activeTab]);

  function setTab(tab: ActiveTab) {
    navigate({ search: tab === "lists" ? { tab: "lists" } : {} } as any);
  }

  if (!selectedWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-neutral-500">Selecione um workspace para continuar</p>
      </div>
    );
  }

  if (!permissions.catalog_read) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-neutral-500">Você não tem permissão para acessar esta seção</p>
      </div>
    );
  }

  return (
    <PageShell
      tab={activeTab}
      setTab={setTab}
      canLists={canLists}
      exploreCount={exploreCount}
      listCount={canLists && !listsLoading ? myLists.length : undefined}
    >
      {/* As duas abas ficam montadas (a visitada fica só oculta): trocar não
          refaz requisições, não mostra skeleton nem repete a animação. */}
      <div hidden={activeTab !== "catalog"}>
        <CatalogTab onTotal={setExploreCount} />
      </div>
      {canLists && visitedLists && (
        <div hidden={activeTab !== "lists"}>
          <ListsTab />
        </div>
      )}
    </PageShell>
  );
}
