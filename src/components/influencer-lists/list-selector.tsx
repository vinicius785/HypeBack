import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useInfluencerLists,
  useInfluencerList,
  useBulkAddInfluencers,
} from "@/hooks/use-influencer-lists";
import {
  getCampaignImportPreview,
  type ImportPreviewProfile,
} from "@/shared/services/influencer-lists";
import {
  inviteInfluencer,
  addToPreSelection,
} from "@/shared/services/influencer";
import { I, Av } from "@/components/prototype/ui";
import {
  parsePriceBRLToCents,
  fmtBRL,
} from "@/components/campaign-tabs/shared/prices-utils";

import { PvModal } from "./pv-modal";

type AddMode = "invite" | "preselection";

interface ListSelectorProps {
  campaignId: string;
  /** Método de pagamento da campanha; define se pede valor por criador. */
  paymentMethod?: string;
  trigger?: React.ReactNode;
  onClose?: () => void;
  /** Abre o modal ao montar (fluxo sem trigger, ex. aba de seleção) */
  defaultOpen?: boolean;
}

/** Executa `worker` sobre `items` com concorrência limitada, preservando ordem. */
export async function runPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const current = cursor++;
      try {
        results[current] = {
          status: "fulfilled",
          value: await worker(items[current], current),
        };
      } catch (reason) {
        results[current] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
  return results;
}

/**
 * Importa uma lista salva de influenciadores para a campanha.
 *
 * Fluxo em 2 etapas: (1) escolher a lista → (2) escolher entre CONVITE ou
 * PRÉ-SELEÇÃO e, quando a campanha usa "valor individual por criador",
 * informar o valor proposto de cada membro.
 *
 * Roteamento por método de pagamento (prioriza correção + reserva atômica):
 * - `individual_price` (qualquer modo) e pré-seleção (qualquer método): trata
 *   cada membro pelos endpoints individuais (negociação/valor por criador +
 *   notificação real ao influenciador; pré-seleção nunca reserva saldo).
 * - Convite direto em campanha paga (fixed/influencer_price/etc.): usa o
 *   endpoint em massa (`bulk/add`), que valida o saldo agregado e reserva de
 *   forma tudo-ou-nada.
 */
