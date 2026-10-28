import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/use-debounce";
import { normalizeForSearch, parseSearchTerm } from "@/shared/utils/search-text";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Icon } from "@/components/ui/icon";
import { InputDate } from "@/components/ui/input-date";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/text-area";
import type { Influencer, Niche } from "@/shared/types";
import { useMuralStatus, useActivateMural, useDeactivateMural } from "@/hooks/use-campaign-mural";
import { useCampaignInfluencerSelection } from "@/hooks/use-campaign-influencer-selection";
import type { InfluencerSelectionProfileItem } from "@/shared/services/campaign-influencer-selection";
import { useInviteInfluencer, useAddToPreSelection, useUpdateInfluencerStatus } from "@/hooks/use-campaign-influencers";
import { useCampaignUsers } from "@/hooks/use-campaign-users";
import { validateMuralEndDate, formatDateForInput, addDays } from "@/shared/utils/date-validations";
import { ListSelector } from "@/components/influencer-lists/list-selector";
import {
  getInfluencerProfiles,
  getCampaignInfluencerInvitableProfiles,
  type InfluencerProfile,
} from "@/shared/services/influencer";
import { useNiches } from "@/hooks/use-niches";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";
import { getUploadUrl } from "@/lib/utils/api";
import {
  resolveNicheDisplayNameFromIds,
  type NicheForDisplay,
} from "@/shared/utils/niche-display";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerProfileCard, type InfluencerCardData } from "@/components/campaign-tabs/shared/influencer-profile-card";
import { useWorkspaceBalance } from "@/hooks/use-balance";
import {
  computeApprovalCostCents,
  fmtBRL,
  parsePriceBRLToCents,
  type CampaignPhaseForCost,
} from "@/components/campaign-tabs/shared/prices-utils";
import { ReserveBalancePreview } from "@/components/campaign-tabs/shared/reserve-balance-modal";

/**
 * Métodos de pagamento que debitam saldo BRL do workspace e, portanto,
 * exigem gating na ação "Convidar". Espelha o conjunto usado na aba de
 * Inscrições (applications-tab.tsx).
 */
const SHOW_APPROVAL_COST_METHODS = new Set(["fixed", "fixed_value", "price"]);

interface ExtendedInfluencer extends Influencer {
  socialNetwork?: string;
  ageRange?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
  };
  recommendationReason?: string;
  /** PK `social_networks` — alinhado à API de seleção / convite por perfil */
  socialNetworkId?: string;
  selectionSource?: "recommended" | "catalog";
  /** `niche_ids` crus da API de influencer-selection (resolver nome via GET /niches). */
  selectionNicheIds?: number[];
  /** Preços por formato (centavos) do influenciador — presente quando payment_method === "price" */
  prices?: Record<string, number>;
}

interface InfluencerSelectionTabProps {
  influencers: Influencer[];
  campaignPhases?: Array<{ id: string; label: string; publish_date?: string }>;
  maxInfluencers?: number;
  /**
   * Phases com formatos da campanha. Estrutura compatível com `CampaignPhaseForCost`
   * (inclui `quantity` e `price` quando o método é `fixed`/`fixed_value`) — necessária
   * para calcular o custo de aprovação e gating monetário do convite.
   */
  phasesWithFormats?: ReadonlyArray<CampaignPhaseForCost>;
  onOpenMuralModal?: () => void;
  /** Método de pagamento da campanha — controla exibição de preços nos cards */
  paymentMethod?: string;
}

/** Skeleton — mesma hierarquia do Figma (título → recomendados → filtros → todos + loading) */
export function InfluencerSelectionTabSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      <div className="flex flex-col gap-6 rounded-[28px] bg-white p-5">
        <Skeleton className="h-7 w-full max-w-md" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex w-[269px] min-w-[269px] shrink-0 flex-col gap-4 rounded-xl bg-neutral-100 p-3"
            >
              <div className="flex justify-between">
                <Skeleton className="size-[60px] rounded-2xl" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-16 flex-1 rounded-lg" />
                <Skeleton className="h-16 flex-1 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="flex gap-1">
                <Skeleton className="h-11 flex-1 rounded-full" />
                <Skeleton className="h-11 flex-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex min-w-[160px] flex-1 flex-col gap-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-11 w-full rounded-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-[28px] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-40 rounded-full" />
            <Skeleton className="h-11 w-48 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-xl bg-neutral-100 p-3">
              <div className="flex justify-between">
                <Skeleton className="size-[60px] rounded-2xl" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-16 flex-1 rounded-lg" />
                <Skeleton className="h-16 flex-1 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="flex gap-1">
                <Skeleton className="h-11 flex-1 rounded-full" />
                <Skeleton className="h-11 flex-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-4">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
    </div>
  );
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("pt-BR");
}

function formatEngagementPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const s = n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return `${s.replace(/\.?0+$/, "")}%`;
}


/** Opções de gênero — espelham o catálogo de Criadores. */
const SELECTION_GENDER_OPTIONS = [
  { value: "", label: "Todos os gêneros" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "other", label: "Outro" },
  { value: "prefer_not_to_say", label: "Prefiro não dizer" },
];

/**
 * Ordenação local. Sem "Mais recentes": o payload de seleção não traz data de
 * cadastro do perfil, então oferecê-la seria enganoso (vide [[memory]] de
 * "No silent caps" — não prometer o que não há dado para cumprir).
 */
const SELECTION_ORDER_OPTIONS = [
  { value: "", label: "Padrão" },
  { value: "followers_desc", label: "Seguidores (maior)" },
  { value: "followers_asc", label: "Seguidores (menor)" },
  { value: "engagement_desc", label: "Engajamento (maior)" },
  { value: "engagement_asc", label: "Engajamento (menor)" },
  { value: "name_asc", label: "Nome (A–Z)" },
];

interface SelectionFilters {
  searchTerm: string;
  /**
   * Nicho selecionado JÁ expandido com os sub-nichos, como string.
   * `null` = sem filtro. O criador marca nicho principal + sub-nichos, então
   * filtrar por um nicho-pai precisa alcançar quem só marcou os filhos — e a
   * comparação é textual porque a API pode devolver id não numérico.
   */
  nicheIds: string[] | null;
  filterGender: string;
  followersMin: number | null;
  followersMax: number | null;
  engagementMin: number | null;
  engagementMax: number | null;
}

/** Nicho + todos os descendentes, como strings (espelha o filtro do servidor). */
function expandNicheWithDescendants(
  nicheId: string,
  allNiches: readonly Niche[],
): string[] {
  const root = nicheId.trim();
  if (!root) return [];
  const childrenByParent = new Map<string, string[]>();
  for (const n of allNiches) {
    if (n.parent_id == null || n.parent_id === "") continue;
    const key = String(n.parent_id);
    const list = childrenByParent.get(key) ?? [];
    list.push(String(n.id));
    childrenByParent.set(key, list);
  }

  const out = new Set<string>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (out.has(child)) continue;
      out.add(child);
      queue.push(child);
    }
  }
  return [...out];
}

