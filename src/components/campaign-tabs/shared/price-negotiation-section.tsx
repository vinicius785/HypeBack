import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRespondToPriceCounter } from "@/hooks/use-campaign-influencers";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { fmtBRL, parsePriceBRLToCents } from "./prices-utils";

/** Negociação POR REDE (individual_price por rede). */
interface NetworkNegotiation {
  social_network_id: number | null;
  network_type: string;
  proposed_price_cents: number | null;
  counter_price_cents: number | null;
  agreed_price_cents: number | null;
  price_status: string | null;
  awaiting_creator: boolean;
}

/** Bloco mínimo de negociação exibido no card. */
interface PriceNegotiation {
  proposed_price_cents: number | null;
  counter_price_cents: number | null;
  agreed_price_cents: number | null;
  price_status: string | null;
  origin: string | null;
  networks?: NetworkNegotiation[];
}

interface PriceNegotiationSectionProps {
  campaignId: string;
  /** `users.id` do influenciador (rota de resposta usa o userId). */
  userId?: string | number | null;
  status?: string;
  negotiation?: PriceNegotiation | null;
}

const NETWORK_LABELS: Record<string, string> = {
  instagram: "Instagram",
  instagram_facebook: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  ugc: "UGC",
};

function networkLabel(type: string): string {
  return NETWORK_LABELS[type?.toLowerCase()] ?? type ?? "Rede";
}

/**
 * Painel de negociação de "valor individual por criador" para o backoffice.
 * - price_proposed: aguardando o criador (somente leitura).
 * - price_countered: o criador contrapropôs → ações aceitar/contrapropor/recusar.
 * - accepted/rejected: estado final (somente leitura).
 *
 * Dois modos: POR REDE (quando `negotiation.networks` presente — responde com
 * `social_network_id`) e ESCALAR (negociação única legada). Só renderiza quando
 * há negociação (`negotiation.price_status` presente).
 */
export function PriceNegotiationSection({
  campaignId,
  userId,
  status,
  negotiation,
}: PriceNegotiationSectionProps) {
  const respondMut = useRespondToPriceCounter(campaignId);
  const { influencer_values_read } = useWorkspacePermissions();
  // Chave do formulário de contraproposta aberto: "scalar" ou `net-<id>`.
  const [counterOpenFor, setCounterOpenFor] = useState<string | null>(null);
  const [counterInput, setCounterInput] = useState("");

  // Sem permissão de ver valores, a negociação (valores + ações) é omitida.
  // O backend também não envia `negotiation` nesse caso.
  if (!influencer_values_read) return null;
  if (!negotiation || !negotiation.price_status) return null;

  const userIdStr =
    userId != null && String(userId).trim() !== "" ? String(userId) : null;

  const busy = respondMut.isPending;
  const networks = negotiation.networks ?? [];
  const isPerNetwork = networks.length > 0;

  async function respond(
    action: "accept" | "counter" | "reject",
    proposed_price_cents?: number,
    socialNetworkId?: number,
  ) {
    if (!userIdStr) {
      toast.error("Não foi possível responder: influenciador sem user_id.");
      return;
    }
    try {
      await respondMut.mutateAsync({
        userId: userIdStr,
        data: {
          action,
          ...(proposed_price_cents ? { proposed_price_cents } : {}),
          ...(socialNetworkId ? { social_network_id: socialNetworkId } : {}),
        },
      });
      toast.success(
        action === "accept"
          ? "Contraproposta aceita."
          : action === "counter"
            ? "Nova proposta enviada ao criador."
            : "Negociação recusada.",
      );
      setCounterOpenFor(null);
      setCounterInput("");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ||
          "Não foi possível concluir a ação.",
      );
    }
  }

  function handleSendCounter(socialNetworkId?: number) {
    const cents = parsePriceBRLToCents(counterInput);
    if (cents <= 0) {
      toast.error("Informe um valor válido para a nova proposta.");
      return;
    }
    void respond("counter", cents, socialNetworkId);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-canvas p-4">
      <div className="flex items-center gap-2">
        <Icon name="Handshake" color="#404040" size={16} />
        <h4 className="text-sm font-semibold text-neutral-800">
          Negociação de valor
        </h4>
      </div>

      {isPerNetwork
        ? networks.map((n) => (
            <NetworkRow
              key={`${n.social_network_id}-${n.network_type}`}
              net={n}
              busy={busy}
              counterOpen={
                counterOpenFor === `net-${n.social_network_id}`
              }
              counterInput={counterInput}
              onOpenCounter={() => {
                setCounterOpenFor(`net-${n.social_network_id}`);
                setCounterInput("");
              }}
              onCancelCounter={() => {
                setCounterOpenFor(null);
                setCounterInput("");
              }}
              onChangeCounter={setCounterInput}
              onAccept={() =>
                void respond("accept", undefined, n.social_network_id ?? undefined)
              }
              onReject={() =>
                void respond("reject", undefined, n.social_network_id ?? undefined)
              }
              onSendCounter={() =>
                handleSendCounter(n.social_network_id ?? undefined)
              }
            />
          ))
        : renderScalar()}
    </div>
  );

  // ── Modo escalar (negociação única legada) ──────────────────────────────────
  function renderScalar() {
    const isCountered = status === "price_countered";
    const isProposed = status === "price_proposed";
    const counterCents = negotiation!.counter_price_cents ?? 0;
    const proposedCents = negotiation!.proposed_price_cents ?? 0;
    const counterOpen = counterOpenFor === "scalar";

    return (
      <>
        <div className="flex flex-col gap-1 text-sm text-neutral-700">
          {proposedCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Sua proposta</span>
              <span className="font-medium">{fmtBRL(proposedCents)}</span>
            </div>
          )}
          {counterCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Contraproposta do criador</span>
              <span className="font-medium text-primary-700">
                {fmtBRL(counterCents)}
              </span>
            </div>
          )}
          {negotiation!.price_status === "accepted" &&
            negotiation!.agreed_price_cents != null && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Valor acordado</span>
                <span className="font-semibold text-success-700">
                  {fmtBRL(negotiation!.agreed_price_cents)}
                </span>
              </div>
            )}
        </div>

        {isProposed && (
          <p className="text-xs text-neutral-500">
            Aguardando a resposta do criador (aceitar ou contrapropor).
          </p>
        )}

        {negotiation!.price_status === "rejected" && (
          <p className="text-xs text-neutral-500">Negociação encerrada.</p>
        )}

        {isCountered && !counterOpen && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-success-700"
              disabled={busy}
              onClick={() => void respond("accept")}
            >
              Aceitar {counterCents > 0 ? fmtBRL(counterCents) : ""}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setCounterOpenFor("scalar");
                setCounterInput("");
              }}
            >
              Contrapropor
            </Button>
            <Button
              variant="outline"
              className="text-danger-700"
              disabled={busy}
              onClick={() => void respond("reject")}
            >
              Recusar
            </Button>
          </div>
        )}

        {isCountered && counterOpen && (
          <CounterForm
            value={counterInput}
            busy={busy}
            onChange={setCounterInput}
            onSend={() => handleSendCounter()}
            onCancel={() => {
              setCounterOpenFor(null);
              setCounterInput("");
            }}
          />
        )}
      </>
    );
  }
}

