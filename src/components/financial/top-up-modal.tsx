import { useCallback, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { I } from "@/components/prototype/ui";
import {
  BALANCE_QUERY_KEYS,
  useTopUpWorkspace,
} from "@/hooks/use-balance";
import { usePaymentSocket } from "@/hooks/use-payment-socket";
import {
  getWorkspaceBalance,
  simulatePayment,
} from "@/shared/services/balance";
import type {
  TopUpResult,
  WorkspaceBalance,
} from "@/shared/services/balance";
import { getWorkspaceId } from "@/lib/utils/api";

/**
 * Modal de depósito (top-up) — substitui o fluxo antes presente no WalletDrawer.
 *
 * Três estados internos:
 *  1. `form`     → input de valor + atalhos
 *  2. `qrcode`   → exibe QR PIX e aguarda confirmação (socket + polling de 3s)
 *  3. `confirmed`→ feedback de sucesso
 *
 * Por que dois caminhos de confirmação (socket + polling)?
 *  - Socket é instantâneo, mas pode falhar (rede, proxy).
 *  - Polling de saldo garante convergência mesmo se o socket cair.
 *  - `confirmedRef` evita double-trigger entre os dois.
 */
interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "form" | "qrcode" | "confirmed";

const QUICK_AMOUNTS_CENTS = [5000, 10000, 20000, 50000];
const MIN_CENTS = 100;
const MAX_CENTS = 99_999_999;
const PAYMENT_POLL_INTERVAL_MS = 3000;

const brl0 = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const centsToDecimal = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function TopUpModal({ open, onClose }: TopUpModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<TopUpResult | null>(null);
  const [preBalance, setPreBalance] = useState(0);

  if (!open) return null;

  const handleClose = () => {
    onClose();
    // pequeno delay para evitar flash de re-render durante a animação de fechar
    setTimeout(() => {
      setStep("form");
      setResult(null);
      setPreBalance(0);
    }, 200);
  };

  const handleTopUpCreated = (r: TopUpResult, snapshotBalance: number) => {
    setResult(r);
    setPreBalance(snapshotBalance);
    setStep("qrcode");
  };

  const handleConfirmed = () => setStep("confirmed");

  const handleNewDeposit = () => {
    setResult(null);
    setPreBalance(0);
    setStep("form");
  };

  if (step === "qrcode" && result) {
    return (
      <QrCodeStep
        result={result}
        preBalance={preBalance}
        onConfirmed={handleConfirmed}
        onNewDeposit={handleNewDeposit}
        onClose={handleClose}
      />
    );
  }
  if (step === "confirmed" && result) {
    return (
      <ConfirmedStep
        result={result}
        onNewDeposit={handleNewDeposit}
        onClose={handleClose}
      />
    );
  }
  return <FormStep onSubmitSuccess={handleTopUpCreated} onCancel={handleClose} />;
}

// ---------------------------------------------------------------------------
// Casca do diálogo "Depositar saldo" (fnDepOpen do protótipo)
// ---------------------------------------------------------------------------

function DepShell({
  onClose,
  body,
  footer,
  as = "div",
  onSubmit,
}: {
  onClose: () => void;
  body: React.ReactNode;
  footer: React.ReactNode;
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inner = (
    <>
      <div className="sh-b fnd-b">{body}</div>
      <div className="cm-f">{footer}</div>
    </>
  );

  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={onClose} />
      <div className="ovw">
        <section className="ovd on fndm" role="dialog" aria-label="Depositar saldo">
          <div className="sh-h cm-h">
            <div>
              <small>Saldo</small>
              <h2>Depositar saldo</h2>
            </div>
            <button type="button" className="round" onClick={onClose} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          {as === "form" ? (
            <form onSubmit={onSubmit} style={{ display: "contents" }}>
              {inner}
            </form>
          ) : (
            inner
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// FormStep — entrada do valor
// ---------------------------------------------------------------------------

function FormStep({
  onSubmitSuccess,
  onCancel,
}: {
  onSubmitSuccess: (result: TopUpResult, preBalance: number) => void;
  onCancel: () => void;
}) {
  const [amountCents, setAmountCents] = useState(0);
  const [showErr, setShowErr] = useState(false);
  const mutation = useTopUpWorkspace();
  const queryClient = useQueryClient();
  const isValid = amountCents >= MIN_CENTS;
  const bad = showErr && !isValid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setAmountCents(
      digits === "" ? 0 : Math.min(parseInt(digits, 10), MAX_CENTS),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setShowErr(true);
      return;
    }
    if (mutation.isPending) return;

    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      toast.error("Workspace não selecionado.");
      return;
    }

    try {
      // Captura saldo atual antes de gerar a cobrança — usado pelo polling
      // para detectar quando o pagamento foi creditado.
      const cached = queryClient.getQueryData<WorkspaceBalance>(
        BALANCE_QUERY_KEYS.workspace(workspaceId),
      );
      const preBalance = cached?.available_cents ?? 0;

      const result = await mutation.mutateAsync(amountCents);

      // Sandbox: confirma imediatamente. Em prod retorna 403 e é ignorado.
      simulatePayment(workspaceId).catch(() => {});

      onSubmitSuccess(result, preBalance);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao gerar cobrança PIX",
      );
    }
  };

  const body = (
    <>
      <div className="fnd-a">
        <label className="n4l" htmlFor="top-up-amount">
          Quanto você quer depositar?
        </label>
        <div className={`fnd-in${bad ? " bad" : ""}`}>
          <span>R$</span>
          <input
            id="top-up-amount"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="0,00"
            value={amountCents ? centsToDecimal(amountCents) : ""}
            onChange={handleChange}
          />
        </div>
        {bad && <small className="nfe">O valor mínimo é R$ 1,00</small>}
        <div className="fnd-q">
          {QUICK_AMOUNTS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              className={amountCents === cents ? "on" : ""}
              onClick={() => {
                setAmountCents(cents);
                setShowErr(false);
              }}
            >
              {brl0(cents)}
            </button>
          ))}
        </div>
      </div>
      <div className="fnd-n">
        <span>
          <I n="clock" cls="sm" />
        </span>
        <p>
          O pagamento é por <b>PIX</b> e o saldo cai na hora, assim que for
          confirmado.
        </p>
      </div>
    </>
  );

  const footer = (
    <>
      <button type="button" className="btn out" onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" className="btn" disabled={mutation.isPending}>
        {mutation.isPending ? "Gerando..." : "Gerar PIX"}
      </button>
    </>
  );

  return (
    <DepShell
      as="form"
      onSubmit={handleSubmit}
      onClose={onCancel}
      body={body}
      footer={footer}
    />
  );
}

