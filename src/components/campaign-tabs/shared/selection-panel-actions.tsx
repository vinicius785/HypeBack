import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useWorkspaceBalance } from "@/hooks/use-balance";
import {
  useMoveToPreSelectionCuration,
  useUpdateInfluencerStatus,
} from "@/hooks/use-campaign-influencers";
import {
  useCampaignCuration,
  useCampaignInscriptions,
} from "@/hooks/use-campaign-tab-influencers";
import { getNetworkLabel } from "@/shared/constants/network-labels";

import { RejectionModal } from "./rejection-modal";
import { ReserveBalanceModal } from "./reserve-balance-modal";
import {
  computeApprovalCostCents,
  fmtBRL,
  type CampaignPhaseForCost,
} from "./prices-utils";

/** Colunas do quadro cuja ação acontece aqui (etapa Seleção). */
export const SELECTION_COLUMNS = [
  "applications",
  "pre_selection",
  "pre_selection_curation",
  "curation",
] as const;
export type SelectionColumn = (typeof SELECTION_COLUMNS)[number];

export const isSelectionColumn = (c: string): c is SelectionColumn =>
  (SELECTION_COLUMNS as readonly string[]).includes(c);

/** Modalidades em que aprovar reserva saldo (mesma regra das telas antigas). */
const COST_METHODS = new Set(["fixed", "fixed_value", "price"]);

interface ProfileRow {
  key: string;
  networkId?: number;
  type: string;
  label: string;
  username: string;
  prices?: Record<string, number>;
}

interface SelectionPanelActionsProps {
  campaignId: string;
  influencerId: string;
  column: SelectionColumn;
  paymentType?: string | null;
  phasesWithFormats?: ReadonlyArray<CampaignPhaseForCost>;
}

/**
 * Ações da etapa Seleção dentro do painel lateral do card: curadoria, aprovação
 * (com reserva de saldo) e recusa, por perfil/rede do criador.
 */
