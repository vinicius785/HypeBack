import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { CampaignGroupParticipant } from "@/shared/services/campaign-groups";

import { GroupEntryOptions, isCampaignApproved, type GroupEntryValue } from "./group-entry-options";

export interface GroupEditValue extends GroupEntryValue {
  name: string;
  description: string;
}

/**
 * "Editar grupo": nome, descrição e as opções de entrada. O Salvar manda sempre os três campos de entrada juntos (a API
 * sobrescreve o que faltar com o padrão).
 */
export function GroupEditDialog({
  initial,
  saving,
  onSave,
  onClose,
}: {
  initial: GroupEditValue;
  saving: boolean;
  onSave: (value: GroupEditValue) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const name = value.name.trim();
  const description = value.description.trim();
  const valid = name.length >= 2 && name.length <= 80 && description.length >= 2 && description.length <= 2000;
  const unchanged =
    name === initial.name &&
    description === initial.description &&
    value.autoJoin === initial.autoJoin &&
    value.autoJoinOnApplication === initial.autoJoinOnApplication &&
    value.removeOnExit === initial.removeOnExit;
  return (
    <Modal title="Editar grupo" onClose={onClose} panelClassName="max-w-xl">
      <form
        className="gdlg-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !unchanged && !saving) onSave({ ...value, name, description });
        }}
      >
        <label className="gdlg-f">
          <span>Nome</span>
          <input maxLength={80} value={value.name} disabled={saving} autoComplete="off" onChange={(event) => setValue({ ...value, name: event.target.value })} />
        </label>
        <label className="gdlg-f">
          <span>Descrição</span>
          <textarea maxLength={2000} value={value.description} disabled={saving} onChange={(event) => setValue({ ...value, description: event.target.value })} />
        </label>
        <GroupEntryOptions
          autoJoin={value.autoJoin}
          autoJoinOnApplication={value.autoJoinOnApplication}
          removeOnExit={value.removeOnExit}
          onChange={(entry) => setValue({ ...value, ...entry })}
          disabled={saving}
        />
        <div className="gdlg-act">
          <button type="button" className="btn out" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving || unchanged || !valid}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Antes de adicionar: quantos entram e quantos ainda não foram aprovados (eles verão o conteúdo do grupo). */
export function GroupAddConfirm({
  people,
  adding,
  onConfirm,
  onClose,
}: {
  people: CampaignGroupParticipant[];
  adding: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const unapproved = people.filter((person) => !isCampaignApproved(person.campaign_status)).length;
  return (
    <Modal title="Adicionar ao grupo" onClose={onClose} panelClassName="max-w-md">
      <p className="gdlg-txt">
        Vai adicionar {people.length} {plural(people.length, "pessoa", "pessoas")}
        {unapproved > 0 ? `, ${unapproved} ${plural(unapproved, "dela", "delas")} NÃO ${plural(unapproved, "aprovada", "aprovadas")}` : ""}.{" "}
        {people.length === 1 ? "Ela verá" : "Elas verão"} o conteúdo do grupo.
      </p>
      <div className="gdlg-act">
        <button type="button" className="btn out" onClick={onClose} disabled={adding}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={onConfirm} disabled={adding}>
          {adding ? "Adicionando…" : `Adicionar ${people.length}`}
        </button>
      </div>
    </Modal>
  );
}

export interface GroupAddFailure {
  name: string;
  reason: string;
}

export interface GroupAddResult {
  joined: number;
  alreadyMember: number;
  failures: GroupAddFailure[];
}

/** Depois de adicionar, com falhas: o resumo e o motivo de cada uma. */
export function GroupAddSummary({ result, onClose }: { result: GroupAddResult; onClose: () => void }) {
  return (
    <Modal title="Resultado" onClose={onClose} panelClassName="max-w-md">
      <ul className="gdlg-sum">
        <li>
          <b>{result.joined}</b> {plural(result.joined, "entrou", "entraram")}
        </li>
        <li>
          <b>{result.alreadyMember}</b> {plural(result.alreadyMember, "já era membro", "já eram membros")}
        </li>
        <li data-bad="true">
          <b>{result.failures.length}</b> {plural(result.failures.length, "falhou", "falharam")}
        </li>
      </ul>
      {result.failures.length > 0 ? (
        <ul className="gdlg-fail" aria-label="Quem falhou">
          {result.failures.map((failure, index) => (
            <li key={`${failure.name}-${index}`}>
              <b>{failure.name}</b>
              <small>{failure.reason}</small>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="gdlg-act">
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
