import { useId, useMemo, useState } from "react";

import { Check, Star } from "lucide-react";
import { Av, I } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import { type FieldFeedback } from "./field-label";
import { canAddAssignee, toggleAssignee, setPrimaryAssignee, type AssigneeValue } from "./task-logic";
import { ChipPopover } from "./task-menus";
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
export function AssigneesField({ value, people, current, loading, failed, readOnly, onChange }: AssigneesFieldProps) {
  const [filter, setFilter] = useState("");
  const labelId = useId();
  
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

  const summary = selected.length === 0 ? "Responsável" : selected.length === 1 ? selected[0].name : `${selected[0].name} +${selected.length - 1}`;

  return (
    <>
      <span id={labelId} className="sr-only">
        Responsáveis
      </span>
      <ChipPopover
        role="group"
        labelledBy={labelId}
        label="Editar responsáveis"
        width={290}
        data={{ empty: selected.length === 0 }}
        disabled={readOnly}
        content={
          <>
            {selected.length > 0 ? (
              <span className="apj-chip-avs">
                {selected.slice(0, 3).map((p) => (
                  <Av key={p.id} name={p.name} src={p.avatar ?? undefined} size={18} />
                ))}
              </span>
            ) : (
              <I n="plus" cls="sm" />
            )}
            <span>{readOnly && selected.length > 0 ? selected.map((p) => p.name).join(", ") : readOnly ? "Ninguém atribuído" : summary}</span>
            {selected.length > 1 ? (
              <span className="sr-only">
                {selected.map((p) => p.name).join(", ")}
                {value.primary ? `. Principal: ${nameOf(value.primary)?.name ?? ""}` : ""}
              </span>
            ) : null}
          </>
        }
      >
        {() => (
          <div className="apj-pw">
            <p className="apj-pw-h">Responsável e colaboradores</p>
            {failed ? <small className="nfh apj-pad">Não foi possível carregar os membros do workspace. Só você e quem já é responsável aparecem aqui.</small> : null}
            {loading && options.length === 0 ? <small className="nfh apj-pad">Carregando membros…</small> : null}
            {options.length > SEARCH_FROM ? (
              <label className="apj-tagpop-s">
                <I n="search" cls="sm" />
                <input type="search" aria-label="Buscar membro" placeholder="Buscar membro" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </label>
            ) : null}
            <ul role="list" className="apj-pw-l">
              {shown.map((p) => {
                const checked = value.ids.includes(p.id);
                const blocked = !checked && !canAddAssignee(value);
                const isPrimary = value.primary === p.id;
                return (
                  <li key={p.id} className="apj-pw-r" data-on={checked || undefined}>
                    <button type="button" role="checkbox" aria-checked={checked} aria-label={p.name} disabled={blocked} className="apj-mi" onClick={() => onChange(toggleAssignee(value, p.id))}>
                      <Av name={p.name} src={p.avatar ?? undefined} size={22} />
                      <span className="apj-pw-n">{p.name}</span>
                      {checked ? <Check className="ico sm apj-mi-ok" aria-hidden /> : null}
                    </button>
                    {checked && value.ids.length > 1 ? (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isPrimary}
                        aria-label={`${p.name} é o responsável principal`}
                        title={isPrimary ? "Responsável principal" : "Tornar principal"}
                        className="apj-pw-star"
                        data-on={isPrimary || undefined}
                        onClick={() => onChange(setPrimaryAssignee(value, p.id))}
                      >
                        <Star className="ico sm" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              })}
              {shown.length === 0 ? <li className="apj-tm-none apj-pad">Nenhum membro encontrado</li> : null}
            </ul>
            {!canAddAssignee(value) ? <small className="nfh apj-pad">Cada tarefa aceita até {AGENCY_PROJECT_LIMITS.taskAssignees} responsáveis.</small> : null}
          </div>
        )}
      </ChipPopover>
    </>
  );
}
