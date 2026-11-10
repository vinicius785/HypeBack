import { useEffect, useRef, useState } from "react";

import { AdminConfirmDialog, AdminDialog, adminToast } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useIssueStaffRecoveryCode } from "@/hooks/admin/use-admin-staff-recovery";

import { describeStaffRecoveryError } from "./staff-recovery-errors";

import "@/styles/admin-team.css";

/** A pessoa da equipe que vai receber o código. */
export interface StaffRecoveryTarget {
  id: number;
  name: string;
  email: string;
}

/** O código emitido: vive só neste estado local e some ao fechar (nada em storage, URL ou cache). */
interface IssuedCode {
  code: string;
  name: string;
  /** Instante em que vence (ms desde a época), calculado no navegador a partir de `expires_in_minutes`. */
  expiresAt: number;
}

/** `mm:ss` do tempo que falta (0 quando venceu). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useRemaining(expiresAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return expiresAt === null ? 0 : Math.max(0, expiresAt - now);
}

interface Props {
  /** Quem recebe o código; `null` com tudo fechado. */
  target: StaffRecoveryTarget | null;
  onClose: () => void;
}

/**
 * Gerar código de recuperação de senha de um colega da equipe: confirmação, chamada e o código em destaque, uma única
 * vez. Quem usa o código é o colega, na tela pública "Redefinir com código" (`/staff-reset-password`).
 */
export function StaffRecoveryDialogs({ target, onClose }: Props) {
  const mutation = useIssueStaffRecoveryCode();
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const close = () => {
    // Descarta o segredo: estado local zerado e o resultado da mutação esquecido.
    setIssued(null);
    setError(null);
    mutation.reset();
    onClose();
  };

  const generate = () => {
    // Sem duplo clique: a segunda chamada gerada antes da resposta invalidaria o código que a pessoa vai ver.
    if (!target || sending.current) return;
    sending.current = true;
    setError(null);
    mutation.mutate(target.id, {
      onSuccess: (data) => {
        sending.current = false;
        setIssued({ code: data.code, name: data.user.name || target.name, expiresAt: Date.now() + data.expires_in_minutes * 60_000 });
      },
      onError: (err) => {
        sending.current = false;
        setError(describeStaffRecoveryError(err));
      },
    });
  };

  if (!target) return null;

  return (
    <>
      <AdminConfirmDialog
        open={issued === null}
        title="Gerar código de recuperação"
        description={`Gerar um código de recuperação para ${target.name}? O código anterior deixa de valer.`}
        tone="neutral"
        reason={false}
        confirmLabel="Gerar código"
        pending={mutation.isPending}
        pendingLabel="Gerando…"
        error={error}
        onConfirm={generate}
        onClose={close}
      />
      {issued ? <IssuedCodeDialog issued={issued} onClose={close} /> : null}
    </>
  );
}

function IssuedCodeDialog({ issued, onClose }: { issued: IssuedCode; onClose: () => void }) {
  const remaining = useRemaining(issued.expiresAt);
  const expired = remaining <= 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.code);
      adminToast.success("Código copiado");
    } catch {
      adminToast.error("Não foi possível copiar. Selecione o código e copie à mão.");
    }
  };

  return (
    <AdminDialog
      open
      size="sm"
      onClose={onClose}
      title="Código de recuperação"
      description={`Para ${issued.name}. Este código aparece só agora: ao fechar esta janela, ele não pode ser visto de novo.`}
      footer={
        <button type="button" className="btn" data-adm-autofocus onClick={onClose}>
          Fechar
        </button>
      }
    >
      <div className="adm-team-code" data-expired={expired || undefined}>
        <output className="adm-team-code-v" aria-label="Código gerado">
          {expired ? "Código vencido" : issued.code}
        </output>
        <div className="adm-team-code-bar">
          <span aria-live="off" className="adm-team-code-t">
            <I n="clock" cls="sm" />
            {expired ? "Vencido: gere outro código." : `Vence em ${formatRemaining(remaining)}`}
          </span>
          <button type="button" className="btn out adm-btn-sm" disabled={expired} onClick={() => void copy()}>
            <I n="copy" cls="sm" /> Copiar
          </button>
        </div>
      </div>
      <p className="adm-team-code-note">
        Entregue este código por fora do sistema (WhatsApp ou pessoalmente), só para {issued.name}. Vale 15 minutos e só pode ser usado uma vez.
      </p>
    </AdminDialog>
  );
}