/** Uma rede na negociação por rede: valores + ações quando `countered`. */
function NetworkRow({
  net,
  busy,
  counterOpen,
  counterInput,
  onOpenCounter,
  onCancelCounter,
  onChangeCounter,
  onAccept,
  onReject,
  onSendCounter,
}: {
  net: NetworkNegotiation;
  busy: boolean;
  counterOpen: boolean;
  counterInput: string;
  onOpenCounter: () => void;
  onCancelCounter: () => void;
  onChangeCounter: (v: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onSendCounter: () => void;
}) {
  const proposedCents = net.proposed_price_cents ?? 0;
  const counterCents = net.counter_price_cents ?? 0;
  const isCountered = net.price_status === "countered";
  const isProposed = net.price_status === "proposed";
  const isAccepted = net.price_status === "accepted";
  const isRejected = net.price_status === "rejected";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800">
          {networkLabel(net.network_type)}
        </span>
        {isAccepted && net.agreed_price_cents != null && (
          <span className="text-sm font-semibold text-success-700">
            Aceito {fmtBRL(net.agreed_price_cents)}
          </span>
        )}
        {isRejected && (
          <span className="text-sm font-medium text-neutral-400">Recusada</span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm text-neutral-700">
        {proposedCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Sua proposta</span>
            <span className="font-medium">{fmtBRL(proposedCents)}</span>
          </div>
        )}
        {counterCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Proposta do criador</span>
            <span className="font-medium text-primary-700">
              {fmtBRL(counterCents)}
            </span>
          </div>
        )}
      </div>

      {isProposed && (
        <p className="text-xs text-neutral-500">
          Aguardando a resposta do criador.
        </p>
      )}

      {isCountered && !counterOpen && (
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-success-700"
            disabled={busy}
            onClick={onAccept}
          >
            Aceitar {counterCents > 0 ? fmtBRL(counterCents) : ""}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onOpenCounter}>
            Contrapropor
          </Button>
          <Button
            variant="outline"
            className="text-danger-700"
            disabled={busy}
            onClick={onReject}
          >
            Recusar
          </Button>
        </div>
      )}

      {isCountered && counterOpen && (
        <CounterForm
          value={counterInput}
          busy={busy}
          onChange={onChangeCounter}
          onSend={onSendCounter}
          onCancel={onCancelCounter}
        />
      )}
    </div>
  );
}

/** Formulário de contraproposta reutilizado pelos dois modos. */
function CounterForm({
  value,
  busy,
  onChange,
  onSend,
  onCancel,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-neutral-700">
        Nova proposta (R$)
      </label>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className="w-full rounded-[28px] bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
      <div className="flex gap-2">
        <Button
          className="bg-primary-600 hover:bg-primary-700"
          disabled={busy}
          onClick={onSend}
        >
          Enviar proposta
        </Button>
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
