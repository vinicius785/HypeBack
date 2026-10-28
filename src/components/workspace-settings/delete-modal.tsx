import { useState } from "react";

import { I } from "@/components/prototype/ui";

import { WkModal } from "./wk-modal";

export function DeleteModal({
  name,
  pending,
  onClose,
  onConfirm,
}: {
  name: string;
  pending: boolean;
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
            {pending ? "Excluindo…" : "Excluir definitivamente"}
          </button>
        </>
      }
    >
      <div className="wkm-wr">
        <I n="trash" />
        <p>
          Isso apaga <b>{name}</b> para sempre, junto com campanhas, contratos e financeiro. Para confirmar,
          digite o nome do workspace.
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
    </WkModal>
  );
}