export function ListSelector({
  campaignId,
  paymentMethod,
  trigger,
  onClose,
  defaultOpen = false,
}: ListSelectorProps) {
  const isIndividualPrice = paymentMethod === "individual_price";

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [mode, setMode] = useState<AddMode>("invite");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const { data: lists, isLoading } = useInfluencerLists();
  const { data: listDetail, isLoading: isLoadingDetail } =
    useInfluencerList(selectedListId);
  const { mutateAsync: bulkAdd } = useBulkAddInfluencers(campaignId);

  const members = listDetail?.influencers ?? [];
  const isSubmitting = progress !== null;

  // ── individual_price: preview POR PERFIL (influenciador × rede da campanha) ──
  const profileKey = (p: { user_id: number; social_network_id: number }) =>
    `${p.user_id}-${p.social_network_id}`;

  const [profiles, setProfiles] = useState<ImportPreviewProfile[]>([]);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [profilePrices, setProfilePrices] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Carrega o preview ao entrar no passo de configuração (só individual_price).
  useEffect(() => {
    if (!isIndividualPrice || !selectedListId) {
      setProfiles([]);
      setDiscardedCount(0);
      setRemovedKeys(new Set());
      setProfilePrices({});
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    getCampaignImportPreview(campaignId, { list_id: selectedListId })
      .then((res) => {
        if (cancelled) return;
        setProfiles(res.profiles);
        setDiscardedCount(res.summary.discarded);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(
          (err as { message?: string })?.message || "Erro ao carregar perfis"
        );
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isIndividualPrice, selectedListId, campaignId]);

  const keptProfiles = useMemo(
    () => profiles.filter((p) => !removedKeys.has(profileKey(p))),
    [profiles, removedKeys]
  );

  // Validação: individual → cada PERFIL mantido precisa de valor > 0.
  const allPricesValid = useMemo(() => {
    if (!isIndividualPrice) return true;
    if (keptProfiles.length === 0) return false;
    return keptProfiles.every(
      (p) => parsePriceBRLToCents(profilePrices[profileKey(p)]) > 0
    );
  }, [isIndividualPrice, keptProfiles, profilePrices]);

  const removeProfile = (key: string) =>
    setRemovedKeys((prev) => new Set(prev).add(key));

  const resetAll = () => {
    setSelectedListId(null);
    setMode("invite");
    setMessage("");
    setProfiles([]);
    setDiscardedCount(0);
    setRemovedKeys(new Set());
    setProfilePrices({});
    setPreviewError(null);
    setProgress(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    resetAll();
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!selectedListId) return;

    // Caminho em massa: convite direto em campanha NÃO individual. Reserva
    // atômica do saldo agregado no backend.
    if (mode === "invite" && !isIndividualPrice) {
      try {
        setProgress({ done: 0, total: 1 });
        await bulkAdd({ list_id: selectedListId });
        handleClose();
      } catch (err) {
        setProgress(null);
        toast.error(
          (err as { message?: string })?.message ||
            "Erro ao adicionar influenciadores"
        );
      }
      return;
    }

    const trimmedMessage = message.trim();
    const action = mode === "invite" ? inviteInfluencer : addToPreSelection;
    const verb = mode === "invite" ? "convidado(s)" : "adicionado(s) à pré-seleção";

    // ── individual_price: 1 convite por criador, com network_prices (por rede) ──
    if (isIndividualPrice) {
      if (keptProfiles.length === 0) {
        toast.error("Nenhum perfil compatível com a campanha para convidar.");
        return;
      }
      if (!allPricesValid) {
        toast.error("Informe o valor de cada perfil (rede).");
        return;
      }

      // Agrupa os perfis mantidos por influenciador.
      const byUser = new Map<
        number,
        { network_id: number; proposed_price_cents: number }[]
      >();
      for (const p of keptProfiles) {
        const arr = byUser.get(p.user_id) ?? [];
        arr.push({
          network_id: p.social_network_id,
          proposed_price_cents: parsePriceBRLToCents(
            profilePrices[profileKey(p)]
          ),
        });
        byUser.set(p.user_id, arr);
      }
      const entries = [...byUser.entries()];
      setProgress({ done: 0, total: entries.length });

      const results = await runPool(
        entries,
        async ([userId, items]) => {
          await action(campaignId, {
            influencer_id: String(userId),
            ...(trimmedMessage ? { message: trimmedMessage } : {}),
            network_prices: items,
          });
          setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
        },
        4
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (succeeded > 0) toast.success(`${succeeded} criador(es) ${verb}.`);
      if (failed > 0)
        toast.error(`${failed} não puderam ser processados (já na campanha ou erro).`);
      if (succeeded > 0) handleClose();
      else setProgress(null);
      return;
    }

    // ── Não-individual: pré-seleção por membro (fluxo existente) ──
    if (members.length === 0) {
      toast.error("A lista selecionada não possui influenciadores.");
      return;
    }
    setProgress({ done: 0, total: members.length });
    const results = await runPool(
      members,
      async (member) => {
        await action(campaignId, {
          influencer_id: String(member.id),
          ...(trimmedMessage ? { message: trimmedMessage } : {}),
        });
        setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      },
      4
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(`${succeeded} influenciador(es) ${verb}.`);
    }
    if (failed > 0) {
      toast.error(
        `${failed} não puderam ser processados (já na campanha ou erro).`
      );
    }

    if (succeeded > 0) {
      handleClose();
    } else {
      setProgress(null);
    }
  };

  const rowStyle = (k: number, cols: string): React.CSSProperties =>
    ({ "--k": Math.min(k, 10), gridTemplateColumns: cols, background: "#fff" }) as React.CSSProperties;

  const renderListStep = () => (
    <PvModal
      sub="Adicionar à campanha"
      title="Selecionar lista"
      onClose={handleClose}
    >
      <div className="sh-c">
        <div className="sh-ch2">
          <span className="sh-ic">
            <I n="heart" cls="sm" />
          </span>
          <div>
            <b>Suas listas</b>
            <small>Escolha uma lista para adicionar os criadores à campanha</small>
          </div>
        </div>
        {isLoading ? (
          <div className="ov-empty" style={{ padding: "24px" }}>
            <small>Carregando listas...</small>
          </div>
        ) : lists && lists.length > 0 ? (
          <div className="cm-ls">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
              >
                <div>
                  <b>{list.name}</b>
                  <small>
                    {list.influencer_count}{" "}
                    {list.influencer_count === 1 ? "criador" : "criadores"} ·{" "}
                    {new Date(list.created_at).toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <I n="chev" cls="sm" />
              </button>
            ))}
          </div>
        ) : (
          <div className="ov-empty" style={{ padding: "32px 24px" }}>
            <span>
              <I n="heart" />
            </span>
            <b>Nenhuma lista encontrada</b>
            <small>Salve criadores a partir da aba Explorar.</small>
          </div>
        )}
      </div>
    </PvModal>
  );

  const renderConfigureStep = () => {
    const selectedList = lists?.find((l) => l.id === selectedListId);
    const loadingRows = isIndividualPrice ? previewLoading || isLoadingDetail : isLoadingDetail;
    const count = isIndividualPrice ? keptProfiles.length : members.length;
    return (
      <PvModal
        wide
        sub="Adicionar lista à campanha"
        title={selectedList?.name ?? "Lista"}
        onClose={handleClose}
        footer={
          <>
            <small>
              {progress && progress.total > 1
                ? `Processando ${progress.done}/${progress.total}...`
                : isIndividualPrice
                  ? `${count} ${count === 1 ? "perfil" : "perfis"}`
                  : `${count} ${count === 1 ? "criador" : "criadores"}`}
            </small>
            <button
              type="button"
              className="btn out"
              onClick={() => setSelectedListId(null)}
              disabled={isSubmitting}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                isLoadingDetail ||
                (isIndividualPrice
                  ? previewLoading || keptProfiles.length === 0 || !allPricesValid
                  : members.length === 0)
              }
            >
              <I n="send" cls="sm" />
              {isSubmitting
                ? "Processando..."
                : mode === "invite"
                  ? "Convidar todos"
                  : "Adicionar à pré-seleção"}
            </button>
          </>
        }
      >
        <div className="sh-c">
          <div className="sh-ch2">
            <span className="sh-ic">
              <I n="send" cls="sm" />
            </span>
            <div>
              <b>Como adicionar</b>
              <small>Convite direto ou pré-seleção</small>
            </div>
          </div>
          <div className="sh-op">
            {(
              [
                { value: "invite" as const, title: "Convidar", desc: "Envia convite direto ao criador." },
                { value: "preselection" as const, title: "Pré-seleção", desc: "Move para pré-seleção (sem reserva)." },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={mode === opt.value ? "on" : ""}
                disabled={isSubmitting}
                onClick={() => setMode(opt.value)}
              >
                <b>{opt.title}</b>
                <small>{opt.desc}</small>
              </button>
            ))}
          </div>
        </div>

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
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
            placeholder="Mensagem para os influenciadores..."
          />
        </div>

        <div className="sh-c">
          <div className="sh-ch2">
            <span className="sh-ic">
              <I n="users" cls="sm" />
            </span>
            <div>
              <b>
                {isIndividualPrice
                  ? `${keptProfiles.length} perfil(is) convidável(is)`
                  : `${members.length} influenciador(es)`}
              </b>
              <small>
                {isIndividualPrice
                  ? "Valor individual por criador · cada perfil é uma rede da campanha. O criador poderá aceitar ou contrapropor; o saldo só é reservado quando o valor fecha."
                  : "Criadores da lista selecionada"}
              </small>
            </div>
          </div>

          {isIndividualPrice && discardedCount > 0 && (
            <small style={{ color: "var(--muted)", fontSize: 12.5 }}>
              {discardedCount} perfil(is) descartado(s) por não terem rede compatível com a campanha.
            </small>
          )}

          {loadingRows ? (
            <div className="ov-empty" style={{ padding: "24px" }}>
              <small>Carregando...</small>
            </div>
          ) : isIndividualPrice && previewError ? (
            <small style={{ color: "var(--danger)", fontSize: 13 }}>{previewError}</small>
          ) : count === 0 ? (
            <div className="ov-empty" style={{ padding: "24px" }}>
              <b>{isIndividualPrice ? "Nenhum perfil compatível" : "Lista vazia"}</b>
              <small>
                {isIndividualPrice
                  ? "Nenhum perfil da lista é compatível com as redes da campanha."
                  : "A lista selecionada não possui influenciadores."}
              </small>
            </div>
          ) : isIndividualPrice ? (
            <div className="ml-l" style={{ maxHeight: 300, overflowY: "auto" }}>
              {keptProfiles.map((p, k) => {
                const key = profileKey(p);
                const cents = parsePriceBRLToCents(profilePrices[key]);
                return (
                  <div
                    key={key}
                    className="ml-r"
                    style={rowStyle(k, "46px minmax(0, 1fr) auto auto")}
                  >
                    <Av name={p.name ?? "?"} src={p.photo ?? undefined} size={46} />
                    <div className="ml-n" style={{ minWidth: 0 }}>
                      <b>{p.name}</b>
                      <small>
                        {p.username ? `@${p.username} · ` : ""}
                        {p.network_type}
                        {cents > 0 ? ` · ${fmtBRL(cents)}` : ""}
                      </small>
                    </div>
                    <input
                      className="cm-in"
                      inputMode="decimal"
                      value={profilePrices[key] ?? ""}
                      onChange={(e) =>
                        setProfilePrices((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      disabled={isSubmitting}
                      placeholder="R$ 0,00"
                      aria-label="Valor proposto"
                      style={{ width: 120, height: 40, background: "var(--bg)" }}
                    />
                    <span className="ml-a">
                      <button
                        type="button"
                        className="round dng"
                        onClick={() => removeProfile(key)}
                        disabled={isSubmitting}
                        aria-label="Remover perfil"
                      >
                        <I n="x" cls="sm" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ml-l" style={{ maxHeight: 300, overflowY: "auto" }}>
              {members.map((member, k) => (
                <div key={member.id} className="ml-r" style={rowStyle(k, "46px minmax(0, 1fr)")}>
                  <Av name={member.name ?? "?"} src={member.photo ?? undefined} size={46} />
                  <div className="ml-n" style={{ minWidth: 0 }}>
                    <b>{member.name}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PvModal>
    );
  };

  return (
    <>
      {trigger && (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {trigger}
        </div>
      )}

      {isOpen && (selectedListId ? renderConfigureStep() : renderListStep())}
    </>
  );
}
