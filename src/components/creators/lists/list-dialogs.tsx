import { useState } from "react";

import { PvModal } from "@/components/influencer-lists/pv-modal";
import { I } from "@/components/prototype/ui";

import { countLabel } from "./list-format";

const NAME_MAX = 80;
const DESC_MAX = 240;

interface FormProps {
  mode: "create" | "edit";
  initial?: { name: string; description?: string | null };
  saving: boolean;
  onSubmit: (v: { name: string; description: string }) => void;
  onClose: () => void;
}

/** Criar e editar compartilham o mesmo formulário: nome (obrigatório) e descrição (opcional). */
export function ListFormModal({ mode, initial, saving, onSubmit, onClose }: FormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const valid = name.trim().length > 0;
  const changed = mode === "create" || name.trim() !== (initial?.name ?? "") || description.trim() !== (initial?.description ?? "").trim();
  const submit = () => valid && changed && !saving && onSubmit({ name: name.trim(), description: description.trim() });

  return (
    <PvModal
      sub="Minhas listas"
      title={mode === "create" ? "Nova lista" : "Editar lista"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={!valid || !changed || saving} onClick={submit}>
            {saving ? "Salvando…" : mode === "create" ? "Criar lista" : "Salvar"}
          </button>
        </>
      }
    >
      <form
        className="lst-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          <span className="n4l">Nome da lista</span>
          <input
            className="cm-in"
            autoFocus
            maxLength={NAME_MAX}
            placeholder="Ex.: Top creators de moda"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span className="n4l">
            Descrição <em>(opcional)</em>
          </span>
          <textarea
            className="cm-ta"
            rows={3}
            maxLength={DESC_MAX}
            placeholder="Para que serve esta lista? Ex.: criadores para a campanha de verão"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <small className="lst-cnt">
            {description.length}/{DESC_MAX}
          </small>
        </label>
      </form>
    </PvModal>
  );
}

interface DeleteProps {
  name: string;
  count: number;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ListDeleteModal({ name, count, deleting, onConfirm, onClose }: DeleteProps) {
  return (
    <PvModal
      sub="Minhas listas"
      title="Excluir lista"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn dng lst-del" disabled={deleting} onClick={onConfirm}>
            <I n="trash" cls="sm" />
            {deleting ? "Excluindo…" : "Excluir lista"}
          </button>
        </>
      }
    >
      <p className="lst-warn">
        A lista <b>{name}</b>
        {count > 0 ? ` (${countLabel(count)})` : ""} será excluída. Os criadores continuam no catálogo e em outras listas; só a lista e
        o agrupamento somem. Esta ação não pode ser desfeita.
      </p>
    </PvModal>
  );
}