export function SelectionPanelActions({
  campaignId,
  influencerId,
  column,
  paymentType,
  phasesWithFormats = [],
}: SelectionPanelActionsProps) {
  const isInscription = column === "applications" || column === "pre_selection";
  const inscriptions = useCampaignInscriptions(
    campaignId,
    column === "pre_selection" ? "pre_selection" : "applications",
    { enabled: isInscription },
  );
  const curation = useCampaignCuration(campaignId, "pending", {
    enabled: !isInscription,
  });
  const query = isInscription ? inscriptions : curation;

  const balanceQ = useWorkspaceBalance();
  const availableCents = balanceQ.data?.available_cents ?? null;
  const committedCents = balanceQ.data?.committed_cents ?? null;

  const { mutate: updateStatus, isPending: isUpdating } =
    useUpdateInfluencerStatus(campaignId);
  const { mutate: moveToPreSelectionCuration, isPending: isMoving } =
    useMoveToPreSelectionCuration(campaignId);

  const [reserveRow, setReserveRow] = useState<ProfileRow | null>(null);
  const [rejectRow, setRejectRow] = useState<ProfileRow | null>(null);

  const showCost = !!paymentType && COST_METHODS.has(paymentType);
  const busy = isUpdating || isMoving;

  // A API devolve uma linha por criador E rede: junta todas as do criador.
  const matches = (query.data ?? []).filter(
    (i) => String(i.id) === String(influencerId),
  );
  const influencer = matches[0];

  const rows = useMemo<ProfileRow[]>(() => {
    if (!influencer) return [];
    const statusMatches = (status?: string) => {
      const s = (status ?? "").toLowerCase().trim();
      if (column === "applications") return s === "applications";
      if (column === "pre_selection") return s === "pre_selection";
      return s === "curation" || s === "pre_selection_curation";
    };
    const seen = new Set<string>();
    const profiles = matches
      .flatMap((m) => m.social_networks ?? [])
      .filter((p) => {
        const key = String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return statusMatches(p.status);
      });
    if (profiles.length === 0) {
      return [
        {
          key: `${influencer.id}-general`,
          type: "",
          label: "Geral",
          username: influencer.username,
        },
      ];
    }
    return profiles.map((p) => ({
      key: `${influencer.id}-${p.id}`,
      networkId: p.id != null && String(p.id) !== "" ? Number(p.id) : undefined,
      type: p.type,
      label: getNetworkLabel(p.type, p.name || p.type),
      username: p.username || influencer.username,
      prices: p.prices,
    }));
  }, [influencer, matches, column]);

  if (query.isLoading) return <small className="drw-hint">Carregando perfis…</small>;
  if (!influencer || rows.length === 0) return null;

  const costOf = (row: ProfileRow) =>
    showCost
      ? computeApprovalCostCents(paymentType, row.type, row.prices, phasesWithFormats)
      : null;

  const approve = (row: ProfileRow) => {
    updateStatus(
      {
        influencer_id: influencer.id,
        status: "approved",
        feedback: "Aprovado pelo usuário",
        network_id: row.networkId,
      },
      {
        onSuccess: () => {
          toast.success(`${row.label} aprovado com sucesso!`);
          setReserveRow(null);
        },
        onError: (e: Error) => toast.error(e?.message || "Erro ao aprovar influenciador"),
      },
    );
  };

  // Com custo, confirma a reserva de saldo antes; sem custo (ex.: permuta) aprova direto.
  const askApprove = (row: ProfileRow) => (showCost ? setReserveRow(row) : approve(row));

  const toCuration = (row: ProfileRow) => {
    if (column === "pre_selection") {
      moveToPreSelectionCuration(
        { influencerId: influencer.id, data: { network_id: row.networkId } },
        {
          onSuccess: () => toast.success("Movido para curadoria da pré-seleção!"),
          onError: (e: Error) => toast.error(e?.message || "Erro ao mover para curadoria"),
        },
      );
      return;
    }
    updateStatus(
      {
        influencer_id: influencer.id,
        status: "curation",
        feedback: undefined,
        network_id: row.networkId,
      },
      {
        onSuccess: () => toast.success(`${row.label} movido para curadoria!`),
        onError: (e: Error) => toast.error(e?.message || "Erro ao mover influenciador"),
      },
    );
  };

  const reject = (row: ProfileRow, feedback: string) => {
    updateStatus(
      {
        influencer_id: influencer.id,
        status: "rejected",
        feedback,
        network_id: row.networkId,
      },
      {
        onSuccess: () => {
          toast.success("Influenciador reprovado");
          setRejectRow(null);
        },
        onError: (e: Error) => toast.error(e?.message || "Erro ao reprovar influenciador"),
      },
    );
  };

  return (
    <div className="kb2-sel">
      {rows.map((row) => {
        const cost = costOf(row);
        const blocked = cost != null && availableCents != null && cost > availableCents;
        return (
          <div key={row.key} className="kb2-prof">
            <div className="kb2-prof-h">
              <b>{row.label}</b>
              <small>@{row.username}</small>
              {showCost && (
                <em className={blocked ? "bad" : ""}>
                  {cost != null ? fmtBRL(cost) : "A definir"}
                </em>
              )}
            </div>
            {blocked && (
              <small className="drw-hint bad">
                Saldo insuficiente ({fmtBRL(availableCents ?? 0)} disponível).
              </small>
            )}
            <div className="kb2-r">
              {(column === "applications" || column === "pre_selection") && (
                <button
                  type="button"
                  className="btn out"
                  disabled={busy}
                  onClick={() => toCuration(row)}
                >
                  {column === "pre_selection" ? "Enviar p/ curadoria" : "Curadoria"}
                </button>
              )}
              {column !== "pre_selection" && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy || blocked}
                  title={blocked ? "Saldo do workspace insuficiente para esta aprovação." : undefined}
                  onClick={() => askApprove(row)}
                >
                  Aprovar
                </button>
              )}
            </div>
            {column !== "pre_selection" && (
              <button
                type="button"
                className="btn out dng"
                disabled={busy}
                onClick={() => setRejectRow(row)}
              >
                Recusar {row.type ? row.label : ""}
              </button>
            )}
          </div>
        );
      })}

      <RejectionModal
        influencer={
          rejectRow
            ? {
                id: influencer.id,
                name: influencer.name,
                username: influencer.username,
                avatar: influencer.avatar,
              }
            : null
        }
        onConfirm={(feedback) => rejectRow && reject(rejectRow, feedback)}
        onClose={() => setRejectRow(null)}
      />

      <ReserveBalanceModal
        target={
          reserveRow
            ? {
                name: influencer.name,
                username: influencer.username,
                avatar: influencer.avatar,
              }
            : null
        }
        costCents={reserveRow ? costOf(reserveRow) : null}
        availableCents={availableCents}
        committedCents={committedCents}
        title="Reservar saldo para aprovar"
        confirmLabel="Confirmar aprovação"
        isSubmitting={isUpdating}
        onConfirm={() => reserveRow && approve(reserveRow)}
        onClose={() => setReserveRow(null)}
      />
    </div>
  );
}
