import { useState } from "react";

import { I } from "@/components/prototype/ui";
import { DeleteBlockersPanel } from "@/components/workspace-state/delete-blockers-panel";
import type { DeleteBlocker } from "@/lib/workspace-state/delete-blockers";

import { WkModal } from "./wk-modal";

/**
 * Exclusão do workspace: o nome digitado confirma. A exclusão é LÓGICA (o workspace some para o time, nada é
 * apagado) e o servidor recusa com impedimentos (409 WORKSPACE_DELETE_BLOCKED): `blockers` os mostra no próprio
 * diálogo, que continua aberto. `null`/ausente = sem recusa por impedimento.
 */
export function DeleteModal({
  name,
  pending,
  blockers,
  onClose,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  blockers?: DeleteBlocker[] | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [v, setV] = useState("");
  return (
    <WkModal
      cls="wkm"
      sub="Zona de risco"
      title="Excluir workspace"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn dng"
            disabled={pending || v.trim() !== name.trim()}
            onClick={onConfirm}
          >
            <I n="trash" cls="sm" />
            {pending ? "Excluindo…" : "Excluir workspace"}
          </button>
        </>
      }
    >
      <div className="wkm-wr">
        <I n="trash" />
        <p>
          <b>{name}</b> deixa de aparecer para você e para toda a equipe, com as campanhas, os contratos e o
          financeiro. Nada é apagado dos nossos registros, mas só o suporte pode restaurar o workspace. Para
          confirmar, digite o nome dele.
        </p>
      </div>
      <div className="n4c">
        <label className="n4l" htmlFor="wkdn">
          Nome do workspace
        </label>
        <input
          className="cm-in"
          id="wkdn"
          placeholder={name}
          autoComplete="off"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      </div>
      {blockers ? <DeleteBlockersPanel blockers={blockers} workspaceName={name} /> : null}
    </WkModal>
  );
}
