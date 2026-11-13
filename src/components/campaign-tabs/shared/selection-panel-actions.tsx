import { useEffect, useMemo, useRef, useState } from "react";
import { SocialNetworkIcon } from "@/components/social-network-icon";
import { SocialHandle } from "@/components/social-handle";
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
import { formatEngagement, formatFollowers } from "../campaign-flow";

import { computeMovement } from "./reserve-balance-modal";
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
  members?: number;
  engagement?: number;
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
  const [feedback, setFeedback] = useState("");
  const lastConfirm = useRef<Record<string, "approve" | "reject">>({});
  const rejectKey = rejectRow?.key;
  useEffect(() => {
    if (!rejectKey) return;
    const t = window.setTimeout(
      () => document.querySelector<HTMLTextAreaElement>('.kb2-m[data-mode="reject"] textarea')?.focus({ preventScroll: true }),
      180,
    );
    return () => window.clearTimeout(t);
  }, [rejectKey]);

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
      members: p.members,
      engagement: p.engagement,
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
        // O cartão da rede é UM elemento só: ele se transforma (escurece e cresce) na confirmação, em vez de abrir um modal.
        const mode: "idle" | "approve" | "reject" =
          reserveRow?.key === row.key ? "approve" : rejectRow?.key === row.key ? "reject" : "idle";
        const m = computeMovement({ costCents: cost, availableCents, committedCents });
        const ready = feedback.trim().length > 0;
        // Ao fechar, o conteúdo da confirmação fica até o cartão terminar de voltar (sem "piscar" vazio).
        if (mode !== "idle") lastConfirm.current[row.key] = mode;
        const shown = mode !== "idle" ? mode : (lastConfirm.current[row.key] ?? null);
        return (
          <div key={row.key} className={`kb2-prof kb2-m${mode === "idle" ? "" : " is-confirm"}`} data-mode={mode}>
            <div className="kb2-fold kb2-idle" inert={mode !== "idle"} aria-hidden={mode !== "idle"}>
              <div className="kb2-fi">
                <div className="kb2-prof-h">
                  {row.type ? (
                    <span className="kb2-ic" aria-hidden>
                      <SocialNetworkIcon networkType={row.type} size={18} color="#fff" />
                    </span>
                  ) : null}
                  <b>{row.label}</b>
                  <small title={`@${row.username}`}>
                    <SocialHandle username={row.username} network={row.type} withIcon />
                  </small>
                  {row.type ? (
                    <span className="kb2-st">
                      <span>
                        <b>{row.members ? formatFollowers(row.members) : "—"}</b> seguidores
                      </span>
                      <span>
                        <b>{row.engagement ? formatEngagement(row.engagement) : "—"}</b> engajamento
                      </span>
                    </span>
                  ) : null}
                  {showCost && (
                    <em className={blocked ? "bad" : ""}>
                      <span>Valor</span>
                      {cost != null ? fmtBRL(cost) : "A definir"}
                    </em>
                  )}
                </div>
                {blocked && (
                  <small className="drw-hint bad">
                    Saldo insuficiente: {fmtBRL(availableCents ?? 0)} disponível.
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
                      className="btn ok"
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
                    onClick={() => {
                      setFeedback("");
                      setRejectRow(row);
                    }}
                  >
                    Recusar {row.type ? row.label : ""}
                  </button>
                )}
              </div>
            </div>

            <div className="kb2-fold kb2-conf" inert={mode === "idle"} aria-hidden={mode === "idle"}>
              <div className="kb2-fi">
                {shown === "reject" ? (
                  <div className="kb2-cf" role="group" aria-label={`Confirmar recusa de ${row.label}`}>
                    <div className="kb2-cf-h">
                      <b>Recusar {row.label}</b>
                      <small title={`@${row.username}`}>
                    <SocialHandle username={row.username} network={row.type} />
                  </small>
                    </div>
                    <label className="kb2-cf-t">
                      <span>Motivo da recusa</span>
                      <textarea
                        rows={3}
                        value={feedback}
                        placeholder="Explique o motivo. Ele é enviado ao criador."
                        onChange={(e) => setFeedback(e.target.value)}
                      />
                    </label>
                    {!ready ? <small className="kb2-cf-req">Obrigatório para recusar.</small> : null}
                    <div className="kb2-cf-a">
                      <button
                        type="button"
                        className="cf-main cf-dng"
                        disabled={!ready || isUpdating}
                        onClick={() => reject(row, feedback.trim())}
                      >
                        {isUpdating ? "Recusando…" : "Confirmar recusa"}
                      </button>
                      <button type="button" className="cf-sec" disabled={isUpdating} onClick={() => setRejectRow(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : shown === "approve" ? (
                  <div className="kb2-cf" role="group" aria-label={`Confirmar aprovação de ${row.label}`}>
                    <div className="kb2-cf-h">
                      <b>Aprovar {row.label}</b>
                      <small title={`@${row.username}`}>
                    <SocialHandle username={row.username} network={row.type} />
                  </small>
                    </div>
                    <dl className="kb2-cf-l">
                      <div className="em">
                        <dt>Custo de aprovação</dt>
                        <dd>{cost != null ? fmtBRL(cost) : "A definir"}</dd>
                      </div>
                      <div>
                        <dt>Disponível agora</dt>
                        <dd>{availableCents != null ? fmtBRL(availableCents) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Disponível após</dt>
                        <dd className={m.blocked ? "bad" : "ok"}>{m.availableAfter != null ? fmtBRL(m.availableAfter) : "—"}</dd>
                      </div>
                      {m.committedAfter != null ? (
                        <div>
                          <dt>Reservado após</dt>
                          <dd className="warn">{fmtBRL(m.committedAfter)}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="kb2-cf-p">
                      {m.blocked
                        ? "Saldo insuficiente para reservar esse valor. Adicione saldo antes de continuar."
                        : !m.costKnown
                          ? "O valor ainda não está definido (preço a combinar); a reserva é ajustada quando o preço for acordado."
                          : "O valor sai do disponível e fica reservado. Você reembolsa se a parceria não avançar."}
                    </p>
                    <div className="kb2-cf-a">
                      <button type="button" className="cf-main ok" disabled={m.blocked || isUpdating} onClick={() => approve(row)}>
                        {isUpdating ? "Reservando…" : "Confirmar aprovação"}
                      </button>
                      <button type="button" className="cf-sec" disabled={isUpdating} onClick={() => setReserveRow(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