function selectionItemMatchesFilters(
  item: InfluencerSelectionProfileItem,
  f: SelectionFilters
): boolean {
  // `parseSearchTerm` apara, tira acento e remove o "@" — a mesma normalização
  // do servidor. Antes: o termo não era aparado (" maria " não casava), acento
  // não era ignorado ("jose" não achava "José") e digitar "@handle" nunca casava,
  // porque o "@" era removido só do lado do item.
  const q = parseSearchTerm(f.searchTerm);
  if (q) {
    const name = normalizeForSearch(item.user.name);
    const handle = normalizeForSearch(item.social_network.username);
    if (!name.includes(q) && !handle.includes(q)) return false;
  }
  if (f.nicheIds && f.nicheIds.length > 0) {
    const ids = (item.niche_ids ?? []).map((n) => String(n));
    if (!ids.some((id) => f.nicheIds!.includes(id))) return false;
  }
  if (f.filterGender) {
    if ((item.user.gender ?? "").toLowerCase() !== f.filterGender) return false;
  }
  const members = item.social_network.members ?? 0;
  if (f.followersMin != null && members < f.followersMin) return false;
  if (f.followersMax != null && members > f.followersMax) return false;
  // Engajamento sem dado (null) fica fora de qualquer faixa — não é 0% real.
  const eng = item.engagement;
  if (f.engagementMin != null && (eng == null || eng < f.engagementMin)) return false;
  if (f.engagementMax != null && (eng == null || eng > f.engagementMax)) return false;
  return true;
}

/** Quebra "campo_direção" (ex.: "followers_desc") em campo + direção. */
function parseSelectionOrder(order: string): {
  by: "followers" | "engagement" | "name" | null;
  dir: 1 | -1;
} {
  if (!order) return { by: null, dir: 1 };
  const idx = order.lastIndexOf("_");
  if (idx <= 0) return { by: null, dir: 1 };
  const by = order.slice(0, idx) as "followers" | "engagement" | "name";
  const dir = order.slice(idx + 1) === "asc" ? 1 : -1;
  return { by, dir };
}

/** Ordena pares {item,type} pelos campos crus (preserva null de engajamento). */
function sortSelectionPairs<T extends { item: InfluencerSelectionProfileItem }>(
  pairs: T[],
  order: string
): T[] {
  const { by, dir } = parseSelectionOrder(order);
  if (!by) return pairs;
  return [...pairs].sort((a, b) => {
    if (by === "followers") {
      return (
        ((a.item.social_network.members ?? 0) -
          (b.item.social_network.members ?? 0)) *
        dir
      );
    }
    if (by === "engagement") {
      const ea = a.item.engagement;
      const eb = b.item.engagement;
      // Sem dado sempre por último, independente da direção.
      if (ea == null && eb == null) return 0;
      if (ea == null) return 1;
      if (eb == null) return -1;
      return (ea - eb) * dir;
    }
    return a.item.user.name.localeCompare(b.item.user.name, "pt-BR") * dir;
  });
}

/** IDs de perfil para convite/pré-seleção: o card da seleção já traz `socialNetworkId`. */
function resolveInviteProfileIds(
  influencer: ExtendedInfluencer | null,
  picked: string[]
): string[] {
  const sid = influencer?.socialNetworkId?.trim();
  if (sid) return [sid];
  return picked;
}

function selectionItemToExtended(
  item: InfluencerSelectionProfileItem,
  networkType: string,
  source: "recommended" | "catalog"
): ExtendedInfluencer {
  const sn = item.social_network;
  const u = item.user;
  const firstNiche = item.niche_ids?.[0];
  const displayName = (sn.name || u.name || "").trim() || u.name;
  return {
    id: String(u.id),
    name: displayName,
    username: (sn.username || "").replace(/^@/, "").trim() || displayName,
    avatar: (sn.photo || u.photo || "").trim(),
    followers: sn.members ?? 0,
    engagement: item.engagement ?? 0,
    niche: firstNiche != null ? String(firstNiche) : "",
    nicheName: item.niche_name,
    selectionNicheIds:
      item.niche_ids?.length && item.niche_ids.every((n) => Number.isFinite(n))
        ? [...item.niche_ids]
        : undefined,
    socialNetwork: networkType,
    recommendationReason:
      source === "recommended" ? item.match_reason : undefined,
    socialNetworkId: String(sn.id),
    selectionSource: source,
    prices: sn.prices,
  };
}

/** Carrossel horizontal para recomendados por rede */
function SelectionRecommendedCarousel({
  items,
  renderCard,
}: {
  items: ExtendedInfluencer[];
  renderCard: (influencer: ExtendedInfluencer) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 2);
    setCanRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateArrows();
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    el.addEventListener("scroll", updateArrows);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateArrows);
    };
  }, [updateArrows, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="relative flex items-stretch">
      <button
        type="button"
        onClick={() => ref.current?.scrollBy({ left: -ref.current.clientWidth, behavior: "smooth" })}
        disabled={!canLeft}
        className="absolute left-[-18px] top-1/2 z-10 flex size-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-[#c3c3c3] bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Cards anteriores"
      >
        <Icon name="ChevronLeft" size={24} color="#525252" />
      </button>
      <div
        ref={ref}
        className="flex min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden scroll-smooth py-2 [scrollbar-width:none] snap-x snap-mandatory [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((influencer) => (
          <div
            key={`${influencer.selectionSource}-${influencer.socialNetwork}-${influencer.socialNetworkId}`}
            className="w-[269px] min-w-[269px] shrink-0 snap-start"
          >
            {renderCard(influencer)}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.scrollBy({ left: ref.current!.clientWidth, behavior: "smooth" })}
        disabled={!canRight}
        className="absolute right-[-18px] top-1/2 z-10 flex size-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-[#c3c3c3] bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Próximos cards"
      >
        <Icon name="ChevronRight" size={24} color="#525252" />
      </button>
    </div>
  );
}

function buildSelectionCardData(
  influencer: ExtendedInfluencer,
  niches: NicheForDisplay[],
): { data: InfluencerCardData; nicheName: string | null } {
  const nicheIds =
    influencer.selectionNicheIds?.length
      ? influencer.selectionNicheIds
      : influencer.niche
        ? [Number(influencer.niche)].filter((n) => Number.isFinite(n))
        : [];
  const nicheName = resolveNicheDisplayNameFromIds(nicheIds, niches, influencer.nicheName);
  return {
    data: {
      profileKey: String(influencer.socialNetworkId ?? influencer.id),
      influencerName: influencer.name,
      influencerAvatar: influencer.avatar || "",
      profileType: influencer.socialNetwork || "",
      profileTypeLabel: getNetworkLabel(influencer.socialNetwork, "Rede social"),
      profileUsername: influencer.username || "",
      influencerFollowers: influencer.followers ?? 0,
      profileFollowers: 0,
      influencerEngagement: influencer.engagement ?? 0,
      recommendationReason: influencer.recommendationReason,
      prices: influencer.prices,
    },
    nicheName: nicheName || null,
  };
}

