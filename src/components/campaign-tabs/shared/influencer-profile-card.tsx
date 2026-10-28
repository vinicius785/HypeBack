import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { SocialNetworkIcon } from "@/components/social-network-icon";
import { getSocialNetworkProfileUrl, getNetworkLabel } from "@/shared/constants/network-labels";
import { splitNicheNames } from "@/shared/utils/niche-display";
import {
  computePriceData,
  fmtBRL,
  FORMAT_LABELS,
  type PriceData,
  type PriceRow,
} from "./prices-utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface InfluencerCardData {
  profileKey: string;
  influencerName: string;
  influencerAvatar: string;
  /** Tipo da rede social (instagram, tiktok, youtube…) */
  profileType: string;
  profileTypeLabel: string;
  /** Handle do influenciador NA rede social (usado para montar o link externo) */
  profileUsername: string;
  influencerFollowers: number;
  profileFollowers: number;
  influencerEngagement: number;
  /** Motivo de recomendação (seleção de influenciadores) */
  recommendationReason?: string;
  updatedAt?: string | null;
  isExternal?: boolean;
  /** Preços por formato (centavos) — exibido quando paymentMethod === "price" */
  prices?: Record<string, number>;
  /**
   * Distância em km do admin até o influenciador.
   * Presente só quando o filtro "Perto de mim" está ativo no catálogo de criadores.
   */
  distanceKm?: number | null;
}

interface InfluencerProfileCardProps {
  data: InfluencerCardData;
  /** Nicho principal (legado). Quando ambos nicheName e nicheNames estão presentes, nicheNames prevalece. */
  nicheName?: string | null;
  /** Lista completa de nichos (principal + sub-nichos). Exibe até 2 chips + "Ver mais (+N)". */
  nicheNames?: readonly string[] | null;
  isSelected?: boolean;
  isActionLoading?: boolean;
  metaLabel?: string;
  /** Badge de status no lugar dos botões de ação primários */
  statusBadge?: "approved" | "rejected" | "invited";
  /** Exibe botão de seleção (checkbox circular) no canto do avatar */
  selectable?: boolean;
  onSelect?: () => void;
  // Ações: inscrições / curadoria
  onApprove?: () => void;
  onReject?: () => void;
  onMoveToCuration?: () => void;
  // Ações: seleção de influenciadores
  onInvite?: () => void;
  onPreSelection?: () => void;
  // Ação universal
  onViewProfile?: () => void;
  onSaveToList?: () => void;
  /** Listas em que esse influenciador já está — controla o visual do bookmark */
  inLists?: Array<{ id: string; name: string }>;
  /**
   * Slot para informação extra antes das ações (ex.: custo de aprovação).
   * Renderizado entre o nicho e o bloco de preços do influenciador.
   */
  costSlot?: React.ReactNode;
  /**
   * Quando true, desabilita o botão "Aprovar" mesmo que `onApprove` esteja
   * presente. Usado para bloquear aprovação por saldo insuficiente.
   */
  disableApprove?: boolean;
  /** Mensagem exibida como tooltip quando `disableApprove` é true. */
  disableApproveReason?: string;
  /**
   * Quando true, desabilita o botão "Convidar" mesmo que `onInvite` esteja
   * presente. Usado para bloquear convite por saldo insuficiente (mesmo
   * gating monetário aplicado à aprovação na aba de Inscrições).
   */
  disableInvite?: boolean;
  /** Mensagem exibida como tooltip quando `disableInvite` é true. */
  disableInviteReason?: string;
  /**
   * Lista de formatos (contentType) que a campanha exige para a rede deste
   * card. Quando informada, o bloco de preços:
   *   - Filtra apenas os formatos pedidos pela campanha.
   *   - Mostra total ao final.
   *   - Sinaliza formatos sem preço definido pelo influenciador.
   * Array vazio = a campanha não usa esta rede → bloco oculto.
   * `undefined` = comportamento legado: lista todos os preços sem total
   * (usado no catálogo de criadores).
   */
  allowedPriceFormats?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("pt-BR");
}

function formatEngagement(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return `${(n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.?0+$/, "")}%`;
}

