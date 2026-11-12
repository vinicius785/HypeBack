import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { I } from "@/components/prototype/ui";
import { useActivateCampaignBoost } from "@/hooks/use-campaigns";
import {
  boostErrorText,
  campaignBoostState,
  formatBoostDate,
  formatBoostCountdown,
  formatBoostEnd,
  formatBoostRemaining,
  formatBoostTime,
} from "@/lib/campaign-boost";
import type { CampaignBoost } from "@/shared/types";

export interface CampaignBoostActionProps {
  campaignId: string;
  /** `boost` do detalhe da campanha; sem ele (API antiga ou ainda carregando) nada aparece. */
  boost: CampaignBoost | undefined;
  /** Campanha publicada (`status === "published"`). */
  published: boolean;
  /** `false` = inscrições fechadas; `null` = ainda não se sabe (a API recusa se for o caso). */
  registrationOpen: boolean | null;
  /** `campaigns_write`. */
  canWrite: boolean;
}

export const BOOST_HINT = "Coloque sua campanha em destaque para os creators por 24 horas. Cada campanha tem direito a 1 Boost.";
const BOOST_WHERE = "Ela fica em 1º lugar no Explorar e na seção “Campanhas em destaque” do app, e depois volta ao normal.";

/**
 * Balãozinho que explica o Boost: aparece ao passar o mouse ou focar (teclado) e abaixo do controle, porque o cabeçalho fica
 * no topo da tela. Um botão desabilitado não recebe o mouse, então o gatilho é o invólucro (o botão fica com
 * `pointer-events: none` quando desabilitado). O texto liga ao controle por `aria-describedby`.
 */
function BoostBubble({ title, children, note, describedBy, content }: { title: string; children: (props: { describedBy: string | undefined }) => ReactNode; note?: string | null; describedBy?: string; content: string; }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="chd-boost relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children({ describedBy: [describedBy, id].filter(Boolean).join(" ") || undefined })}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-xl bg-neutral-950 px-3.5 py-3 text-left text-xs font-medium leading-relaxed text-white shadow-lg"
      >
        <span aria-hidden className="absolute bottom-full left-1/2 -ml-1 h-0 w-0 border-4 border-transparent border-b-neutral-950" />
        <b className="mb-1 block text-[12.5px] font-bold">{title}</b>
        <span className="block text-white/80">{content}</span>
        {note ? <span className="mt-1.5 block font-semibold text-amber-300">{note}</span> : null}
      </span>
    </span>
  );
}

/** Hora atual, atualizada a cada segundo enquanto `enabled` (o cronômetro do Boost ativo anda sozinho). */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/** Por que o botão está desabilitado (ou `null` se pode usar). */
function disabledReason({ published, registrationOpen, canWrite }: Pick<CampaignBoostActionProps, "published" | "registrationOpen" | "canWrite">): string | null {
  if (!canWrite) return "Você não tem permissão para impulsionar campanhas.";
  if (!published) return "Só campanhas publicadas podem ser impulsionadas. Publique a campanha para usar o Boost.";
  if (registrationOpen === false) return "Só campanhas com inscrições abertas podem ser impulsionadas.";
  return null;
}

/**
 * Boost da campanha, nas ações do cabeçalho (cada campanha tem direito a 1 Boost: destaque para os criadores por 24 horas,
 * em 1º lugar no Explorar e em "Campanhas em destaque" do app). Três estados:
 *  - disponível: botão "Impulsionar" (a confirmação vem antes do POST); desabilitado, com a explicação, se a campanha não
 *    está publicada, está com inscrições fechadas ou a pessoa não pode escrever;
 *  - ativo: pílula preta com luz roxa, um raio que pulsa e o cronômetro do que falta (a dica traz o horário do fim, em
 *    Brasília);
 *  - já utilizado: etiqueta "Boost utilizado" com a data de uso.
 * Funciona igual para marca e agência.
 */
export function CampaignBoostAction({ campaignId, boost, published, registrationOpen, canWrite }: CampaignBoostActionProps) {
  const now = useNow(boost?.active === true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useActivateCampaignBoost(campaignId);

  if (!boost) return null;
  const state = campaignBoostState(boost, now);

  const close = () => {
    if (mutation.isPending) return;
    setConfirming(false);
    setError(null);
  };

  const confirm = () => {
    if (mutation.isPending) return;
    setError(null);
    mutation.mutate(undefined, {
      onSuccess: (next) => {
        setConfirming(false);
        toast.success(next.ends_at ? `Boost ativado! Sua campanha está em destaque até ${formatBoostTime(next.ends_at)}` : "Boost ativado! Sua campanha está em destaque.");
      },
      onError: (failure) => {
        const text = boostErrorText(failure);
        if ((failure as { status?: number })?.status === 409) {
          // A API recusou por um motivo do estado da campanha: o detalhe é recarregado e o cabeçalho mostra o que vale agora.
          setConfirming(false);
          toast.error(text);
        } else {
          setError(text);
        }
      },
    });
  };

  if (state === "active" && boost.ends_at) {
    return (
      <BoostBubble
        title="Boost ativo"
        content={`Sua campanha está em destaque para os creators até ${formatBoostEnd(boost.ends_at, now)} (horário de Brasília). ${BOOST_WHERE}`}
      >
        {({ describedBy }) => (
          <span className="chd-boost-on" role="timer" tabIndex={0} aria-describedby={describedBy} aria-label={`Boost ativo: faltam ${formatBoostRemaining(boost.ends_at as string, now)}`}>
            <I n="zap" cls="sm" />
            <time dateTime={boost.ends_at as string} aria-hidden="true">
              {formatBoostCountdown(boost.ends_at as string, now)}
            </time>
          </span>
        )}
      </BoostBubble>
    );
  }

  if (state === "used") {
    return (
      <BoostBubble
        title="Boost já utilizado"
        content={`${boost.started_at ? `Usado em ${formatBoostDate(boost.started_at)}. ` : ""}Cada campanha tem direito a 1 Boost, e ele já foi usado nesta.`}
      >
        {({ describedBy }) => (
          <span className="pill" tabIndex={0} aria-describedby={describedBy}>
            <I n="sparkles" cls="sm" />
            Boost utilizado
          </span>
        )}
      </BoostBubble>
    );
  }

  const reason = disabledReason({ published, registrationOpen, canWrite });
  return (
    <>
      <BoostBubble title="Impulsionar (Boost)" content={`${BOOST_HINT} ${BOOST_WHERE}`} note={reason}>
        {({ describedBy }) => (
          <button
            type="button"
            className="btn"
            style={reason !== null ? { pointerEvents: "none" } : undefined}
            disabled={reason !== null || mutation.isPending}
            aria-describedby={describedBy}
            onClick={() => setConfirming(true)}
          >
            <I n="sparkles" cls="sm" />
            Impulsionar
          </button>
        )}
      </BoostBubble>

      {confirming
        ? createPortal(
            <Modal title="Usar o Boost agora?" onClose={close} panelClassName="max-w-md">
              <p className="mb-6 text-sm text-neutral-600">
                A campanha ficará em destaque por 24 horas e não será possível usar de novo.
              </p>
              {error ? (
                <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="min-w-[120px] flex-1" disabled={mutation.isPending} onClick={close}>
                  Cancelar
                </Button>
                <Button type="button" className="min-w-[120px] flex-1" disabled={mutation.isPending} onClick={confirm}>
                  {mutation.isPending ? "Ativando…" : "Usar o Boost"}
                </Button>
              </div>
            </Modal>,
            document.body,
          )
        : null}
    </>
  );
}
