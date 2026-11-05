import { useCallback, useRef, useState, type ReactNode } from "react";

import { AdminConfirmDialog } from "@/components/admin/platform/admin-confirm-dialog";
import { agencyProjectErrorMessage } from "@/shared/services/agency-projects";

export interface ProjectConfirmOptions {
  title: string;
  description?: ReactNode;
  /** "O que acontece": uma frase por item. */
  consequences?: readonly ReactNode[];
  confirmLabel: string;
  /** Texto do botão de cancelar (padrão "Cancelar"). */
  cancelLabel?: string;
  /** `danger` (padrão em exclusões): botão vermelho; `neutral`: botão preto. */
  tone?: "danger" | "neutral";
  /** Texto do erro quando `run` falha e o diálogo continua aberto. */
  errorFallback?: string;
  /**
   * Trabalho feito ao confirmar (ex.: a exclusão). O diálogo fica travado em "Aguarde…" até terminar; se falhar,
   * mostra o erro dentro dele e deixa tentar de novo. Sem `run`, confirmar só fecha e devolve `true`.
   */
  run?: () => Promise<unknown>;
}

interface Pending {
  options: ProjectConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * Confirmação reutilizável de Projetos (arquivar, excluir, descartar alterações, remover tarefa/documento…), sobre o
 * diálogo de confirmação do kit (foco preso, Escape, `alertdialog` no tom `danger`, sem campo de motivo).
 *
 *   const { confirm, dialog } = useProjectConfirm();
 *   if (!(await confirm({ title: "Arquivar projeto?", confirmLabel: "Arquivar" }))) return;
 *   …
 *   return <>…{dialog}</>;
 *
 * Resolve `true` quando a pessoa confirma (e `run`, se houver, terminou sem erro) e `false` ao cancelar.
 */
export function useProjectConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Um pedido novo enquanto outro está aberto cancela o anterior (a promise dele não fica pendurada).
  const current = useRef<Pending | null>(null);

  const confirm = useCallback(
    (options: ProjectConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        current.current?.resolve(false);
        const next = { options, resolve };
        current.current = next;
        setError(null);
        setRunning(false);
        setPending(next);
      }),
    [],
  );

  const finish = (confirmed: boolean) => {
    const open = current.current;
    current.current = null;
    setPending(null);
    setRunning(false);
    setError(null);
    open?.resolve(confirmed);
  };

  const accept = async () => {
    const open = current.current;
    if (!open) return;
    if (!open.options.run) return finish(true);
    setRunning(true);
    setError(null);
    try {
      await open.options.run();
      finish(true);
    } catch (e) {
      setRunning(false);
      setError(agencyProjectErrorMessage(e, open.options.errorFallback ?? "Não foi possível concluir. Tente de novo."));
    }
  };

  const options = pending?.options;
  const dialog = options ? (
    <AdminConfirmDialog
      open
      title={options.title}
      description={options.description}
      consequences={options.consequences}
      tone={options.tone ?? "neutral"}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      pending={running}
      pendingLabel="Aguarde…"
      error={error}
      reason={false}
      onConfirm={() => void accept()}
      onClose={() => finish(false)}
    />
  ) : null;

  return { confirm, dialog };
}
