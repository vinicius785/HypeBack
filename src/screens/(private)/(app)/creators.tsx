import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

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
    ["ugc", "UGC"],
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

/**
 * Chave versionada para o localStorage. Bump da versão (`v1` → `v2`)
 * invalida caches antigos sem precisar migrar.
 */
const NEAR_ME_STORAGE_KEY = "hypeapp:near-me-location:v1";

interface NearMeLocation {
  lat: number;
  lng: number;
  /** Epoch ms — usado pra exibir "capturado há X" no futuro, se necessário. */
  capturedAt: number;
}

function loadStoredLocation(): NearMeLocation | null {
  try {
    const raw = localStorage.getItem(NEAR_ME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        capturedAt: typeof parsed.capturedAt === "number" ? parsed.capturedAt : Date.now(),
      };
    }
  } catch {
    // localStorage indisponível (modo privado, quota) — ignora.
  }
  return null;
}

function saveStoredLocation(loc: NearMeLocation | null): void {
  try {
    if (loc) {
      localStorage.setItem(NEAR_ME_STORAGE_KEY, JSON.stringify(loc));
    } else {
      localStorage.removeItem(NEAR_ME_STORAGE_KEY);
    }
  } catch {
    // ignora — não bloqueia a UX se localStorage falhar
  }
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
// Filtros
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  opts,
  value,
  open,
  onToggle,
  onPick,
}: {
  label: string;
  opts: Opt[];
  value: string;
  open: boolean;
  onToggle: () => void;
  onPick: (v: string) => void;
}) {
  const cur = opts.find((o) => o[0] === value);
  const active = !!value && value !== "all";
  return (
    <div className={`cfw ${open ? "open" : ""}`}>
      <button type="button" className={`chip cfb ${active ? "on" : ""}`} onClick={onToggle}>
        <span>{active && cur ? cur[1].split(" · ")[0] : label}</span>
        <I n="chev" cls="sm" />
      </button>
      <div className="cfm">
        {opts.map(([v, l]) => (
          <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onPick(v)}>
            {l}
            {value === v && <I n="check" cls="sm" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards / linhas
// ---------------------------------------------------------------------------

interface CardProps {
  item: CatalogItem;
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
};

function CreatorCard({ item, k, selected, near, saved, onSelect, onOpen, onInvite, onSave }: CardProps) {
  const sn = item.social_network;
  const names = item.niches.map((n) => n.name).filter((s) => s.trim().length > 0);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <article className={`crd ${selected ? "sel" : ""}`} style={{ "--k": Math.min(k, 14) } as React.CSSProperties} onClick={onOpen}>
      <button type="button" className={`crd-ck ${selected ? "on" : ""}`} aria-label={`Selecionar ${item.user.name}`} aria-pressed={selected} onClick={stop(onSelect)}>
        <I n="check" cls="sm" />
      </button>
      <div className="crd-h">
        <Av name={item.user.name} src={sn.photo ?? item.user.photo ?? undefined} size={60} />
        <div>
          <b>{item.user.name}</b>
          <small>
            @{sn.username} · <I n={NET_ICON[sn.type] ?? "video"} cls="sm" />
          </small>
        </div>
      </div>
      <div className="crd-n">
        {names.slice(0, 2).map((n) => (
          <span key={n}>{n}</span>
        ))}
        {names.length > 2 && <span>+{names.length - 2}</span>}
        {near && item.distance_km != null && (
          <span className="crd-d">
            <I n="flag" cls="sm" />
            {fmtDistance(item.distance_km)}
          </span>
        )}
      </div>
      <div className="crd-s">
        <div>
          <small>Seguidores</small>
          <b>{fmtFollowers(sn.members)}</b>
        </div>
        <div>
          <small>Engajamento</small>
          <b>{fmtEngagement(sn.engagement_percent)}</b>
        </div>
        <div>
          <small>Rede</small>
          <b>{NET_LABEL[sn.type] ?? sn.name ?? "—"}</b>
        </div>
      </div>
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

function CreatorRow({ item, k, selected, near, saved, onSelect, onOpen, onInvite, onSave }: CardProps) {
  const sn = item.social_network;
  const names = item.niches.map((n) => n.name).filter((s) => s.trim().length > 0);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={`crw ${selected ? "sel" : ""}`} style={{ "--k": Math.min(k, 14) } as React.CSSProperties} onClick={onOpen}>
      <button type="button" className={`crd-ck ${selected ? "on" : ""}`} aria-label={`Selecionar ${item.user.name}`} onClick={stop(onSelect)}>
        <I n="check" cls="sm" />
      </button>
      <div className="crw-i">
        <Av name={item.user.name} src={sn.photo ?? item.user.photo ?? undefined} size={44} />
        <div>
          <b>{item.user.name}</b>
          <small>
            @{sn.username} · <I n={NET_ICON[sn.type] ?? "video"} cls="sm" />
          </small>
        </div>
      </div>
      <span className="crw-n">{names.join(" · ")}</span>
      <span className="crw-v">
        <b>{fmtFollowers(sn.members)}</b>
        <small>seguidores</small>
      </span>
      <span className="crw-v">
        <b>{fmtEngagement(sn.engagement_percent)}</b>
        <small>engajamento</small>
      </span>
      <span className="crw-v">
        {near && item.distance_km != null ? (
          <>
            <b>{fmtDistance(item.distance_km)}</b>
            <small>de você</small>
          </>
        ) : null}
      </span>
      <span className="crw-a">
        <button type="button" className={`round crd-sv ${saved ? "on" : ""}`} aria-label="Salvar em lista" onClick={stop(onSave)}>
          <I n="heart" cls="sm" />
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
  profileId: string;
}

function CatalogTab({
  setTab,
  canLists,
}: {
  setTab: (t: ActiveTab) => void;
  canLists: boolean;
}) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [pop, setPop] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedForList, setSelectedForList] = useState<SelectedForList | null>(null);
  const [bulkSave, setBulkSave] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
  const membershipMap = useInfluencerMembershipMap();
  const { data: lists = [] } = useInfluencerLists();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // "Perto de mim" — estado de geolocalização, persistido em localStorage
  // para não pedir permissão a cada visita.
  const [nearMeLocation, setNearMeLocation] = useState<NearMeLocation | null>(
    () => loadStoredLocation(),
  );
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [nearMeRequesting, setNearMeRequesting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Fecha o popover de filtro ao clicar fora.
  useEffect(() => {
    if (!pop) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.(".cfw")) setPop(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pop]);

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
      // Geo só vai pro backend quando temos coords salvas (admin já permitiu)
      ...(nearMeLocation
        ? { lat: nearMeLocation.lat, lng: nearMeLocation.lng, radius_km: radiusKm }
        : {}),
    };
  }, [debouncedQ, filters, nearMeLocation, radiusKm]);

  /**
   * Pede a localização atual via Geolocation API. Grava em localStorage
   * pra evitar reprompt a cada visita. Em caso de erro/negação, mostra
   * toast informativo — não bloqueia o resto do catálogo.
   */
  const handleEnableNearMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      return;
    }
    setNearMeRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: NearMeLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          capturedAt: Date.now(),
        };
        setNearMeLocation(loc);
        saveStoredLocation(loc);
        setNearMeRequesting(false);
      },
      (err) => {
        setNearMeRequesting(false);
        const denied = err.code === err.PERMISSION_DENIED;
        toast.error(
          denied
            ? "Permissão negada. Habilite a localização nas configurações do navegador."
            : "Não foi possível obter sua localização agora. Tente novamente.",
        );
      },
      // Precisão alta consome bateria e não é necessária pra "perto de mim".
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const handleClearNearMe = useCallback(() => {
    setNearMeLocation(null);
    saveStoredLocation(null);
  }, []);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useCreatorsCatalog(queryFilters);

  const { data: niches = [] } = useNiches();

  const nicheOpts = useMemo<Opt[]>(() => {
    const topLevel = (niches as Niche[]).filter((n) => !n.parent_id);
    return [["", "Todos os nichos"], ...topLevel.map((n): Opt => [String(n.id), n.name])];
  }, [niches]);

  const optsFor = useCallback(
    (k: FilterKey): Opt[] => (k === "niche" ? nicheOpts : STATIC_OPTS[k]),
    [nicheOpts],
  );

  const allItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  // Criadores com localização aproximada — plotáveis no mapa "perto de mim".
  const nearMeLocatedCount = useMemo(
    () => allItems.filter((i) => i.approx_location).length,
    [allItems],
  );

  const total = data?.pages[0]?.total;

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) handleLoadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  function setFilter<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function pick(k: FilterKey, v: string) {
    setFilter(k, v);
    setPop(null);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setPop(null);
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

  const activeKeys = FILTER_KEYS.filter((k) => filters[k] && filters[k] !== "all");
  const selectedItems = allItems.filter((i) => selected.has(String(i.social_network.id)));
  const nearOn = !!nearMeLocation;
  const sortActive = !!filters.sort;
  const sortLabel = SORT_OPTIONS.find((s) => s[0] === filters.sort)?.[1] ?? "Relevância";

  const renderItem = (item: CatalogItem, k: number) => {
    const key = String(item.social_network.id);
    const props: CardProps = {
      item,
      k,
      selected: selected.has(key),
      near: nearOn,
      saved: (membershipMap.get(item.user.id) ?? []).length > 0,
      onSelect: () => toggleSel(key),
      onOpen: () => openProfile(item.user.id),
      onInvite: () =>
        setInviteTarget({ userId: item.user.id, name: item.user.name, profileId: key }),
      onSave: () => setSelectedForList({ userId: item.user.id, name: item.user.name }),
    };
    return view === "grid" ? <CreatorCard key={key} {...props} /> : <CreatorRow key={key} {...props} />;
  };

  return (
    <>
      <PageShell
        tab="catalog"
        setTab={setTab}
        canLists={canLists}
        exploreCount={total}
        listCount={canLists ? lists.length : undefined}
      >
        <div id="crfb" className="fade crfb">
          <div className="crr2">
            <label className="find">
              <I n="search" cls="sm" />
              <input
                placeholder="Buscar criador"
                value={filters.q}
                autoComplete="off"
                onChange={(e) => setFilter("q", e.target.value)}
              />
            </label>
            <i className="crdv" />
            {FILTER_KEYS.map((k) => (
              <FilterChip
                key={k}
                label={FILTER_LABEL[k]}
                opts={optsFor(k)}
                value={filters[k]}
                open={pop === k}
                onToggle={() => setPop(pop === k ? null : k)}
                onPick={(v) => pick(k, v)}
              />
            ))}
            <button
              type="button"
              className={`chip crnear ${nearOn ? "on" : ""}`}
              disabled={nearMeRequesting}
              title={nearOn ? "Remover filtro de proximidade" : "Filtrar criadores próximos a você"}
              onClick={nearOn ? handleClearNearMe : handleEnableNearMe}
            >
              <I n="flag" cls="sm" />
              {nearMeRequesting ? "Localizando…" : "Perto de mim"}
            </button>
            <span style={{ flex: 1 }} />
            <div className={`cfw ${pop === "sort" ? "open" : ""}`}>
              <button
                type="button"
                className={`cfb crso ${sortActive ? "on" : ""}`}
                aria-label="Ordenar"
                title={`Ordenar: ${sortLabel}`}
                onClick={() => setPop(pop === "sort" ? null : "sort")}
              >
                <svg className="ico sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
              </button>
              <div className="cfm right">
                <small className="cfh">Ordenar por</small>
                {SORT_OPTIONS.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={filters.sort === v ? "on" : ""}
                    onClick={() => {
                      setFilter("sort", v);
                      setPop(null);
                    }}
                  >
                    {l}
                    {filters.sort === v && <I n="check" cls="sm" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="vt crvt">
              <button type="button" className={view === "grid" ? "on" : ""} aria-label="Cartões" onClick={() => setView("grid")}>
                <I n="grid" cls="sm" />
              </button>
              <button type="button" className={view === "list" ? "on" : ""} aria-label="Lista" onClick={() => setView("list")}>
                <I n="file" cls="sm" />
              </button>
            </div>
          </div>
        </div>

        <div id="crres" className="fade">
          {/* Mapa "Perto de mim" real (Leaflet) dentro do contêiner do protótipo */}
          {nearMeLocation && (
            <div className="crmap">
              {nearMeLocatedCount > 0 ? (
                <Suspense fallback={<div style={{ height: 288, background: "var(--bg)" }} />}>
                  <NearMeMap
                    origin={{ lat: nearMeLocation.lat, lng: nearMeLocation.lng, radiusKm }}
                    items={allItems}
                    onViewProfile={openProfile}
                  />
                </Suspense>
              ) : isLoading ? (
                <div style={{ height: 288, background: "var(--bg)" }} />
              ) : (
                <div className="ov-empty">
                  <b>Nenhum criador com localização neste raio</b>
                  <small>Aumente o raio para ver mais</small>
                </div>
              )}
              <div className="crmap-b">
                <div>
                  <b>
                    {isLoading ? "Buscando criadores…" : `${total ?? allItems.length} ${(total ?? allItems.length) === 1 ? "criador" : "criadores"} num raio de ${radiusKm} km`}
                  </b>
                  <small>
                    Baseado na sua localização
                    {!isLoading && nearMeLocatedCount > 0 ? ` · ${nearMeLocatedCount} no mapa` : ""}
                  </small>
                </div>
                <div className="n4tm crmap-r">
                  {RADIUS_OPTIONS.map((v) => (
                    <button key={v} type="button" className={radiusKm === v ? "on" : ""} onClick={() => setRadiusKm(v)}>
                      {v} km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLoading && (
            <div className="crs">
              <span>
                <b>{allItems.length}</b>
                {total != null ? ` de ${total}` : ""} perfis
              </span>
              {activeKeys.map((k) => {
                const o = optsFor(k).find((x) => x[0] === filters[k]);
                return (
                  <button key={k} type="button" className="crx" onClick={() => setFilter(k, EMPTY_FILTERS[k])}>
                    {FILTER_LABEL[k]}: <b>{o ? o[1] : filters[k]}</b>
                    <I n="x" cls="sm" />
                  </button>
                );
              })}
              {(activeKeys.length > 0 || filters.q || filters.sort) && (
                <button type="button" className="lnk" onClick={clearAll}>
                  Limpar tudo
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="crg">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} k={i} />
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="ov-empty big lvx-em cre">
              <span>
                <I n="search" />
              </span>
              <b>Nenhum criador encontrado</b>
              <small>Ajuste os filtros ou limpe a busca para ver mais perfis.</small>
              <button type="button" className="btn out" onClick={clearAll}>
                Limpar filtros
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="crg">{allItems.map(renderItem)}</div>
          ) : (
            <div className="crwl">
              <div className="crwh">
                <span />
                <span>Criador</span>
                <span>Nichos</span>
                <span>Seguidores</span>
                <span>Engajamento</span>
                <span>{nearOn ? "Distância" : ""}</span>
                <span />
              </div>
              {allItems.map(renderItem)}
            </div>
          )}

          <div ref={loadMoreRef} style={{ padding: "16px 0", display: "flex", justifyContent: "center", color: "var(--muted)", fontSize: 13.5 }}>
            {isFetchingNextPage && "Carregando mais..."}
          </div>
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
            {selectedItems.length === 1 && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setInviteTarget({
                    userId: selectedItems[0].user.id,
                    name: selectedItems[0].user.name,
                    profileId: String(selectedItems[0].social_network.id),
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
      </PageShell>

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
          userIds={Array.from(new Set(selectedItems.map((i) => i.user.id)))}
          onClose={() => setBulkSave(false)}
        />
      )}
      {inviteTarget && (
        <CampaignPickerModal
          mode="invite"
          influencerId={String(inviteTarget.userId)}
          influencerName={inviteTarget.name}
          profileIds={[inviteTarget.profileId]}
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

function ListsTab({
  setTab,
  canLists,
}: {
  setTab: (t: ActiveTab) => void;
  canLists: boolean;
}) {
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
      <PageShell tab="lists" setTab={setTab} canLists={canLists} listCount={isLoading ? undefined : lists.length}>
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
      </PageShell>

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

  return activeTab === "catalog" ? (
    <CatalogTab setTab={setTab} canLists={!!permissions.catalog_write} />
  ) : (
    <ListsTab setTab={setTab} canLists={!!permissions.catalog_write} />
  );
}
