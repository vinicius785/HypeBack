import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { I, Av } from "@/components/prototype/ui";
import { useCampaigns, useCampaign } from "@/hooks/use-campaigns";
import {
  useInviteInfluencer,
  useAddToPreSelection,
  useInviteInfluencersBulk,
} from "@/hooks/use-campaign-influencers";
import type { InviteBulkResult } from "@/shared/services/influencer";
import { getUploadUrl } from "@/lib/utils/api";
import { getCampaignStatusDisplayLabel } from "@/shared/utils/campaign-status";
import {
  parsePriceBRLToCents,
  fmtBRL,
} from "@/components/campaign-tabs/shared/prices-utils";

import { PvModal } from "./pv-modal";
import {
  formatMembers,
  useInviteAccounts,
  type InviteAccount,
} from "./invite-networks-modal";
import "@/styles/campaign-picker.css";

interface CampaignPickerModalProps {
  mode: "invite" | "preselection";
  /** `users.id` (string) do influenciador. */
  influencerId: string;
  influencerName: string;
  /** `social_networks.id` (string) dos perfis do influenciador. Ausente (com `networks`) = primeiro pergunta em quais redes. */
  profileIds?: string[];
  /** Quando informado, o modal começa escolhendo as redes e depois se expande para a campanha (um modal só). */
  networks?: { userId: number; known: InviteAccount[] };
  /** Convite em lote: o mesmo convite (campanha, mensagem, valor) para vários criadores, um por vez. */
  bulk?: {
    creators: Array<{ id: number; name: string; photo?: string | null }>;
  };
  /** Foto do criador, para o painel da esquerda. */
  influencerPhoto?: string | null;
  onClose: () => void;
}

const NET_ICONS: Record<string, string> = {
  instagram: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
};

const BULK_LIMIT = 200;

/** Fase em que o criador deve entrar se aceitar o convite. */
const ENTRY_PHASES = [
  { id: "applications", label: "Inscrições", hint: "Entra como inscrito" },
  {
    id: "pre_selection",
    label: "Pré-seleção",
    hint: "Entra na fila de decisão",
  },
  { id: "curation", label: "Curadoria", hint: "Entra direto para avaliação" },
] as const;
type EntryPhase = (typeof ENTRY_PHASES)[number]["id"];

