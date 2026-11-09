import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import "@/styles/agency-roster.css";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { I, Av } from "@/components/prototype/ui";
import { CampaignPickerModal } from "@/components/influencer-lists/campaign-picker-modal";
import { ListMembershipModal } from "@/components/influencer-lists/list-membership-modal";
import { InfluencerProfileDrawer } from "@/components/influencer-profile/profile-drawer";
import { useWorkspaceContext, useWorkspacePermissions } from "@/contexts/workspace-context";
import { useNiches } from "@/hooks/use-niches";
import {
  useInfluencerLists,
  useInfluencerMembershipMap,
} from "@/hooks/use-influencer-lists";
import { ListsTab } from "@/components/creators/lists/lists-tab";
import {
  useCreatorsCatalog,
  useAddToInfluencerList,
} from "@/hooks/use-creators-catalog";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { RosterPanel, type RosterStatus } from "@/components/creators/roster-panel";
import { rosterErrorMessage, useAgencyRoster, useInviteToRoster, useRosterStatusMap } from "@/hooks/use-agency-roster";
import { CityPicker } from "@/components/creators/city-picker";
import { MapCreatorPanel } from "@/components/creators/map-creator-panel";
import {
  FilterButton,
  FilterChips,
  PageContainer,
  PageControls,
  PageHeader,
  PageTabs,
  PageToolbar,
  SearchInput,
  SortControl,
  ViewSwitcher,
  type ViewOption,
} from "@/components/page/page-kit";
import type { CityPlace } from "@/lib/city-search";
import { InviteNetworksModal } from "@/components/influencer-lists/invite-networks-modal";
import { defaultCatalogOrder } from "@/shared/utils/creators-default-order";
import { groupCreators, type CreatorGroup } from "@/shared/utils/group-creators";
import { CreatorCard, CreatorCardSkeleton, ROSTER_LABEL, type CreatorCardProps } from "@/components/creators/creator-card";
import { NET_ICON, groupPhoto, netLabel, useAccountRows } from "@/components/creators/creator-accounts";
import { engagementLabel, fmtDistance, followersLabel } from "@/components/creators/creator-metrics";
import type {
  CatalogItem,
  CatalogOrderBy,
  CatalogOrderDir,
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

/** Recortes da página: Todos (catálogo), Meu elenco (agência: aceitos e convites pendentes), Favoritos (listas salvas). */
type Segment = "all" | "roster" | "favorites";
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
  /** Cidade escolhida na busca ("Ribeirão Preto, São Paulo"); sem ela, é a localização deste navegador. */
  label?: string;
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
// Shell da página (cabeçalho do kit) — o conteúdo de cada aba monta as abas, a barra e os chips
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pv">
      <PageContainer>
        <PageHeader title="Criadores" subtitle="Descubra, salve e convide perfis para as suas campanhas." />
        {children}
      </PageContainer>
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

  const pickCity = (c: CityPlace) => {
    setGeoError("");
    setDraft((d) => ({ ...d, near: { lat: c.lat, lng: c.lng, label: c.label }, radius: c.radiusKm }));
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
                      <I n="locate" cls="sm" /> {draft.near.label ? draft.near.label : "Perto de você"}
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
                  <CityPicker onPick={pickCity} />
                  <small>Mostra quem está na cidade agora, pela localização do celular, mesmo que você esteja longe.</small>
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

type CardProps = CreatorCardProps;

function CreatorRow({ group, k, selected, near, saved, onSelect, onOpen, onInvite, onSave, rosterStatus, onRoster }: CardProps) {
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
          {rosterStatus && <span className={`crd-rs ${rosterStatus}`}>{ROSTER_LABEL[rosterStatus]}</span>}
        </div>
      </div>
      <span className="crw-n">{[...(ugc ? ["UGC"] : []), ...names].join(" · ")}</span>
      <span className="crw-nets">
        {rows.map((a) => (
          <span key={a.id} title={[a.label, `@${a.username}`, engagementLabel(a.members, a.engagement) ? `${engagementLabel(a.members, a.engagement)} de engajamento` : ""].filter(Boolean).join(" · ")}>
            <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
            <b>{followersLabel(a.members) ?? "—"}</b>
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
        {onRoster && !rosterStatus && (
          <button type="button" className="round crd-sv" aria-label={`Convidar ${group.user.name} para o elenco`} title="Convidar para o elenco" onClick={stop(onRoster)}>
            <I n="star" cls="sm" />
          </button>
        )}
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

const VIEW_OPTIONS: ViewOption<"grid" | "list" | "map">[] = [
  { id: "grid", icon: "grid", label: "Cartões" },
  { id: "list", icon: "list", label: "Lista" },
  { id: "map", icon: "map", label: "Mapa" },
];

function CatalogTab({ tabs, onTotal }: { tabs: React.ReactNode; onTotal: (n: number | undefined) => void }) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<"grid" | "list" | "map">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedForList, setSelectedForList] = useState<SelectedForList | null>(null);
  const [bulkSave, setBulkSave] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const membershipMap = useInfluencerMembershipMap();
  // Agência: marca quem está no elenco, convida pelo cartão e filtra "Meu elenco".
  const isAgency = useIsAgencyWorkspace();
  const permissions = useWorkspacePermissions();
  const rosterMap = useRosterStatusMap();
  const inviteToRoster = useInviteToRoster();
  const canRoster = isAgency && permissions.influencers_invite;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // "Perto de mim" é um critério de busca: só existe quando o usuário o liga
  // (painel de filtros ou mapa). A posição não é guardada entre visitas.
  const [nearMeLocation, setNearMeLocation] = useState<NearMeLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [mapLocating, setMapLocating] = useState(false);
  const [mapGeoError, setMapGeoError] = useState("");
  const [mapCityOpen, setMapCityOpen] = useState(false);
  // Criador aberto no mapa (`user.id`): o resumo aparece sobre o próprio mapa.
  const [mapSelectedId, setMapSelectedId] = useState<number | null>(null);

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
      ...defaultCatalogOrder(parseOrder(filters.sort), !!nearMeLocation),
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
  const mapSelectedGroup = useMemo(
    () => (mapSelectedId == null ? null : (creators.find((c) => c.user.id === mapSelectedId) ?? null)),
    [creators, mapSelectedId],
  );

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
    setMapSelectedId(null);
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

  /** "Buscar nesta área": o centro da busca passa a ser o que o mapa está mostrando. */
  const moveMapCenter = (lat: number, lng: number) => {
    setMapSelectedId(null);
    setNearMeLocation({ lat, lng, label: "Área escolhida no mapa" });
  };

  const pickMapCity = (c: CityPlace) => {
    setMapGeoError("");
    setMapSelectedId(null);
    setNearMeLocation({ lat: c.lat, lng: c.lng, label: c.label });
    setRadiusKm(c.radiusKm);
  };

  const activeKeys = FILTER_KEYS.filter((k) => filters[k] && filters[k] !== "all");
  const nearOn = !!nearMeLocation;
  const activeCount = activeKeys.length + (nearOn ? 1 : 0);
  const selectedCreators = creators.filter((c) => selected.has(c.key));
  const searching = !!debouncedQ;
  // Sem contagem de resultados: o catálogo pagina por conta de rede social, então
  // qualquer número seria de contas ou de criadores parcialmente carregados.
  const contextLine = [
    nearOn ? `Num raio de ${radiusKm} km ${nearMeLocation?.label ? `de ${nearMeLocation.label}` : "da sua localização"}` : "",
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
      rosterStatus: rosterMap.get(group.user.id) ?? null,
      rosterBusy: inviteToRoster.isPending && inviteToRoster.variables === group.user.id,
      onRoster: canRoster
        ? () =>
            inviteToRoster.mutate(group.user.id, {
              onSuccess: () => toast.success(`Convite enviado para ${group.user.name}. Ele entra no elenco quando aceitar.`),
              onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível convidar para o elenco.")),
            })
        : undefined,
    };
    return view === "list" ? <CreatorRow key={group.key} {...props} /> : <CreatorCard key={group.key} {...props} />;
  };

  return (
    <>
      <>
        <PageControls>
          {tabs}
          <PageToolbar>
            <SearchInput value={filters.q} onChange={(v) => setFilter("q", v)} placeholder="Buscar criador por nome ou @" label="Buscar criador" />
            <FilterButton count={activeCount} aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}>
              Filtros
            </FilterButton>
            <SortControl options={SORT_OPTIONS} value={filters.sort} onChange={(v) => setFilter("sort", v)} />
            <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />
          </PageToolbar>
          <FilterChips
            label="Filtros ativos"
            onClear={clearCriteria}
            chips={[
              ...activeKeys.map((k) => {
                const o = optsFor(k).find((x) => x[0] === filters[k]);
                return {
                  id: k,
                  label: o ? o[1].split(" · ")[0] : String(filters[k]),
                  removeLabel: `Remover filtro ${FILTER_LABEL[k]}`,
                  onRemove: () => setFilter(k, EMPTY_FILTERS[k]),
                };
              }),
              ...(nearOn
                ? [
                    {
                      id: "near",
                      label: `${nearMeLocation?.label ? nearMeLocation.label.split(",")[0] : "Perto de mim"} · ${radiusKm} km`,
                      removeLabel: `Remover filtro ${nearMeLocation?.label ? "de cidade" : "Perto de mim"}`,
                      onRemove: removeNearMe,
                    },
                  ]
                : []),
            ]}
          />
        </PageControls>

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
                  <b>Descubra criadores por região</b>
                  <p>Veja no mapa quem está perto de você ou numa cidade que você escolher. Seus filtros e a busca continuam valendo.</p>
                  <div className="cx-mapopts">
                    <button type="button" className="cx-mapopt" disabled={mapLocating} onClick={enableNearFromMap}>
                      <i>
                        <I n="locate" />
                      </i>
                      <b>{mapLocating ? "Localizando…" : "Usar minha localização"}</b>
                      <small>Mostra quem está perto deste navegador</small>
                    </button>
                    <button type="button" className={`cx-mapopt${mapCityOpen ? " on" : ""}`} aria-expanded={mapCityOpen} onClick={() => setMapCityOpen((v) => !v)}>
                      <i>
                        <I n="search" />
                      </i>
                      <b>Buscar outra cidade ou região</b>
                      <small>Digite o nome da cidade</small>
                    </button>
                  </div>
                  {mapCityOpen && (
                    <div className="cx-mapcity">
                      <CityPicker onPick={pickMapCity} />
                    </div>
                  )}
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
                        origin={{ lat: nearMeLocation.lat, lng: nearMeLocation.lng, radiusKm, label: nearMeLocation.label }}
                        items={mapItems}
                        selectedId={mapSelectedGroup ? mapSelectedGroup.user.id : null}
                        onSelect={setMapSelectedId}
                        radiusOptions={RADIUS_OPTIONS}
                        onRadiusChange={setRadiusKm}
                        onMoveCenter={moveMapCenter}
                        loading={isLoading || isFetchingNextPage || hasNextPage}
                        heightClass="h-[min(620px,70vh)]"
                        detail={
                          mapSelectedGroup && (
                            <MapCreatorPanel
                              group={mapSelectedGroup}
                              near
                              saved={(membershipMap.get(mapSelectedGroup.user.id) ?? []).length > 0}
                              onClose={() => setMapSelectedId(null)}
                              onOpen={() => openProfile(mapSelectedGroup.user.id)}
                              onSave={() => setSelectedForList({ userId: mapSelectedGroup.user.id, name: mapSelectedGroup.user.name })}
                              rosterStatus={rosterMap.get(mapSelectedGroup.user.id) ?? null}
                              rosterBusy={inviteToRoster.isPending && inviteToRoster.variables === mapSelectedGroup.user.id}
                              onRoster={
                                canRoster
                                  ? () =>
                                      inviteToRoster.mutate(mapSelectedGroup.user.id, {
                                        onSuccess: () => toast.success(`Convite enviado para ${mapSelectedGroup.user.name}. Ele entra no elenco quando aceitar.`),
                                        onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível convidar para o elenco.")),
                                      })
                                  : undefined
                              }
                            />
                          )
                        }
                      />
                    </Suspense>
                  ) : isLoading ? (
                    <div style={{ height: 420, background: "var(--bg)" }} />
                  ) : (
                    <div className="ov-empty">
                      <b>Nenhum criador com localização neste raio</b>
                      <small>Aumente o raio para ver mais</small>
                      <div className="n4tm crmap-r" role="group" aria-label="Raio de busca">
                        {RADIUS_OPTIONS.map((v) => (
                          <button key={v} type="button" aria-pressed={radiusKm === v} className={radiusKm === v ? "on" : ""} onClick={() => setRadiusKm(v)}>
                            {v} km
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="crmap-b">
                    <div>
                      <b>
                        {isLoading ? "Buscando criadores…" : `${nearMeLocatedCount} ${nearMeLocatedCount === 1 ? "criador no mapa" : "criadores no mapa"}${hasNextPage ? " · carregando o restante…" : ""}`}
                      </b>
                      <small>Arraste o mapa para explorar e toque numa foto para ver o resumo do criador</small>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : isLoading ? (
            <div className="crg">
              {Array.from({ length: 8 }).map((_, i) => (
                <CreatorCardSkeleton key={i} k={i} />
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
// Route Component
// ---------------------------------------------------------------------------

function RouteComponent() {
  const { selectedWorkspace } = useWorkspaceContext();
  const permissions = useWorkspacePermissions();
  const navigate = useNavigate();
  const isAgency = useIsAgencyWorkspace();
  const search = useSearch({ from: "/(private)/(app)/creators" });
  const canLists = !!permissions.catalog_write;

  // `tab=lists` é o endereço antigo de "Minhas listas": agora é Favoritos.
  const requested = (search as Record<string, string>).tab;
  const segment: Segment =
    (requested === "roster" || requested === "invites") && isAgency
      ? "roster"
      : (requested === "favorites" || requested === "lists") && canLists
          ? "favorites"
          : "all";

  // O cabeçalho e as abas ficam montados ao trocar de recorte; só o conteúdo muda.
  const [exploreCount, setExploreCount] = useState<number | undefined>(undefined);
  const { isLoading: listsLoading } = useInfluencerLists();
  const membershipMap = useInfluencerMembershipMap();
  const { data: roster = [], isLoading: rosterLoading } = useAgencyRoster();
  // Subaba de "Meu elenco": quem aceitou, convites pendentes ou todos juntos. Um convite recém-chegado abre em "Pendentes".
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>("all");
  const [visitedLists, setVisitedLists] = useState(segment === "favorites");
  useEffect(() => {
    if (segment === "favorites") setVisitedLists(true);
  }, [segment]);

  function setSegment(next: Segment) {
    navigate({ search: next === "all" ? {} : { tab: next } } as any);
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

  const inRoster = roster.filter((m) => m.status === "active").length;
  const invited = roster.filter((m) => m.status === "invited").length;
  const tabs = (
    <PageTabs
      ariaLabel="Recortes de criadores"
      value={segment}
      onChange={setSegment}
      subValue={rosterStatus}
      onSubChange={(id) => setRosterStatus(id as RosterStatus)}
      items={[
        { id: "all", label: "Todos", count: exploreCount },
        ...(canLists ? [{ id: "favorites" as const, label: "Favoritos", count: !listsLoading ? membershipMap.size : undefined }] : []),
        ...(isAgency
          ? [
              {
                id: "roster" as const,
                label: "Meu elenco",
                count: !rosterLoading ? inRoster + invited : undefined,
                sub: [
                  { id: "all", label: "Todos" },
                  { id: "active", label: "Ativos", count: !rosterLoading ? inRoster : undefined },
                  { id: "invited", label: "Pendentes", count: !rosterLoading ? invited : undefined },
                ],
              },
            ]
          : []),
      ]}
    />
  );

  return (
    <PageShell>
      {/* Todos e Favoritos ficam montados (o visitado fica só oculto): trocar não refaz requisições, não mostra
          skeleton nem repete a animação. O elenco é uma leitura leve e montam quando abertos. */}
      <div className="pg-panel" hidden={segment !== "all"}>
        <CatalogTab tabs={tabs} onTotal={setExploreCount} />
      </div>
      {canLists && visitedLists && (
        <div className="pg-panel" hidden={segment !== "favorites"}>
          <ListsTab tabs={tabs} />
        </div>
      )}
      {isAgency && segment === "roster" && (
        <div className="pg-panel">
          <RosterPanel status={rosterStatus} onStatusChange={setRosterStatus} tabs={tabs} onFindCreators={() => setSegment("all")} />
        </div>
      )}
    </PageShell>
  );
}