// `CAMPAIGN_FORMAT_FALLBACKS`, `getCampaignFormatFallbacks` e `FORMAT_LABELS`
// agora vivem em `./prices-utils.ts` (compartilhados com as abas).

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Card de influenciador unificado — usado nas abas de Seleção, Inscrições e Curadoria.
 *
 * Layout alinhado à aba de seleção de influenciadores:
 *  - Avatar à esquerda, ícone da rede social + bookmark à direita
 *  - O ícone da rede social é um link externo quando o handle está disponível
 *  - Estatísticas em grid 2 colunas
 *  - Ações configuradas via props opcionais
 */
export function InfluencerProfileCard({
  data,
  nicheName,
  nicheNames,
  isSelected = false,
  isActionLoading = false,
  statusBadge,
  selectable = false,
  onSelect,
  onApprove,
  onReject,
  onMoveToCuration,
  onInvite,
  onPreSelection,
  onViewProfile,
  onSaveToList,
  inLists,
  costSlot,
  disableApprove = false,
  disableApproveReason,
  disableInvite = false,
  disableInviteReason,
  allowedPriceFormats,
}: InfluencerProfileCardProps) {
  const rawFollowers =
    data.profileFollowers != null && data.profileFollowers > 0
      ? data.profileFollowers
      : data.influencerFollowers;
  const followers = Number(rawFollowers ?? 0);
  const engagementDisplay = formatEngagement(data.influencerEngagement);
  const networkLabel = getNetworkLabel(data.profileType, data.profileTypeLabel || "Rede social");
  const socialUrl = getSocialNetworkProfileUrl(data.profileType, data.profileUsername);

  // O ícone da rede é um link quando temos URL, senão um div decorativo
  const networkIconContent = (
    <SocialNetworkIcon networkType={data.profileType} size={22} color="#404040" />
  );
  const networkIconEl = socialUrl ? (
    <a
      href={socialUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex size-10 items-center justify-center rounded-lg border border-neutral-200/90 bg-white shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
      title={`Ver perfil no ${networkLabel}`}
      aria-label={`Abrir perfil no ${networkLabel}`}
    >
      {networkIconContent}
    </a>
  ) : (
    <div
      className="flex size-10 items-center justify-center rounded-lg border border-neutral-200/90 bg-white shadow-sm"
      title={networkLabel}
      aria-label={`Rede: ${networkLabel}`}
    >
      {networkIconContent}
    </div>
  );

  return (
    <div
      className={`flex min-h-[320px] w-full min-w-0 flex-col gap-5 rounded-xl bg-neutral-100 p-3 border transition-colors ${isSelected && selectable
        ? "border-primary-500 ring-1 ring-primary-200"
        : "border-transparent"
        }`}
    >
      {/* Topo: avatar + [ícone rede + bookmark] */}
      <div className="flex items-start justify-between gap-2">
        <div className="relative shrink-0">
          <UserAvatar
            name={data.influencerName}
            src={data.influencerAvatar}
            className="size-[60px] rounded-2xl"
            textClassName="text-lg"
          />

          {selectable && (
            <button
              type="button"
              onClick={onSelect}
              aria-pressed={isSelected}
              className="absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm"
            >
              {isSelected ? (
                <Icon name="Check" size={14} color="var(--color-primary-600)" />
              ) : (
                <div className="size-3 rounded-full border-2 border-neutral-300" />
              )}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {networkIconEl}
          {onSaveToList && (
            <button
              type="button"
              onClick={onSaveToList}
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${(inLists?.length ?? 0) > 0
                ? "bg-[#ffdf2a] hover:bg-[#f5d400]"
                : "border border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              aria-label={(inLists?.length ?? 0) > 0 ? "Gerenciar listas" : "Adicionar à lista"}
              title={(inLists?.length ?? 0) > 0 ? `Em ${inLists!.length} lista${inLists!.length > 1 ? "s" : ""}` : "Adicionar à lista"}
            >
              <Icon
                name={(inLists?.length ?? 0) > 0 ? "BookmarkCheck" : "Bookmark"}
                size={22}
                color="#171717"
              />
            </button>
          )}
        </div>

      </div>

      {/* Nome + @username */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xl font-medium leading-6 text-neutral-950">
            {data.influencerName}
          </p>

        </div>
        <p className="truncate text-sm leading-6 text-neutral-600">
          @{data.profileUsername}
        </p>
        {data.distanceKm != null && (
          <span className="mt-0.5 flex w-max items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            <Icon name="MapPin" size={12} color="var(--color-primary-600)" />
            ~{data.distanceKm.toFixed(1)} km de você
          </span>
        )}
        {data.isExternal && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 w-max">
            Externo
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Stats */}
        <div className="flex gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-lg bg-neutral-200 p-3">
            <p className="text-sm text-neutral-600">Seguidores</p>
            <p className="text-xl font-medium text-neutral-950">{formatFollowers(followers)}</p>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-lg bg-neutral-200 p-3">
            <p className="text-sm text-neutral-600">Engajamento</p>
            <p className="text-xl font-medium text-neutral-950">{engagementDisplay}</p>
          </div>
        </div>

        {/* Nichos — até 2 chips menores; "+N mais" abre modal com todos */}

        <NichesRow
          names={nicheNames ?? (nicheName ? [nicheName] : [])}
          influencerName={data.influencerName}
        />

        {costSlot}

        <PricesTriggerAndModal
          influencerName={data.influencerName}
          network={data.profileType}
          prices={data.prices}
          allowedPriceFormats={allowedPriceFormats}
        />


        {/* Motivo de recomendação (seleção) */}
        {data.recommendationReason?.trim() && (
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-800">
            {data.recommendationReason}
          </p>
        )}

      </div>
      {/* Ações */}
      <div className="flex flex-col gap-3">
        {data.updatedAt && (
          <p className="text-base font-medium text-neutral-500 leading-5">Enviado em: {new Date(data.updatedAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}</p>
        )}

        {statusBadge === "invited" ? (
          <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-neutral-200 bg-transparent px-4 opacity-90">
            <span className="text-center text-base font-semibold text-neutral-800">Convidado</span>
          </div>
        ) : statusBadge === "approved" || statusBadge === "rejected" ? (
          <p className="text-base font-medium text-neutral-600">
            {statusBadge === "approved" ? "Aprovado para campanha" : "× Reprovado"}
          </p>
        ) : (
          <>
            {(onInvite || onPreSelection || onApprove || onReject) && (
              <div className="flex flex-wrap gap-1">
                {onInvite && (
                  <Button
                    type="button"
                    className="h-11 px-1 rounded-full border border-neutral-200 bg-primary-600 font-semibold text-base text-neutral-50 hover:bg-primary-700 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={onInvite}
                    disabled={isActionLoading || disableInvite}
                    title={disableInvite ? disableInviteReason : undefined}
                  >
                    Convidar
                  </Button>
                )}
                {onPreSelection && (
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-11 px-1 rounded-full border-neutral-200 font-semibold text-base flex-1`}
                    onClick={onPreSelection}
                    disabled={isActionLoading}
                  >
                    Pré-seleção
                  </Button>
                )}
                {onApprove && (
                  <Button
                    onClick={onApprove}
                    disabled={isActionLoading || disableApprove}
                    title={disableApprove ? disableApproveReason : undefined}
                    className="h-11 rounded-full border-0 bg-primary-600 text-base font-semibold text-white hover:bg-primary-700 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="Check" size={20} color="#fafafa" />
                    Aprovar
                  </Button>
                )}
                {onReject && (
                  <Button
                    variant="outline"
                    onClick={onReject}
                    disabled={isActionLoading}
                    className="h-11 rounded-full border-neutral-200 text-base font-semibold text-neutral-600 hover:bg-neutral-50 flex-1"
                  >
                    <Icon name="X" size={20} color="#525252" />
                    Reprovar
                  </Button>
                )}
              </div>
            )}

            {/* Links secundários */}
            {(onViewProfile || onMoveToCuration || onSaveToList) && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {onViewProfile && (
                  <button
                    type="button"
                    onClick={onViewProfile}
                    className="flex cursor-pointer items-center gap-1 text-base font-medium text-neutral-600 underline decoration-solid hover:text-neutral-800"
                  >
                    <Icon name="ExternalLink" size={20} color="#4d4d4d" />
                    Ver perfil
                  </button>
                )}
                {onSaveToList && (
                  <button
                    type="button"
                    onClick={onSaveToList}
                    className="flex cursor-pointer items-center gap-1 text-base font-medium text-primary-600 underline decoration-solid hover:text-primary-800"
                  >
                    <Icon name="BookmarkPlus" size={20} color="var(--color-primary-600)" />
                    Adicionar à lista
                  </button>
                )}
                {onMoveToCuration && (
                  <button
                    type="button"
                    onClick={onMoveToCuration}
                    disabled={isActionLoading}
                    className="flex items-center gap-1 text-base font-medium text-neutral-500 underline hover:text-neutral-700"
                  >
                    <Icon name="ArrowRight" size={16} color="#737373" />
                    Mover para curadoria
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NichesRow — chips compactos + "Ver mais (+N)" → modal
// ---------------------------------------------------------------------------

const MAX_NICHES_VISIBLE = 2;

function NichesRow({
  names,
  influencerName,
}: {
  names: readonly string[];
  influencerName: string;
}) {
  const [open, setOpen] = useState(false);

  // Normaliza: split por vírgula (backend pode mandar tudo numa string só),
  // dedupe case-insensitive, descarta vazios mantendo a ordem original.
  const cleaned = splitNicheNames(names.join(","));

  if (cleaned.length === 0) return null;

  const visible = cleaned.slice(0, MAX_NICHES_VISIBLE);
  const remaining = cleaned.length - visible.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((name) => (
          <span
            key={name}
            title={name}
            className="max-w-[140px] truncate rounded bg-[#f2e2ff] px-1.5 py-0.5 text-xs font-medium leading-tight text-primary-700"
          >
            {name}
          </span>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-primary-300 bg-white px-2.5 py-0.5 text-xs font-medium leading-tight text-primary-700 transition-colors hover:bg-primary-50"
            aria-label={`Ver mais ${remaining} nicho${remaining > 1 ? "s" : ""}`}
          >
            +{remaining} mais
          </button>
        )}
      </div>

      {open && (
        <Modal
          title="Nichos do influenciador"
          onClose={() => setOpen(false)}
          panelClassName="max-w-md"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-500">
              <span className="font-medium text-neutral-800">{influencerName}</span>{" "}
              · {cleaned.length} {cleaned.length === 1 ? "nicho" : "nichos"}
            </p>
            <div className="flex flex-wrap gap-2">
              {cleaned.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-[#f2e2ff] px-3 py-1 text-sm font-medium text-primary-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PricesTriggerAndModal — gatilho compacto + modal com breakdown completo
// ---------------------------------------------------------------------------

/**
 * Modo de debug do bloco de preços. Ativar via console:
 *   localStorage.setItem("hypeapp:debug-prices", "1")
 * Desativar:
 *   localStorage.removeItem("hypeapp:debug-prices")
 * Sem flag → nenhum custo extra de render/log.
 */
const PRICES_DEBUG_FLAG = "hypeapp:debug-prices";
function isPricesDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRICES_DEBUG_FLAG) === "1";
  } catch {
    return false;
  }
}

interface PricesTriggerAndModalProps {
  influencerName: string;
  /** Tipo da rede social do card — usado para resolver fallbacks de formato. */
  network: string;
  prices: Record<string, number> | undefined;
  allowedPriceFormats: readonly string[] | undefined;
}

function PricesTriggerAndModal({
  influencerName,
  network,
  prices,
  allowedPriceFormats,
}: PricesTriggerAndModalProps) {
  const [open, setOpen] = useState(false);
  const { influencer_values_read } = useWorkspacePermissions();

  const data = computePriceData(prices, allowedPriceFormats, network);

  // Log único ao abrir o modal — só dispara com a flag ligada.
  // Mostra exatamente o que entrou (prices brutos do backend, allowedPriceFormats
  // da campanha) e o que saiu (linhas computadas + totais).
  useEffect(() => {
    if (!open) return;
    if (!isPricesDebugEnabled()) return;
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[PricesDebug] ${influencerName} (${network})`);
    // eslint-disable-next-line no-console
    console.log("network:", network);
    // eslint-disable-next-line no-console
    console.log("prices (raw do backend):", prices);
    // eslint-disable-next-line no-console
    console.log("allowedPriceFormats (campanha):", allowedPriceFormats);
    // eslint-disable-next-line no-console
    console.log("computed:", data);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [open, influencerName, network, prices, allowedPriceFormats, data]);

  // Sem permissão de ver valores, o bloco de preços do criador é omitido.
  // (O backend já não envia os preços; este gate é defesa em profundidade.)
  if (!influencer_values_read) return null;
  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-primary-100 bg-primary-50/40 px-3 py-2 text-left transition-colors hover:bg-primary-50"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-700">
            Preços do influenciador
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700">
          Ver detalhes
          <Icon name="ChevronRight" size={14} color="var(--color-primary-600)" />
        </span>
      </button>

      {open && (
        <PricesDetailModal
          influencerName={influencerName}
          data={data}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface PricesDetailModalProps {
  influencerName: string;
  data: PriceData;
  onClose: () => void;
}

/**
 * Renderiza uma linha de preço (formato → valor). Quando `cents` é `null`,
 * mostra "Não definido" em estilo muted/italic.
 */
function PriceRowItem({ row }: { row: PriceRow }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-neutral-700">
        {FORMAT_LABELS[row.fmt] ?? row.fmt}
      </span>
      <span
        className={
          row.cents == null
            ? "text-sm italic text-neutral-400 tabular-nums"
            : "text-sm font-medium text-neutral-900 tabular-nums"
        }
      >
        {row.cents == null ? "Não definido" : fmtBRL(row.cents)}
      </span>
    </div>
  );
}

function PricesDetailModal({
  influencerName,
  data,
  onClose,
}: PricesDetailModalProps) {
  const { requiredRows, extraRows, totalCents, missingRequired, hasRequirements } = data;
  const hasPartial = missingRequired > 0;

  return (
    <Modal
      title={hasRequirements ? "Custo para esta campanha" : "Preços do influenciador"}
      onClose={onClose}
      panelClassName="max-w-md"
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-neutral-500">
          Valores informados por{" "}
          <span className="font-medium text-neutral-800">{influencerName}</span>.
        </p>

        {/* Seção 1: formatos exigidos pela campanha (quando existem) */}
        {requiredRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Exigidos pela campanha
            </p>
            <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {requiredRows.map((row) => (
                <PriceRowItem key={row.fmt} row={row} />
              ))}
            </div>
          </div>
        )}

        {/* Seção 2: outros preços do influenciador (informativo)
            Quando NÃO há filtro/requisitos, é a única seção e ganha título genérico. */}
        {extraRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {hasRequirements ? "Outros preços do influenciador" : "Formatos precificados"}
            </p>
            <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-neutral-50/40">
              {extraRows.map((row) => (
                <PriceRowItem key={row.fmt} row={row} />
              ))}
            </div>
            {hasRequirements && (
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Estes formatos não entram no custo desta campanha são apenas referência.
              </p>
            )}
          </div>
        )}

        {/* Total (só quando há requisitos) */}
        {hasRequirements && (
          <div className="flex flex-col gap-2 rounded-xl bg-primary-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-primary-800">
                {hasPartial ? "Total parcial" : "Total"}
              </span>
              <span className="text-lg font-bold text-primary-800 tabular-nums">
                {fmtBRL(totalCents)}
              </span>
            </div>
            {hasPartial && (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
                <Icon name="TriangleAlert" size={14} color="#b45309" />
                <span>
                  {missingRequired === 1
                    ? "1 formato sem preço definido pelo influenciador. Será necessário negociar antes da aprovação."
                    : `${missingRequired} formatos sem preço definido. Será necessário negociar antes da aprovação.`}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