/** Mede o conteúdo e anima a altura do corpo do modal quando ele muda (troca de etapa, lista que carrega). */
function FitBody({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className="cpf-fit"
      style={h === undefined ? undefined : { height: h }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
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
  profileIds: profileIdsProp,
  networks,
  bulk,
  influencerPhoto,
  onClose,
}: CampaignPickerModalProps) {
  const askNetworks = !profileIdsProp && !!networks;
  const accountsQ = useInviteAccounts(
    networks?.userId ?? 0,
    networks?.known ?? [],
    askNetworks,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<EntryPhase>("applications");
  const profileIds = askNetworks
    ? [...picked, ...accountsQ.ugcIds]
    : (profileIdsProp ?? []);
  const accounts = accountsQ.accounts;
  useEffect(() => {
    if (askNetworks)
      setPicked(new Set(accounts.filter((a) => !a.blocked).map((a) => a.id)));
  }, [askNetworks, accounts]);
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const { data: campaigns = [], isLoading } = useCampaigns();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [priceInput, setPriceInput] = useState("");

  // Os hooks recebem o campaignId selecionado; ao trocar a seleção, o
  // re-render rebinda a mutation ao novo id. A mutation só dispara no confirmar.
  const inviteMut = useInviteInfluencer(selectedId ?? "");
  const preselectMut = useAddToPreSelection(selectedId ?? "");
  const bulkMut = useInviteInfluencersBulk(selectedId ?? "");
  const isPending =
    inviteMut.isPending || preselectMut.isPending || bulkMut.isPending;

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
    if (bulk) {
      // Em lote: um pedido só; quem falhar volta com a mensagem e os demais seguem.
      try {
        // A API aceita até 200 por pedido: listas maiores vão em pedidos seguidos.
        const results: InviteBulkResult[] = [];
        for (let i = 0; i < bulk.creators.length; i += BULK_LIMIT) {
          results.push(
            ...(await bulkMut.mutateAsync({
              influencer_ids: bulk.creators
                .slice(i, i + BULK_LIMIT)
                .map((c) => c.id),
              ...(isInvite && message.trim()
                ? { message: message.trim() }
                : {}),
              ...(isIndividualPrice
                ? { proposed_price_cents: proposedCents }
                : {}),
              entry_status: phase,
            })),
          );
        }
        const failed = results.filter((r) => !r.ok);
        const ok = results.length - failed.length;
        const nameOf = (id: string | number) =>
          bulk.creators.find((c) => String(c.id) === String(id))?.name ??
          String(id);
        if (failed.length === 0)
          toast.success(
            `${ok} ${ok === 1 ? "convite enviado" : "convites enviados"}.`,
          );
        else
          toast.warning(
            `${ok} enviados, ${failed.length} não: ${failed
              .slice(0, 3)
              .map((f) => `${nameOf(f.influencer_id)} (${f.error ?? "erro"})`)
              .join("; ")}${failed.length > 3 ? "…" : ""}`,
          );
        if (ok > 0 || failed.length === 0) onClose();
      } catch (err) {
        toast.error(
          (err as { message?: string })?.message ||
            "Não foi possível enviar os convites. Tente novamente.",
        );
      }
      return;
    }
    const data = {
      influencer_id: influencerId,
      ...(profileIds.length ? { profile_ids: profileIds } : {}),
      ...(isInvite && message.trim() ? { message: message.trim() } : {}),
      ...(isIndividualPrice ? { proposed_price_cents: proposedCents } : {}),
      ...(isInvite ? { entry_status: phase } : {}),
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

  const confirmLabel = bulk
    ? isPending
      ? "Enviando…"
      : `Enviar ${bulk.creators.length} convites`
    : isPending
      ? "Enviando..."
      : isInvite
        ? "Enviar convite"
        : "Adicionar à pré-seleção";

  const selectedCampaignTitle =
    campaigns.find((c) => c.id === selectedId)?.title ?? null;
  const noNetwork = askNetworks && !accountsQ.isLoading && picked.size === 0;

  return (
    <PvModal
      className="cpf xl"
      sub={isInvite ? "Enviar convite" : "Pré-seleção"}
      title={isInvite ? "Convidar para campanha" : "Convidar para pré-seleção"}
      onClose={onClose}
      footer={
        <>
          <p
            className={`cpf-sum${selectedCampaignTitle ? " on" : ""}`}
            aria-live="polite"
          >
            {selectedCampaignTitle ? (
              <>
                <I n="check" cls="sm" />
                <span>
                  <b>{selectedCampaignTitle}</b>
                  {askNetworks && picked.size > 0
                    ? ` · ${picked.size} ${picked.size === 1 ? "rede" : "redes"}`
                    : ""}
                </span>
              </>
            ) : (
              <span>
                {noNetwork
                  ? "Marque ao menos uma rede"
                  : "Escolha uma campanha para continuar"}
              </span>
            )}
          </p>
          <button
            type="button"
            className="btn out"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={!selectedId || isPending || !priceValid || noNetwork}
          >
            <I n="send" cls="sm cpf-send" />
            <span>{confirmLabel}</span>
          </button>
        </>
      }
    >
      <FitBody>
        <div className="cpf-step cpf-c">
          <div className="cpf-grid">
            <aside className="cpf-who" aria-label="Criador">
              <div className="cpf-hero">
                {bulk ? (
                  <div className="cpf-mosaic" aria-hidden>
                    {bulk.creators.slice(0, 4).map((c) => (
                      <Av
                        key={c.id}
                        name={c.name}
                        src={c.photo ?? undefined}
                        size={120}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="cpf-photo" hidden={!!bulk}>
                  <Av
                    name={influencerName}
                    src={influencerPhoto ?? undefined}
                    size={280}
                  />
                </div>
                <div className="cpf-shade">
                  <b>
                    {bulk
                      ? `${bulk.creators.length} criadores`
                      : influencerName}
                  </b>
                </div>
              </div>
              {askNetworks && accounts.length > 1 ? (
                <>
                  <h3 className="cpf-lb cpf-lb-s">Redes do convite</h3>
                  <ul className="cpf-pick" aria-label="Redes do convite">
                    {accounts.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={picked.has(a.id)}
                          disabled={a.blocked}
                          className={`cpf-pk${picked.has(a.id) ? " on" : ""}`}
                          onClick={() => togglePick(a.id)}
                        >
                          <span className="cpf-pi">
                            <I n={NET_ICONS[a.type] ?? "video"} cls="sm" />
                          </span>
                          <span className="cpf-pn">
                            <b>{a.label}</b>
                            <small>{formatMembers(a.members)} seguidores</small>
                          </span>
                          <span className="cpf-pc" aria-hidden>
                            <I n="check" cls="sm" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </aside>

            <section className="cpf-camps" aria-label="Campanhas">
              <h3 className="cpf-lb">
                <em>1</em>
                Campanha
                {campaigns.length > 0 ? <span>{filtered.length}</span> : null}
              </h3>
              <label className="cpk-find">
                <I n="search" cls="sm" />
                <input
                  placeholder="Buscar campanha"
                  autoComplete="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
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
                <ul
                  className="cpk-list"
                  role="radiogroup"
                  aria-label="Campanhas"
                >
                  {filtered.map((c, k) => {
                    const active = c.id === selectedId;
                    const banner = c.banner ? getUploadUrl(c.banner) : null;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`cpk-row${active ? " on" : ""}`}
                          style={{ "--k": k } as React.CSSProperties}
                          onClick={() => setSelectedId(c.id)}
                        >
                          <span className="cpk-th">
                            {banner ? (
                              <img src={banner} alt="" />
                            ) : (
                              <i>{c.title.trim().charAt(0).toUpperCase()}</i>
                            )}
                          </span>
                          <span className="cpk-tx">
                            <b title={c.title}>{c.title}</b>
                            <small>
                              {getCampaignStatusDisplayLabel(c.status)}
                            </small>
                          </span>
                          <span className="cpk-ck" aria-hidden>
                            <I n="check" cls="sm" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {isIndividualPrice && (
            <div className="sh-c">
              <div className="sh-ch2">
                <span className="sh-ic">
                  <I n="banknote" cls="sm" />
                </span>
                <div>
                  <b>Valor proposto ao criador *</b>
                  <small>
                    Valor individual por criador · o criador poderá aceitar ou
                    contrapropor
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
            <div className="cpf-sec">
              <h3 className="cpf-lb">
                <em>2</em>
                Mensagem
                <span>opcional</span>
              </h3>
              <textarea
                className="cpf-msg"
                rows={2}
                aria-label="Mensagem (opcional)"
                placeholder="Mensagem para o criador (opcional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          )}

          {isInvite && (
            <div className="cpf-sec">
              <h3 className="cpf-lb" id="cpf-ph-l">
                <em>3</em>
                Se aceitar, entra em
              </h3>
              <div
                className="cpf-ph-g"
                role="radiogroup"
                aria-labelledby="cpf-ph-l"
              >
                {ENTRY_PHASES.map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    role="radio"
                    aria-checked={phase === ph.id}
                    className={`cpf-ph-o${phase === ph.id ? " on" : ""}`}
                    onClick={() => setPhase(ph.id)}
                  >
                    {ph.label}
                  </button>
                ))}
              </div>
              <p className="cpf-hint">
                {ENTRY_PHASES.find((ph) => ph.id === phase)?.hint}
              </p>
            </div>
          )}
        </div>
      </FitBody>
    </PvModal>
  );
}
