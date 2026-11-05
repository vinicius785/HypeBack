import { useId, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import { FieldLabel, type FieldFeedback } from "./field-label";
import { addTag, removeTag } from "./task-logic";

interface TagsFieldProps {
  tags: readonly string[];
  suggestions: readonly string[];
  readOnly: boolean;
  feedback?: FieldFeedback;
  onChange: (tags: string[]) => void;
}

/** Etiquetas: digitar e Enter (ou vírgula) acrescenta; até 10 de 30 caracteres, sem repetir; sugestões das outras tarefas. */
export function TagsField({ tags, suggestions, readOnly, feedback, onChange }: TagsFieldProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = { label: useId(), input: useId(), list: useId() };

  const commit = (raw: string) => {
    if (!raw.trim()) return;
    const next = addTag(tags, raw);
    if (next.error) {
      setError(next.error);
      return;
    }
    setError(null);
    setText("");
    onChange(next.tags);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(text);
    }
  };

  return (
    <div className="nf apj-tm-wide" role="group" aria-labelledby={ids.label}>
      <FieldLabel id={ids.label} feedback={feedback}>
        Etiquetas
      </FieldLabel>
      {tags.length > 0 ? (
        <ul className="apj-tm-tags" role="list">
          {tags.map((tag) => (
            <li key={tag} className="apj-tk-tag">
              {tag}
              {!readOnly ? (
                <button type="button" aria-label={`Remover etiqueta ${tag}`} onClick={() => onChange(removeTag(tags, tag))}>
                  <I n="x" cls="sm" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : readOnly ? (
        <span className="apj-tm-none">Sem etiquetas</span>
      ) : null}
      {!readOnly ? (
        <div className="apj-tm-add">
          <input
            id={ids.input}
            className="ni"
            aria-label="Nova etiqueta"
            aria-invalid={error ? true : undefined}
            list={ids.list}
            maxLength={AGENCY_PROJECT_LIMITS.taskTag + 1}
            placeholder="Digite e aperte Enter"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
          />
          <datalist id={ids.list}>
            {suggestions.filter((s) => !tags.includes(s)).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button type="button" className="btn out" disabled={!text.trim()} onClick={() => commit(text)}>
            Adicionar
          </button>
        </div>
      ) : null}
      {error ? (
        <small className="nfe" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
