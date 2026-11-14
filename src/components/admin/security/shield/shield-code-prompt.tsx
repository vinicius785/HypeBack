import { useEffect, useRef, useState } from "react";

import { AdminDialog } from "@/components/admin/platform";
import { useShield } from "@/hooks/admin/use-admin-shield";
import { SHIELD_ERROR_TEXT, isShieldCodeComplete, setShieldActive, setShieldCodeProvider, type ShieldCodeReason } from "@/lib/admin/shield";

import { ShieldCodeField } from "./shield-code-field";

interface Pending {
  reason: ShieldCodeReason;
  resolve: (code: string | null) => void;
}

const COPY: Record<ShieldCodeReason, string> = {
  proactive: "A Operação Escudo está ativa: esta alteração precisa do código do Authenticator.",
  required: "A Operação Escudo está ativa: esta alteração precisa do código do Authenticator.",
  invalid: "O código anterior não serviu. Digite um código novo do Authenticator.",
};

/**
 * Pergunta o código do Authenticator quando uma alteração do Admin o exige (Operação Escudo ligada). Fica montado uma vez no
 * layout do Admin: registra o "provedor" que o cliente HTTP chama (`askShieldCode`) e mantém o cliente sabendo se o Escudo está
 * ligado (para pedir o código ANTES da ação). O código digitado vai direto para a chamada e é descartado: não é guardado.
 */
export function ShieldCodePrompt() {
  const shield = useShield();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const active = shield.data?.active === true;
  useEffect(() => {
    setShieldActive(active);
    return () => setShieldActive(false);
  }, [active]);

  useEffect(() => {
    const unregister = setShieldCodeProvider(
      (reason) =>
        new Promise<string | null>((resolve) => {
          // Um pedido novo cancela o anterior (não deixa uma ação esperando para sempre).
          pendingRef.current?.resolve(null);
          setPending({ reason, resolve });
        }),
    );
    return () => {
      unregister();
      pendingRef.current?.resolve(null);
    };
  }, []);

  if (!pending) return null;
  return <PromptDialog key={`${pending.reason}-${Math.random()}`} pending={pending} onDone={() => setPending(null)} />;
}

function PromptDialog({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const [code, setCode] = useState("");
  const complete = isShieldCodeComplete(code);

  const finish = (value: string | null) => {
    pending.resolve(value);
    setCode("");
    onDone();
  };

  return (
    <AdminDialog
      open
      size="sm"
      title="Digite o código do Authenticator"
      description={COPY[pending.reason]}
      onClose={() => finish(null)}
      footer={
        <>
          <button type="button" className="btn out" onClick={() => finish(null)}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={!complete} onClick={() => finish(code)}>
            Continuar
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (complete) finish(code);
        }}
      >
        <ShieldCodeField value={code} onChange={setCode} autoFocus error={pending.reason === "invalid" ? SHIELD_ERROR_TEXT.SHIELD_CODE_INVALID : null} />
      </form>
    </AdminDialog>
  );
}