// ---------------------------------------------------------------------------
// QrCodeStep — exibe QR e aguarda confirmação (socket + polling)
// ---------------------------------------------------------------------------

function QrCodeStep({
  result,
  preBalance,
  onConfirmed,
  onNewDeposit,
  onClose,
}: {
  result: TopUpResult;
  preBalance: number;
  onConfirmed: () => void;
  onNewDeposit: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const confirmedRef = useRef(false);
  const queryClient = useQueryClient();
  const workspaceId = getWorkspaceId() ?? "";

  const handleConfirmed = useCallback(
    (amount: string) => {
      if (confirmedRef.current) return;
      confirmedRef.current = true;
      toast.success(`PIX de ${amount} confirmado!`);
      queryClient.invalidateQueries({
        queryKey: BALANCE_QUERY_KEYS.workspace(workspaceId),
      });
      onConfirmed();
    },
    [queryClient, workspaceId, onConfirmed],
  );

  // Caminho 1: socket em tempo real
  usePaymentSocket({
    chargeId: result.charge_id,
    onConfirmed: (event) => handleConfirmed(event.amount),
  });

  // Caminho 2: polling do saldo (fallback)
  useEffect(() => {
    if (!workspaceId) return;

    const interval = setInterval(async () => {
      if (confirmedRef.current) {
        clearInterval(interval);
        return;
      }
      try {
        const balance = await queryClient.fetchQuery({
          queryKey: BALANCE_QUERY_KEYS.workspace(workspaceId),
          queryFn: () => getWorkspaceBalance(workspaceId),
          staleTime: 0,
        });
        if (balance.available_cents > preBalance) {
          handleConfirmed(result.amount);
        }
      } catch {
        // ignora — tenta no próximo tick
      }
    }, PAYMENT_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workspaceId, preBalance, result.amount, handleConfirmed, queryClient]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.pix_copy_paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código PIX.");
    }
  };

  const body = (
    <div className="fnd-p">
      <div className="fnd-qr">
        <img
          src={`data:image/png;base64,${result.pix_qr_code}`}
          alt="QR Code PIX"
          style={{ width: "100%", display: "block" }}
        />
      </div>
      <div className="fnd-pi">
        <small>Valor a pagar</small>
        <b>{result.amount}</b>
        <p>Abra o app do seu banco, escolha pagar com PIX e leia o QR Code.</p>
        <div className="fnd-cp">
          <code>{result.pix_copy_paste}</code>
          <button type="button" className="btn out" onClick={handleCopy}>
            <I n="copy" cls="sm" />
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <div className="fnd-w">
          <i />
          Aguardando pagamento…
        </div>
      </div>
    </div>
  );

  const footer = (
    <>
      <button type="button" className="btn out" onClick={onNewDeposit}>
        <I n="back" cls="sm" />
        Alterar valor
      </button>
      <button type="button" className="btn" onClick={onClose}>
        Fechar
      </button>
    </>
  );

  return <DepShell onClose={onClose} body={body} footer={footer} />;
}

// ---------------------------------------------------------------------------
// ConfirmedStep — sucesso
// ---------------------------------------------------------------------------

function ConfirmedStep({
  result,
  onNewDeposit,
  onClose,
}: {
  result: TopUpResult;
  onNewDeposit: () => void;
  onClose: () => void;
}) {
  const body = (
    <div className="fnd-ok">
      <span>
        <I n="check" />
      </span>
      <h3>Depósito confirmado</h3>
      <p>{result.amount} já estão no seu saldo.</p>
    </div>
  );
  const footer = (
    <>
      <button type="button" className="btn out" onClick={onNewDeposit}>
        Novo depósito
      </button>
      <button type="button" className="btn" onClick={onClose}>
        Concluir
      </button>
    </>
  );
  return <DepShell onClose={onClose} body={body} footer={footer} />;
}