export function InfluencerSelectionTab({
  influencers: _influencers,
  campaignPhases: _campaignPhases = [],
  maxInfluencers = 0,
  phasesWithFormats = [],
  onOpenMuralModal,
  paymentMethod,
}: InfluencerSelectionTabProps) {
  const navigate = useNavigate();
  const { campaignId } = useParams({ from: "/(private)/(app)/campaigns/$campaignId" });
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  const { data: niches = [] } = useNiches();
  const [searchTerm, setSearchTerm] = useState("");
  // A busca é resolvida no servidor (antes do corte de 120), então o valor cru
  // não pode ir a cada tecla — 400ms é o mesmo padrão usado nas outras telas.
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [filterNiche, setFilterNiche] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [followersMinInput, setFollowersMinInput] = useState("");
  const [followersMaxInput, setFollowersMaxInput] = useState("");
  const [engagementMinInput, setEngagementMinInput] = useState("");
  const [engagementMaxInput, setEngagementMaxInput] = useState("");
  const [order, setOrder] = useState("");
  const [showMuralDateModal, setShowMuralDateModal] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<ExtendedInfluencer | null>(null);
  const [modalType, setModalType] = useState<
    "discover" | "invite" | "curation" | "selectList" | "preselection" | null
  >(null);
  const [inviteMessage, setInviteMessage] = useState("");
  // Valor proposto (BRL, string mascarada) — só para `individual_price`.
  const [proposedPriceInput, setProposedPriceInput] = useState("");
  const [curationNotes, setCurationNotes] = useState("");
  const [tempMuralEndDate, setTempMuralEndDate] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  const inviteOrPreselection =
    modalType === "invite" || modalType === "preselection";

  const needsInviteProfilePicker =
    inviteOrPreselection &&
    !!selectedInfluencer &&
    !selectedInfluencer.socialNetworkId?.trim();

  // Só busca lista quando o card não traz perfil (fallback)
  const { data: invitableProfilesData = [], isLoading: isLoadingInvitableProfiles } =
    useQuery({
      queryKey: withWorkspaceKey(
        [
          "campaigns",
          campaignId,
          "influencers",
          selectedInfluencer?.id,
          "invite-profiles",
        ],
        workspaceId,
      ),
      queryFn: () =>
        getCampaignInfluencerInvitableProfiles(
          campaignId!,
          selectedInfluencer!.id
        ),
      enabled: !!campaignId && !!workspaceId && needsInviteProfilePicker,
    });

  // Curadoria: todos os perfis do influenciador (filtro por redes da campanha só aqui)
  const { data: allProfilesData = [], isLoading: isLoadingAllProfiles } =
    useQuery({
      queryKey: withWorkspaceKey(
        ["influencer", selectedInfluencer?.id, "profiles"],
        workspaceId,
      ),
      queryFn: () => getInfluencerProfiles(selectedInfluencer!.id),
      enabled:
        !!selectedInfluencer && !!workspaceId && modalType === "curation",
    });

  const invitableProfilesList = Array.isArray(invitableProfilesData)
    ? invitableProfilesData
    : [];

  const allProfilesList = Array.isArray(allProfilesData)
    ? allProfilesData
    : [];

  // Extrair redes sociais permitidas das fases da campanha
  const allowedSocialNetworks = useMemo(() => {
    const networks = new Set<string>();
    phasesWithFormats.forEach((phase) => {
      phase.formats?.forEach((format) => {
        if (format.socialNetwork) {
          networks.add(format.socialNetwork.toLowerCase());
        }
      });
    });
    return Array.from(networks);
  }, [phasesWithFormats]);

  // Mapa rede → formatos exigidos pela campanha. Usado pra filtrar o bloco
  // de preços do influenciador a apenas os entregáveis que a marca pediu
  // (ex: card de Instagram com "Feed" e "Reels"; Stories some se a campanha
  // não usa Stories).
  const allowedFormatsByNetwork = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    phasesWithFormats.forEach((phase) => {
      phase.formats?.forEach((format) => {
        const net = format.socialNetwork?.toLowerCase();
        const ct = format.contentType?.toLowerCase();
        if (!net || !ct) return;
        if (!map[net]) map[net] = [];
        if (!map[net].includes(ct)) map[net].push(ct);
      });
    });
    return map;
  }, [phasesWithFormats]);

  const isPriceMode = paymentMethod === "price";
  const isIndividualPrice = paymentMethod === "individual_price";
  const proposedPriceCents = parsePriceBRLToCents(proposedPriceInput);

  // ── Gating monetário (BRL) — mesmo padrão da aba de Inscrições ────────────
  // Convidar leva ao aceite que debita o saldo na aprovação. Bloqueamos a
  // ação cedo para não criar convites "fantasma" que travam quando o admin
  // tentar aprovar mais tarde. Saldo é o BRL real do workspace (Web2);
  // nunca usar HYPE/blockchain — ver feedback `saldo-brl-nao-blockchain`.
  const showApprovalCost =
    !!paymentMethod && SHOW_APPROVAL_COST_METHODS.has(paymentMethod);
  const balanceQ = useWorkspaceBalance();
  const availableCents = balanceQ.data?.available_cents ?? null;
  const committedCents = balanceQ.data?.committed_cents ?? null;

  /** Resolve a lista de formatos permitidos para o card baseado em sua rede. */
  const getAllowedPriceFormats = useCallback(
    (profileType: string | undefined): string[] | undefined => {
      if (!isPriceMode) return undefined;
      const key = profileType?.toLowerCase() ?? "";
      return allowedFormatsByNetwork[key] ?? [];
    },
    [isPriceMode, allowedFormatsByNetwork],
  );

  /**
   * Custo de convite (≡ custo de aprovação) por (rede, prices) em centavos BRL.
   * Memoizado para evitar recomputar a cada render do grid.
   * Retorna `null` quando o método não debita saldo (swap/cpa/cpm) ou
   * quando dados ainda não foram resolvidos.
   */
  const computeInviteCostCents = useCallback(
    (
      network: string | undefined,
      prices: Record<string, number> | undefined,
    ): number | null => {
      if (!showApprovalCost) return null;
      if (!network) return null;
      return computeApprovalCostCents(
        paymentMethod,
        network,
        prices,
        phasesWithFormats,
      );
    },
    [showApprovalCost, paymentMethod, phasesWithFormats],
  );

  /**
   * Resolve a flag de bloqueio de convite para um card específico.
   *  - Fail-open: se saldo, custo ou método ainda não resolvem, não bloqueia
   *    (o backend valida na hora do convite/aprovação como defesa em camadas).
   *  - Bloqueia somente quando custo > saldo disponível.
   */
  const resolveInviteGate = useCallback(
    (
      network: string | undefined,
      prices: Record<string, number> | undefined,
    ): { disabled: boolean; reason?: string } => {
      if (!showApprovalCost) return { disabled: false };
      if (availableCents == null) return { disabled: false };
      const cost = computeInviteCostCents(network, prices);
      if (cost == null) return { disabled: false };
      if (cost <= availableCents) return { disabled: false };
      return {
        disabled: true,
        reason: `Saldo do workspace insuficiente: necessário ${fmtBRL(cost)}, disponível ${fmtBRL(availableCents)}.`,
      };
    },
    [showApprovalCost, availableCents, computeInviteCostCents],
  );

  // Curadoria: restringe aos perfis nas redes da campanha (avisos / validação)
  const curationProfilesFiltered = useMemo(() => {
    if (allowedSocialNetworks.length === 0) return allProfilesList;
    return allProfilesList.filter((profile) => {
      const profileType = profile.type?.toLowerCase() || "";
      return allowedSocialNetworks.includes(profileType);
    });
  }, [allProfilesList, allowedSocialNetworks]);

  /** Referência estável para lista vazia — evita `useEffect` que depende de perfis disparar todo render. */
  const emptyProfileListRef = useRef<InfluencerProfile[]>([]);
  const influencerProfiles =
    modalType === "curation"
      ? curationProfilesFiltered
      : needsInviteProfilePicker
        ? invitableProfilesList
        : emptyProfileListRef.current;

  const isLoadingProfiles =
    modalType === "curation"
      ? isLoadingAllProfiles
      : needsInviteProfilePicker
        ? isLoadingInvitableProfiles
        : false;

  // Hooks para dados reais
  const { data: muralStatus } = useMuralStatus(campaignId);
  const { mutate: activateMural, isPending: isActivatingMural } = useActivateMural(campaignId);
  const { mutate: deactivateMural } = useDeactivateMural(campaignId);
  const {
    data: selectionData,
    isLoading: isLoadingSelection,
    isFetching: isFetchingSelection,
    isError: isSelectionError,
    error: selectionError,
    refetch: refetchSelection,
  } = useCampaignInfluencerSelection(campaignId, filterNiche, debouncedSearchTerm);
  const { mutate: inviteInfluencer, isPending: isInviting } = useInviteInfluencer(campaignId);
  const { mutate: addToPreSelection, isPending: isAddingToPreSelection } = useAddToPreSelection(campaignId);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateInfluencerStatus(campaignId);
  const { data: campaignUsers = [] } = useCampaignUsers(campaignId);

  const isMuralActive = muralStatus?.active || false;

  // Função para verificar se um influenciador está em curadoria
  const isInfluencerInCuration = (influencerId: string | number): boolean => {
    const influencerIdStr = String(influencerId);
    const influencerIdNum = typeof influencerId === "string" ? parseInt(influencerId, 10) : influencerId;

    const campaignUser = campaignUsers.find((user) => {
      // Verificar por user_id (influencerId)
      if (user.user_id) {
        const userId = typeof user.user_id === "string" ? parseInt(user.user_id, 10) : user.user_id;
        if (userId === influencerIdNum) {
          return true;
        }
      }
      // Verificar por id (campaignUserId) - caso o influencer.id seja o campaignUserId
      const campaignUserId = typeof user.id === "string" ? parseInt(String(user.id), 10) : Number(user.id);
      if (campaignUserId === influencerIdNum || String(user.id) === influencerIdStr) {
        return true;
      }
      return false;
    });

    if (!campaignUser) {
      return false;
    }

    // Normalizar status para comparação
    const status = campaignUser.status?.toLowerCase() || "";
    return status === "curation" || status === "curadoria";
  };

  const isInfluencerInvited = (influencerId: string | number): boolean => {
    const influencerIdNum =
      typeof influencerId === "string" ? parseInt(influencerId, 10) : influencerId;
    if (Number.isNaN(influencerIdNum)) return false;
    const campaignUser = campaignUsers.find((user) => {
      if (user.user_id != null) {
        const uid =
          typeof user.user_id === "string" ? parseInt(user.user_id, 10) : user.user_id;
        if (uid === influencerIdNum) return true;
      }
      return false;
    });
    if (!campaignUser) return false;
    const status = (campaignUser.status || "").toLowerCase();
    return status === "invited" || status === "convidados";
  };

  // Filtros consolidados. Numéricos parseados aqui (string vazia → sem limite).
  // Nicho e busca são resolvidos no SERVIDOR (antes do corte de 120); o que
  // sobra aqui é refino instantâneo sobre o resultado já carregado, usando a
  // mesma normalização — se o cliente fosse mais estrito, esconderia linhas
  // que a API acabou de devolver.
  const selectionFilters = useMemo<SelectionFilters>(() => {
    const toNum = (v: string): number | null => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) ? n : null;
    };
    return {
      searchTerm,
      nicheIds: filterNiche ? expandNicheWithDescendants(filterNiche, niches) : null,
      filterGender,
      followersMin: toNum(followersMinInput),
      followersMax: toNum(followersMaxInput),
      engagementMin: toNum(engagementMinInput),
      engagementMax: toNum(engagementMaxInput),
    };
  }, [
    searchTerm,
    filterNiche,
    niches,
    filterGender,
    followersMinInput,
    followersMaxInput,
    engagementMinInput,
    engagementMaxInput,
  ]);

  const hasActiveFilters =
    !!parseSearchTerm(selectionFilters.searchTerm) ||
    !!filterNiche ||
    !!selectionFilters.filterGender ||
    selectionFilters.followersMin != null ||
    selectionFilters.followersMax != null ||
    selectionFilters.engagementMin != null ||
    selectionFilters.engagementMax != null;

  const flattenedRecommended = useMemo(() => {
    if (!selectionData?.networks?.length) return [] as ExtendedInfluencer[];
    const pairs: { item: InfluencerSelectionProfileItem; type: string }[] = [];
    for (const net of selectionData.networks) {
      for (const item of net.recommended) {
        if (selectionItemMatchesFilters(item, selectionFilters)) {
          pairs.push({ item, type: net.type });
        }
      }
    }
    return sortSelectionPairs(pairs, order).map(({ item, type }) =>
      selectionItemToExtended(item, type, "recommended")
    );
  }, [selectionData, selectionFilters, order]);

  const flattenedCatalog = useMemo(() => {
    if (!selectionData?.networks?.length) return [] as ExtendedInfluencer[];
    const pairs: { item: InfluencerSelectionProfileItem; type: string }[] = [];
    for (const net of selectionData.networks) {
      for (const item of net.catalog) {
        if (selectionItemMatchesFilters(item, selectionFilters)) {
          pairs.push({ item, type: net.type });
        }
      }
    }
    return sortSelectionPairs(pairs, order).map(({ item, type }) =>
      selectionItemToExtended(item, type, "catalog")
    );
  }, [selectionData, selectionFilters, order]);

  const rawTotalProfiles = useMemo(() => {
    if (!selectionData?.networks?.length) return 0;
    let n = 0;
    for (const net of selectionData.networks) {
      n += net.recommended.length + net.catalog.length;
    }
    return n;
  }, [selectionData]);

  const totalFilteredProfiles =
    flattenedRecommended.length + flattenedCatalog.length;

  // Verificar se todas as vagas foram preenchidas
  const approvedInfluencersCount = useMemo(() => {
    return campaignUsers.filter((user) => {
      const status = user.status?.toLowerCase() || "";
      return status === "approved" || status === "aprovado";
    }).length;
  }, [campaignUsers]);

  const allVacanciesFilled = maxInfluencers > 0 && approvedInfluencersCount >= maxInfluencers;

  // Desativar automaticamente quando todas as vagas forem preenchidas
  useEffect(() => {
    if (isMuralActive && allVacanciesFilled) {
      deactivateMural(undefined, {
        onSuccess: () => {
          toast.success("Descobrir desativado automaticamente: todas as vagas foram preenchidas");
        },
        onError: () => {
          // Silently fail - mural deactivation is a best-effort operation
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuralActive, allVacanciesFilled]);

  const handleActivateMural = () => {
    if (!tempMuralEndDate) {
      toast.error("Por favor, selecione uma data limite");
      return;
    }

    activateMural(
      { end_date: tempMuralEndDate },
      {
        onSuccess: () => {
          toast.success("Mural ativado com sucesso!");
          setShowMuralDateModal(false);
          setTempMuralEndDate("");
        },
        onError: (error: Error) => {
          toast.error(error?.message || "Erro ao ativar mural");
        },
      }
    );
  };

  const handleAction = (influencer: Influencer, action: "discover" | "invite" | "curation" | "preselection") => {
    setSelectedInfluencer(influencer);
    setModalType(action);
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedInfluencer(null);
    setInviteMessage("");
    setProposedPriceInput("");
    setCurationNotes("");
    setSelectedProfileIds([]);
  };

  useEffect(() => {
    if (modalType !== "invite" && modalType !== "preselection") return;
    if (!selectedInfluencer) return;
    const sid = selectedInfluencer.socialNetworkId?.trim();
    let nextIds: string[] | null = null;
    if (sid) {
      nextIds = [sid];
    } else if (influencerProfiles.length > 0) {
      nextIds = influencerProfiles.map((p) => String(p.id));
    }
    if (nextIds == null) return;
    const idsToApply = nextIds;
    setSelectedProfileIds((prev) => {
      if (
        prev.length === idsToApply.length &&
        prev.every((id, i) => id === idsToApply[i])
      ) {
        return prev;
      }
      return idsToApply;
    });
  }, [
    modalType,
    selectedInfluencer?.id,
    selectedInfluencer?.socialNetworkId,
    influencerProfiles,
  ]);

  const handleConfirm = async () => {
    if (!selectedInfluencer) return;

    // Campanha "valor individual por criador": exige valor proposto no convite
    // e na pré-seleção.
    if (
      isIndividualPrice &&
      (modalType === "invite" || modalType === "preselection") &&
      proposedPriceCents <= 0
    ) {
      toast.error("Informe o valor proposto para o criador.");
      return;
    }

    if (modalType === "preselection") {
      const preProfileIds = resolveInviteProfileIds(
        selectedInfluencer,
        selectedProfileIds
      );
      addToPreSelection(
        {
          influencer_id: selectedInfluencer.id,
          message: inviteMessage || undefined,
          profile_ids: preProfileIds.length > 0 ? preProfileIds : undefined,
          ...(isIndividualPrice ? { proposed_price_cents: proposedPriceCents } : {}),
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "influencers"],
            });
            queryClient.invalidateQueries({
              queryKey: [
                "campaigns",
                campaignId,
                "influencers",
                selectedInfluencer.id,
                "invite-profiles",
              ],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "dashboard"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "users"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "influencer-selection"],
            });
            toast.success("Influenciador movido para pré-seleção!");
            handleCloseModal();
          },
          onError: (error: Error) => {
            toast.error(error?.message || "Erro ao mover para pré-seleção");
          },
        }
      );
      return;
    }

    if (modalType === "invite") {
      const inviteProfileIds = resolveInviteProfileIds(
        selectedInfluencer,
        selectedProfileIds
      );
      if (inviteProfileIds.length === 0) {
        toast.error(
          selectedInfluencer.socialNetworkId?.trim()
            ? "Não foi possível usar este perfil para o convite."
            : "Selecione pelo menos um perfil para convidar"
        );
        return;
      }

      inviteInfluencer(
        {
          influencer_id: selectedInfluencer.id,
          message: inviteMessage || undefined,
          profile_ids: inviteProfileIds,
          ...(isIndividualPrice ? { proposed_price_cents: proposedPriceCents } : {}),
        },
        {
          onSuccess: () => {
            // Invalidar queries para atualizar os dados automaticamente
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "influencers"],
            });
            queryClient.invalidateQueries({
              queryKey: [
                "campaigns",
                campaignId,
                "influencers",
                selectedInfluencer.id,
                "invite-profiles",
              ],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "dashboard"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "users"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "influencer-selection"],
            });
            toast.success("Influenciador convidado com sucesso!");
            handleCloseModal();
          },
          onError: (error: Error) => {
            toast.error(error?.message || "Erro ao convidar influenciador");
          },
        }
      );
    } else if (modalType === "curation") {
      // Validar se o influenciador tem perfis permitidos (se houver redes sociais definidas)
      if (allowedSocialNetworks.length > 0 && influencerProfiles.length === 0) {
        toast.error(
          `Este influenciador não possui perfis nas redes sociais definidas na campanha (${allowedSocialNetworks.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ")}). Não é possível adicioná-lo para curadoria.`
        );
        return;
      }

      // Tenta atualizar o status primeiro (caso o influenciador já esteja na campanha)
      updateStatus(
        {
          influencer_id: selectedInfluencer.id,
          status: "curation",
          feedback: curationNotes || undefined,
        },
        {
          onSuccess: () => {
            // Invalidar queries para atualizar os dados automaticamente
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "influencers"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "dashboard"],
            });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "users"],
            });
            toast.success("Influenciador adicionado para curadoria!");
            handleCloseModal();
          },
          onError: (error: Error) => {
            // Se o erro for que o influenciador não está na campanha, adiciona primeiro
            const errorMessage = error?.message || "";
            if (
              errorMessage.includes("não encontrado") ||
              errorMessage.includes("not found") ||
              errorMessage.includes("não está") ||
              errorMessage.includes("not in")
            ) {
              // Adiciona o influenciador à campanha primeiro
              inviteInfluencer(
                {
                  influencer_id: selectedInfluencer.id,
                  message: undefined,
                },
                {
                  onSuccess: () => {
                    // Após adicionar, atualiza o status para "curation"
                    updateStatus(
                      {
                        influencer_id: selectedInfluencer.id,
                        status: "curation",
                        feedback: curationNotes || undefined,
                      },
                      {
                        onSuccess: () => {
                          // Invalidar queries para atualizar os dados automaticamente
                          queryClient.invalidateQueries({
                            queryKey: ["campaigns", campaignId, "influencers"],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ["campaigns", campaignId, "dashboard"],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ["campaigns", campaignId, "users"],
                          });
                          toast.success("Influenciador adicionado para curadoria!");
                          handleCloseModal();
                        },
                        onError: (updateError: any) => {
                          toast.error(updateError?.message || "Erro ao atualizar status para curadoria");
                        },
                      }
                    );
                  },
                  onError: (inviteError: any) => {
                    toast.error(inviteError?.message || "Erro ao adicionar influenciador à campanha");
                  },
                }
              );
            } else {
              toast.error(errorMessage || "Erro ao adicionar influenciador para curadoria");
            }
          },
        }
      );
    } else {
      // Outras ações (discover) podem ser implementadas aqui
      handleCloseModal();
    }
  };

  const selectionErrorMessage =
    selectionError &&
    typeof selectionError === "object" &&
    selectionError !== null &&
    "message" in selectionError
      ? String((selectionError as { message?: string }).message)
      : isSelectionError
        ? "Não foi possível carregar a seleção de influenciadores."
        : "";

  const modalInvitePreProfileIds =
    selectedInfluencer && inviteOrPreselection
      ? resolveInviteProfileIds(selectedInfluencer, selectedProfileIds)
      : [];

  // Gating monetário no modal — só aplica para `invite` (pré-seleção não debita
  // saldo do workspace). Reusa o mesmo cálculo dos cards para manter consistência.
  // Quando o card já carrega `socialNetworkId`, temos rede + preços direto;
  // no fallback do picker o backend não envia prices por perfil (estrutura
  // `InfluencerProfile` atual) — fail-open e backend valida.
  const modalInviteGate = useMemo<{ disabled: boolean; reason?: string }>(() => {
    if (modalType !== "invite") return { disabled: false };
    if (!selectedInfluencer) return { disabled: false };
    return resolveInviteGate(
      selectedInfluencer.socialNetwork,
      selectedInfluencer.prices,
    );
  }, [modalType, selectedInfluencer, resolveInviteGate]);

  // Custo a reservar ao convidar (centavos BRL) — só quando o método debita saldo.
  const modalInviteCostCents = useMemo<number | null>(() => {
    if (modalType !== "invite" || !showApprovalCost || !selectedInfluencer) return null;
    return computeInviteCostCents(
      selectedInfluencer.socialNetwork,
      selectedInfluencer.prices,
    );
  }, [modalType, showApprovalCost, selectedInfluencer, computeInviteCostCents]);

  const invitePreSubmitDisabled =
    isInviting ||
    isAddingToPreSelection ||
    isUpdatingStatus ||
    (inviteOrPreselection &&
      (needsInviteProfilePicker
        ? isLoadingProfiles || modalInvitePreProfileIds.length === 0
        : modalInvitePreProfileIds.length === 0)) ||
    (inviteOrPreselection && isIndividualPrice && proposedPriceCents <= 0) ||
    modalInviteGate.disabled;

  return (
    <>
      {isLoadingSelection && !selectionData ? (
        <InfluencerSelectionTabSkeleton />
      ) : isSelectionError && !selectionData ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger-200 bg-danger-50 px-6 py-12">
          <p className="text-center text-base text-danger-900">
            {selectionErrorMessage}
          </p>
          <Button type="button" variant="outline" onClick={() => refetchSelection()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Figma Frame 163 — título da página */}
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold leading-7 text-neutral-950">
              Selecione influenciadores
            </h2>
            <p className="max-w-2xl text-base leading-5 text-neutral-500">
              Busque, filtre e convide perfis para participar da campanha — individualmente ou em
              massa.
            </p>
          </div>

          {isSelectionError && selectionData ? (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
              Erro ao atualizar.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => refetchSelection()}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {!selectionData?.networks?.length ? (
            <div className="rounded-[28px] bg-white p-12 text-center text-neutral-500">
              Nenhum dado de seleção retornado para esta campanha.
            </div>
          ) : rawTotalProfiles === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-12 text-center text-neutral-500">
              Nenhum perfil disponível na seleção (todos podem já estar na campanha ou não há dados).
            </div>
          ) : (
            <>
              {/* Figma 2380:10687 — Recomendado + carrossel */}
              <section className="flex flex-col gap-6 rounded-[28px] bg-white p-5">
                <h3 className="text-[22px] font-semibold leading-6 tracking-[-0.03em] text-neutral-950">
                  Recomendado com base no perfil da campanha
                </h3>
                {flattenedRecommended.length === 0 ? (
                  <p className="py-10 text-center text-base text-neutral-500">
                    Nenhum influenciador recomendado para o segmento desta campanha.
                  </p>
                ) : (
                  <SelectionRecommendedCarousel
                    items={flattenedRecommended}
                    renderCard={(influencer) => {
                      const { data, nicheName } = buildSelectionCardData(influencer, niches);
                      const inCuration = isInfluencerInCuration(influencer.id);
                      const inviteGate = resolveInviteGate(data.profileType, data.prices);
                      return (
                        <InfluencerProfileCard
                          data={{
                            ...data,
                            prices: isPriceMode ? data.prices : undefined,
                          }}
                          nicheName={nicheName}
                          allowedPriceFormats={getAllowedPriceFormats(data.profileType)}
                          statusBadge={isInfluencerInvited(influencer.id) ? "invited" : undefined}
                          onInvite={!inCuration ? () => handleAction(influencer, "invite") : undefined}
                          onPreSelection={() => handleAction(influencer, "preselection")}
                          disableInvite={inviteGate.disabled}
                          disableInviteReason={inviteGate.reason}
                          onViewProfile={() =>
                            navigate({
                              to: "/influencer/$influencerId",
                              params: { influencerId: influencer.id },
                            })
                          }
                        />
                      );
                    }}
                  />
                )}
              </section>

              {/* Figma 2380:10373 — filtros em linha */}
              <section className="rounded-[28px] bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">
                      Buscar influenciador
                    </label>
                    <div className="flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4">
                      <Icon name="Search" color="#A3A3A3" size={20} />
                      <input
                        type="text"
                        placeholder="Nome ou @username"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">Nicho</label>
                    <Select
                      placeholder="Selecione um nicho"
                      options={niches.map((n) => ({ value: String(n.id), label: n.name }))}
                      value={filterNiche}
                      onChange={setFilterNiche}
                      isSearchable
                    />
                  </div>
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">
                      Gênero
                    </label>
                    <Select
                      placeholder="Todos os gêneros"
                      options={SELECTION_GENDER_OPTIONS}
                      value={filterGender}
                      onChange={setFilterGender}
                    />
                  </div>
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">
                      Seguidores
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 flex-1 items-center rounded-full bg-neutral-100 px-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="mín"
                          value={followersMinInput}
                          onChange={(e) =>
                            setFollowersMinInput(e.target.value.replace(/\D/g, ""))
                          }
                          className="w-full bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                        />
                      </div>
                      <span className="text-neutral-400">–</span>
                      <div className="flex h-11 flex-1 items-center rounded-full bg-neutral-100 px-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="máx"
                          value={followersMaxInput}
                          onChange={(e) =>
                            setFollowersMaxInput(e.target.value.replace(/\D/g, ""))
                          }
                          className="w-full bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">
                      Engajamento (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 flex-1 items-center rounded-full bg-neutral-100 px-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="mín"
                          value={engagementMinInput}
                          onChange={(e) =>
                            setEngagementMinInput(
                              e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")
                            )
                          }
                          className="w-full bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                        />
                      </div>
                      <span className="text-neutral-400">–</span>
                      <div className="flex h-11 flex-1 items-center rounded-full bg-neutral-100 px-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="máx"
                          value={engagementMaxInput}
                          onChange={(e) =>
                            setEngagementMaxInput(
                              e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")
                            )
                          }
                          className="w-full bg-transparent text-base text-neutral-950 placeholder:text-neutral-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1">
                    <label className="text-base font-medium leading-5 text-neutral-950">
                      Ordenar por
                    </label>
                    <Select
                      placeholder="Padrão"
                      options={SELECTION_ORDER_OPTIONS}
                      value={order}
                      onChange={setOrder}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-full border-neutral-200 px-4 font-semibold opacity-90 w-max"
                    onClick={() => setModalType("selectList")}
                  >
                    Selecionar lista
                  </Button>
                </div>
                {rawTotalProfiles > 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">
                    {totalFilteredProfiles} de {rawTotalProfiles} perfis
                    {hasActiveFilters ? " (filtros aplicados)" : ""}
                  </p>
                ) : null}
              </section>

              {/* Figma 2380:11287 — Todos os influenciadores + grid 4 colunas */}
              <section className="flex flex-col gap-6 rounded-[28px] bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-[22px] font-semibold leading-6 tracking-[-0.03em] text-neutral-950">
                    Todos os influenciadores
                  </h3>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full border-neutral-200 px-4 font-semibold min-w-max"
                      onClick={() =>
                        toast.info("Em breve: convite em massa para vários perfis selecionados.")
                      }
                    >
                      Múltiplos convites
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full border-neutral-200 px-4 font-semibold min-w-max"
                      onClick={() =>
                        toast.info("Em breve: pré-seleção em massa para vários perfis.")
                      }
                    >
                      Múltiplas pré-seleções
                    </Button>
                  </div>
                </div>

                {flattenedCatalog.length === 0 ? (
                  <p className="py-10 text-center text-base text-neutral-500">
                    Nenhum perfil no catálogo com os filtros atuais.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {flattenedCatalog.map((influencer) => {
                      const { data, nicheName } = buildSelectionCardData(influencer, niches);
                      const inCuration = isInfluencerInCuration(influencer.id);
                      const inviteGate = resolveInviteGate(data.profileType, data.prices);
                      return (
                        <InfluencerProfileCard
                          key={`all-${influencer.socialNetwork}-${influencer.socialNetworkId}`}
                          data={{
                            ...data,
                            prices: isPriceMode ? data.prices : undefined,
                          }}
                          nicheName={nicheName}
                          allowedPriceFormats={getAllowedPriceFormats(data.profileType)}
                          statusBadge={isInfluencerInvited(influencer.id) ? "invited" : undefined}
                          onInvite={!inCuration ? () => handleAction(influencer, "invite") : undefined}
                          onPreSelection={() => handleAction(influencer, "preselection")}
                          disableInvite={inviteGate.disabled}
                          disableInviteReason={inviteGate.reason}
                          onViewProfile={() =>
                            navigate({
                              to: "/influencer/$influencerId",
                              params: { influencerId: influencer.id },
                            })
                          }
                        />
                      );
                    })}
                  </div>
                )}

                {isFetchingSelection && !isLoadingSelection ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-neutral-600">
                    <Icon name="Loader" size={24} className="animate-spin" color="#737373" />
                    <span className="text-base">Carregando influenciadores...</span>
                  </div>
                ) : null}
              </section>

              {totalFilteredProfiles === 0 &&
              rawTotalProfiles > 0 &&
              hasActiveFilters ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 py-12 text-center text-neutral-500">
                  Nenhum perfil corresponde aos filtros selecionados.
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* Modais */}
      {selectedInfluencer && modalType && (
        <Modal
          title={
            modalType === "discover"
              ? "Ativar Discover"
              : modalType === "invite"
                ? "Convidar para campanha"
                : modalType === "preselection"
                  ? "Mover para pré-seleção"
                  : "Adicionar para curadoria"
          }
          onClose={handleCloseModal}
          panelClassName={
            modalType === "invite" || modalType === "preselection"
              ? "max-w-[800px]"
              : undefined
          }
        >
          <div className="flex flex-col gap-6">
            {(modalType === "invite" || modalType === "preselection") && (
              <>
                {needsInviteProfilePicker && (
                  <div className="flex flex-col gap-3">
                    <p className="text-base font-medium text-neutral-950">
                      {modalType === "invite"
                        ? "Selecione o perfil para convite"
                        : "Quais perfis incluir na pré-seleção?"}
                    </p>
                    {isLoadingProfiles ? (
                      <p className="text-sm text-neutral-500">Carregando perfis...</p>
                    ) : influencerProfiles.length === 0 ? (
                      <div className="rounded-[22px] bg-canvas p-4 text-center">
                        <p className="text-sm text-neutral-500">
                          Nenhum perfil disponível para convite ou pré-seleção nesta campanha.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {influencerProfiles.map((profile) => {
                          const isSelected = selectedProfileIds.includes(profile.id);
                          const networkLabel =
                            profile.type_label || getNetworkLabel(profile.type, profile.type || "N/A");
                          const handle = profile.username?.replace(/^@/, "").trim() || "—";
                          const avatarSrc = profile.avatar
                            ? getUploadUrl(profile.avatar) ?? undefined
                            : undefined;
                          const followersLabel = formatFollowers(profile.members ?? 0);
                          const engagementLabel = formatEngagementPercent(
                            profile.engagement_percent ?? undefined
                          );

                          return (
                            <button
                              key={profile.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedProfileIds(
                                    selectedProfileIds.filter((id) => id !== profile.id)
                                  );
                                } else {
                                  setSelectedProfileIds([...selectedProfileIds, profile.id]);
                                }
                              }}
                              className={`group flex w-full cursor-pointer items-stretch gap-3 rounded-[22px] border-2 p-3 text-left transition-colors sm:gap-4 sm:p-4 ${
                                isSelected
                                  ? "border-primary-600 bg-primary-50/40 ring-1 ring-primary-600/20"
                                  : "border-neutral-200 bg-canvas hover:border-neutral-300 hover:bg-white"
                              }`}
                            >
                              <span
                                className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                  isSelected
                                    ? "border-primary-600 bg-primary-600"
                                    : "border-neutral-300 bg-white group-hover:border-neutral-400"
                                }`}
                              >
                                {isSelected && (
                                  <Icon name="Check" size={14} color="#FAFAFA" />
                                )}
                              </span>
                              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-neutral-200 sm:size-16">
                                {avatarSrc ? (
                                  <img
                                    src={avatarSrc}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-xs font-semibold uppercase text-neutral-500">
                                    {networkLabel.slice(0, 2)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-800">
                                    {networkLabel}
                                  </span>
                                </div>
                                <p className="truncate text-base font-semibold text-neutral-950">
                                  @{handle}
                                </p>
                                {profile.name?.trim() &&
                                  profile.name.trim().toLowerCase() !== handle.toLowerCase() && (
                                    <p className="truncate text-sm text-neutral-600">
                                      {profile.name}
                                    </p>
                                  )}
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                                  <span>
                                    <span className="text-neutral-500">Seguidores </span>
                                    <span className="font-medium text-neutral-900">
                                      {followersLabel}
                                    </span>
                                  </span>
                                  <span>
                                    <span className="text-neutral-500">Engajamento </span>
                                    <span className="font-medium text-neutral-900">
                                      {engagementLabel}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Figma 2387:12772 — resumo do convite (rede já definida pelo card) */}
                <div className="rounded-xl bg-neutral-100 p-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={selectedInfluencer.name}
                      src={selectedInfluencer.avatar}
                      className="size-11 rounded-xl"
                      textClassName="text-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold leading-5 text-neutral-950">
                        {selectedInfluencer.name}
                      </p>
                      <p className="truncate text-sm leading-5 text-neutral-500">
                        @{selectedInfluencer.username}
                      </p>
                      {selectedInfluencer.socialNetwork ? (
                        <p className="mt-1 text-xs font-medium text-neutral-600">
                          {getNetworkLabel(selectedInfluencer.socialNetwork, selectedInfluencer.socialNetwork || "N/A")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-base font-medium text-neutral-950">
                    Mensagem para o convidado (opcional)
                  </label>
                  <textarea
                    placeholder="Digite uma mensagem..."
                    value={inviteMessage}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 25) setInviteMessage(value);
                    }}
                    maxLength={25}
                    className="min-h-[120px] w-full resize-y rounded-[22px] border-0 bg-canvas px-4 py-3 text-base text-neutral-950 outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500/30"
                  />
                  <div className="flex justify-end">
                    <span
                      className={`text-xs ${inviteMessage.length >= 25 ? "text-danger-600" : "text-neutral-500"}`}
                    >
                      {inviteMessage.length}/25
                    </span>
                  </div>
                </div>

                {isIndividualPrice && (
                  <div className="flex flex-col gap-2 rounded-xl bg-primary-50 p-4">
                    <label className="text-base font-medium text-neutral-950">
                      Valor proposto ao criador{" "}
                      <span className="text-danger-600" aria-hidden>*</span>
                    </label>
                    <p className="text-xs text-neutral-500">
                      Campanha de <strong>valor individual por criador</strong>: o
                      criador poderá aceitar ou enviar uma contraproposta. O saldo
                      só é reservado quando o valor fecha.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-500">R$</span>
                      <input
                        inputMode="decimal"
                        value={proposedPriceInput}
                        onChange={(e) => setProposedPriceInput(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-base text-neutral-950 outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>
                    {proposedPriceCents > 0 && (
                      <span className="text-xs text-neutral-500">
                        Valor: {fmtBRL(proposedPriceCents)}
                      </span>
                    )}
                  </div>
                )}

                {modalType === "invite" && showApprovalCost && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-neutral-600">
                      Ao convidar, este valor fica{" "}
                      <span className="font-medium text-amber-700">reservado</span> do seu
                      saldo para este influencer.
                    </p>
                    <ReserveBalancePreview
                      costCents={modalInviteCostCents}
                      availableCents={availableCents}
                      committedCents={committedCents}
                    />
                  </div>
                )}

                {modalInviteGate.disabled && modalInviteGate.reason && (
                  <div className="rounded-xl border border-danger-200 bg-danger-50 p-3">
                    <p className="flex items-start gap-2 text-sm leading-relaxed text-danger-900">
                      <Icon name="TriangleAlert" size={16} color="#dc2626" />
                      <span>{modalInviteGate.reason}</span>
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    className="h-11 rounded-full border-neutral-200 px-6 text-base font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={invitePreSubmitDisabled}
                    title={
                      modalInviteGate.disabled
                        ? modalInviteGate.reason
                        : undefined
                    }
                    className="h-11 rounded-full border-0 bg-primary-600 px-6 text-base font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInviting
                      ? "Processando..."
                      : isAddingToPreSelection
                        ? "Processando..."
                        : modalType === "preselection"
                          ? "Mover para pré-seleção"
                          : "Enviar convite"}
                  </Button>
                </div>
              </>
            )}

            {modalType !== "invite" && modalType !== "preselection" && (
              <div className="flex items-center gap-4">
                <Avatar
                  src={selectedInfluencer?.avatar || ""}
                  alt={selectedInfluencer?.name || ""}
                  size="lg"
                />
                <div>
                  <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
                    {selectedInfluencer?.name}
                  </h3>
                  <p className="text-neutral-600">@{selectedInfluencer?.username}</p>
                </div>
              </div>
            )}

            {modalType === "discover" && (
              <div className="bg-primary-50 rounded-2xl p-4">
                <p className="text-sm text-primary-900">
                  O Discover permite que este influenciador encontre sua campanha
                  automaticamente através de recomendações baseadas no perfil dele.
                </p>
              </div>
            )}

            {modalType === "curation" && (
              <div className="flex flex-col gap-4">
                {isLoadingProfiles ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-neutral-600">Verificando perfis...</p>
                  </div>
                ) : allowedSocialNetworks.length > 0 && influencerProfiles.length === 0 ? (
                  <div className="bg-warning-50 border-2 border-warning-300 rounded-2xl p-4">
                    <p className="text-sm text-warning-900 font-medium mb-1">
                      Atenção: Perfis não compatíveis
                    </p>
                    <p className="text-xs text-warning-700">
                      Este influenciador não possui perfis nas redes sociais definidas na campanha ({allowedSocialNetworks.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ")}).
                      Ainda assim, você pode adicioná-lo para curadoria, mas ele precisará ter perfis compatíveis para participar da campanha.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <Textarea
                    label="Notas para curadoria"
                    placeholder="Adicione observações sobre este influenciador..."
                    value={curationNotes}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 25) {
                        setCurationNotes(value);
                      }
                    }}
                    maxLength={25}
                  />
                  <div className="flex justify-end">
                    <span className={`text-xs ${curationNotes.length >= 25 ? "text-danger-600" : "text-neutral-500"}`}>
                      {curationNotes.length}/25
                    </span>
                  </div>
                </div>
              </div>
            )}

            {modalType !== "selectList" && modalType !== "invite" && modalType !== "preselection" && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleCloseModal} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1"
                  disabled={isInviting || isAddingToPreSelection || isUpdatingStatus}
                >
                  {isInviting || isAddingToPreSelection || isUpdatingStatus
                    ? "Processando..."
                    : modalType === "curation"
                      ? "Adicionar para curadoria"
                      : "Confirmar"}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de seleção de lista */}
      {modalType === "selectList" && (
        <ListSelector
          campaignId={campaignId}
          paymentMethod={paymentMethod}
          defaultOpen
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de data limite do mural (só renderiza aqui quando não controlado pelo parent) */}
      {!onOpenMuralModal && showMuralDateModal && (() => {
        const phase1Date = _campaignPhases?.[0]?.publish_date || "";
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
                  onClick={handleActivateMural}
                  disabled={!tempMuralEndDate || isActivatingMural || !validation.valid}
                  className="flex-1"
                >
                  {isActivatingMural ? "Ativando..." : "Ativar Descobrir"}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </>
  );
}

