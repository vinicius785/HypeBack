import { useId, useMemo, useState } from "react";

import { Av } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import { FieldLabel, type FieldFeedback } from "./field-label";
import { canAddAssignee, toggleAssignee, setPrimaryAssignee, type AssigneeValue } from "./task-logic";
import type { PersonOption } from "./use-workspace-people";

interface AssigneesFieldProps {
  value: AssigneeValue;
  /** Membros do workspace que podem ser escolhidos. */
  people: readonly PersonOption[];
  /** Quem já é responsável (nome e foto), para aparecer mesmo se a lista de membros não trouxer. */
  current: readonly PersonOption[];
  loading: boolean;
  failed: boolean;
  readOnly: boolean;
  feedback?: FieldFeedback;
  onChange: (value: AssigneeValue) => void;
}

const SEARCH_FROM = 8;

/**
 * Responsáveis (vários, um principal): resumo em chips e, para quem edita, uma lista de membros do workspace com caixa de
 * marcar e, em cada marcado, a escolha do principal. Um id que não está mais na equipe continua aparecendo para poder sair.
 */
export function AssigneesField({ value, people, current, loading, failed, readOnly, feedback, onChange }: AssigneesFieldProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const labelId = useId();
  const groupName = useId();

  const options = useMemo(() => {
    const byId = new Map<number, PersonOption>();
    for (const p of people) byId.set(p.id, p);
    for (const p of current) byId.set(p.id, { ...byId.get(p.id), ...p, name: byId.get(p.id)?.name ?? p.name });
    for (const id of value.ids) if (!byId.has(id)) byId.set(id, { id, name: `Usuário ${id}` });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [people, current, value.ids]);
  const nameOf = (id: number) => options.find((o) => o.id === id);
  const needle = filter.trim().toLocaleLowerCase("pt-BR");
  const shown = needle ? options.filter((o) => o.name.toLocaleLowerCase("pt-BR").includes(needle)) : options;
  const selected = value.ids.map((id) => nameOf(id)).filter((p): p is PersonOption => !!p);

  return (
    <div className="nf apj-tm-wide" role="group" aria-labelledby={labelId}>
      <FieldLabel id={labelId} feedback={feedback}>
        Responsáveis
      </FieldLabel>
      <div className="apj-tm-people">
        {selected.length === 0 ? <span className="apj-tm-none">Ninguém atribuído</span> : null}
        {selected.map((p) => (
          <span key={p.id} className="apj-tm-person">
            <Av name={p.name} src={p.avatar ?? undefined} size={22} />
            {p.name}
            {value.primary === p.id && selected.length > 1 ? <em>Principal</em> : null}
          </span>
        ))}
        {!readOnly ? (
          <button type="button" className="apj-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar lista" : "Editar responsáveis"}
          </button>
        ) : null}
      </div>

      {open && !readOnly ? (
        <fieldset className="apj-tm-pick">
          <legend className="sr-only">Quem é responsável</legend>
          {failed ? <small className="nfh">Não foi possível carregar os membros do workspace. Só você e quem já é responsável aparecem aqui.</small> : null}
          {loading && options.length === 0 ? <small className="nfh">Carregando membros…</small> : null}
          {options.length > SEARCH_FROM ? <input type="search" className="ni" aria-label="Buscar membro" placeholder="Buscar membro" value={filter} onChange={(e) => setFilter(e.target.value)} /> : null}
          <ul role="list">
            {shown.map((p) => {
              const checked = value.ids.includes(p.id);
              return (
                <li key={p.id}>
                  <label className="apj-tm-check">
                    <input type="checkbox" checked={checked} disabled={!checked && !canAddAssignee(value)} onChange={() => onChange(toggleAssignee(value, p.id))} />
                    <Av name={p.name} src={p.avatar ?? undefined} size={22} />
                    <span>{p.name}</span>
                  </label>
                  {checked && value.ids.length > 1 ? (
                    <label className="apj-tm-radio">
                      <input type="radio" name={groupName} checked={value.primary === p.id} aria-label={`${p.name} é o responsável principal`} onChange={() => onChange(setPrimaryAssignee(value, p.id))} />
                      Principal
                    </label>
                  ) : null}
                </li>
              );
            })}
            {shown.length === 0 ? <li className="apj-tm-none">Nenhum membro encontrado</li> : null}
          </ul>
          {!canAddAssignee(value) ? <small className="nfh">Cada tarefa aceita até {AGENCY_PROJECT_LIMITS.taskAssignees} responsáveis.</small> : null}
        </fieldset>
      ) : null}
    </div>
  );
}
