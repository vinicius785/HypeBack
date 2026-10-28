import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { I, Av } from "@/components/prototype/ui";
import { useCampaigns, useCampaign } from "@/hooks/use-campaigns";
import {
  useInviteInfluencer,
  useAddToPreSelection,
} from "@/hooks/use-campaign-influencers";
import { getUploadUrl } from "@/lib/utils/api";
import { getCampaignStatusDisplayLabel } from "@/shared/utils/campaign-status";
import {
  parsePriceBRLToCents,
  fmtBRL,
} from "@/components/campaign-tabs/shared/prices-utils";

import { PvModal } from "./pv-modal";

interface CampaignPickerModalProps {
  mode: "invite" | "preselection";
  /** `users.id` (string) do influenciador. */
  influencerId: string;
  influencerName: string;
  /** `social_networks.id` (string) dos perfis do influenciador. */
  profileIds: string[];
  onClose: () => void;
}

/**
 * Escolhe uma campanha do workspace e convida / pré-seleciona o influenciador
 * via os endpoints existentes. Usado no perfil do influenciador, onde não há
 * campanha no contexto da rota.
 *
 * Nota de segurança: o gating de saldo (BRL) NÃO é replicado aqui — o backend
 * valida na hora do convite/aprovação (defesa em camadas). Erros do servidor
 * (ex.: saldo insuficiente) são exibidos via toast.
 */
export function CampaignPickerModal({
  mode,
  influencerId,
  influencerName,
  profileIds,
  onClose,
}: CampaignPickerModalProps) {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Os hooks recebem o campaignId selecionado; ao trocar a seleção, o
  // re-render rebinda a mutation ao novo id. A mutation só dispara no confirmar.
  const inviteMut = useInviteInfluencer(selectedId ?? "");
  const preselectMut = useAddToPreSelection(selectedId ?? "");
  const isPending = inviteMut.isPending || preselectMut.isPending;

  const isInvite = mode === "invite";

  // Detalhe da campanha selecionada — a lista (`/campaigns`) não traz o método
  // de pagamento, então buscamos o detalhe só quando há seleção.
  const { data: selectedCampaign } = useCampaign(selectedId ?? "");
  const isIndividualPrice =
    selectedCampaign?.payment_method === "individual_price";
  const proposedCents = parsePriceBRLToCents(priceInput);
  const priceValid = !isIndividualPrice || proposedCents > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => c.title.toLowerCase().includes(q));
  }, [campaigns, search]);

  async function handleConfirm() {
    if (!selectedId) return;
    if (isIndividualPrice && proposedCents <= 0) {
      toast.error("Informe o valor proposto para o criador.");
      return;
    }
    const mut = isInvite ? inviteMut : preselectMut;
    const data = {
      influencer_id: influencerId,
      ...(profileIds.length ? { profile_ids: profileIds } : {}),
      ...(isInvite && message.trim() ? { message: message.trim() } : {}),
      ...(isIndividualPrice ? { proposed_price_cents: proposedCents } : {}),
    };
    try {
      await mut.mutateAsync(data);
      toast.success(
        isInvite
          ? `Convite enviado para ${influencerName}.`
          : `${influencerName} adicionado à pré-seleção.`,
      );
      onClose();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ||
        "Não foi possível concluir a ação. Tente novamente.";
      toast.error(msg);
    }
  }

  const confirmLabel = isPending
    ? "Enviando..."
    : isInvite
      ? "Enviar convite"
      : "Adicionar à pré-seleção";

  return (
    <PvModal
      wide
      sub={isInvite ? "Enviar convite" : "Pré-seleção"}
      title={isInvite ? "Convidar para campanha" : "Convidar para pré-seleção"}
      onClose={onClose}
      footer={
        <>
          <small>{isInvite ? "1 convite" : "1 criador · pré-seleção"}</small>
          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={!selectedId || isPending || !priceValid}
          >
            <I n="send" cls="sm" />
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="cm-p">
        <Av name={influencerName} size={36} />
        <span>{influencerName}</span>
      </div>

      <div className="cmk-h">
        <div>
          <b>Escolha a campanha</b>
          <small>{isInvite ? "O convite é enviado direto ao criador" : "O criador entra na pré-seleção"}</small>
        </div>
        <div className="cmk-ar">
          <button
            type="button"
            className="round"
            aria-label="Anterior"
            onClick={() =>
              gridRef.current?.scrollBy({ left: -232, behavior: "smooth" })
            }
          >
            <I n="chev" cls="sm" />
          </button>
          <button
            type="button"
            className="round"
            aria-label="Próxima"
            onClick={() =>
              gridRef.current?.scrollBy({ left: 232, behavior: "smooth" })
            }
          >
            <I n="chev" cls="sm" />
          </button>
        </div>
      </div>

      <div className="ml-tb">
        <label className="find">
          <I n="search" cls="sm" />
          <input
            placeholder="Buscar campanha"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="ov-empty" style={{ padding: "32px 24px" }}>
          <small>Carregando campanhas...</small>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ov-empty" style={{ padding: "32px 24px" }}>
          <span>
            <I n="search" />
          </span>
          <b>
            {campaigns.length === 0
              ? "Nenhuma campanha disponível"
              : "Nenhuma campanha encontrada"}
          </b>
          <small>
            {campaigns.length === 0
              ? "Não há campanhas neste workspace."
              : "Tente outro nome."}
          </small>
        </div>
      ) : (
        <div className="cmk-g" ref={gridRef}>
          {filtered.map((c, k) => {
            const active = c.id === selectedId;
            const banner = c.banner ? getUploadUrl(c.banner) : null;
            return (
              <button
                key={c.id}
                type="button"
                className={`cmk${active ? " on" : ""}`}
                style={{ "--k": k } as React.CSSProperties}
                onClick={() => setSelectedId(c.id)}
              >
                <div
                  className="cmk-s"
                  style={
                    banner
                      ? undefined
                      : { background: "linear-gradient(135deg, var(--brand), var(--ink))" }
                  }
                >
                  {banner && (
                    <img
                      src={banner}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )}
                </div>
                <div className="cmk-t">
                  <span className="badge">{getCampaignStatusDisplayLabel(c.status)}</span>
                </div>
                <span className="cmk-ck">
                  <I n="check" cls="sm" />
                </span>
                <div className="cmk-b">
                  <span className="brand" style={{ background: "var(--brand)" }}>
                    {c.title
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <b>{c.title}</b>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isIndividualPrice && (
        <div className="sh-c">
          <div className="sh-ch2">
            <span className="sh-ic">
              <I n="banknote" cls="sm" />
            </span>
            <div>
              <b>Valor proposto ao criador *</b>
              <small>
                Valor individual por criador · o criador poderá aceitar ou contrapropor
                {proposedCents > 0 ? ` · ${fmtBRL(proposedCents)}` : ""}
              </small>
            </div>
          </div>
          <div className="sh-ad">
            <input
              inputMode="decimal"
              placeholder="R$ 0,00"
              autoComplete="off"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
          </div>
        </div>
      )}

      {isInvite && (
        <div className="sh-c">
          <div className="sh-ch2">
            <span className="sh-ic">
              <I n="msg" cls="sm" />
            </span>
            <div>
              <b>Mensagem</b>
              <small>Opcional · enviada junto do convite</small>
            </div>
          </div>
          <textarea
            className="cm-ta"
            rows={3}
            placeholder="Mensagem para o influenciador..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      )}
    </PvModal>
  );
}
