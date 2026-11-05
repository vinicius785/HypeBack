import { useId, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import type { FieldFeedback } from "./field-label";
import { addTag, removeTag } from "./task-logic";

interface TagsFieldProps {
  tags: readonly string[];
  suggestions: readonly string[];
  readOnly: boolean;
  feedback?: FieldFeedback;
  onChange: (tags: string[]) => void;
}

/** Etiquetas: digitar e Enter (ou vírgula) acrescenta; até 10 de 30 caracteres, sem repetir; sugestões das outras tarefas. */
export function TagsField({ tags, suggestions, readOnly, onChange }: TagsFieldProps) {
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
    <div className="apj-prop apj-prop-tags" role="group" aria-labelledby={ids.label}>
      <span id={ids.label} className="sr-only">
        Etiquetas
      </span>
      {tags.map((tag) => (
        <span key={tag} className="apj-chip apj-chip-tag">
          <I n="tag" cls="sm" />
          {tag}
          {!readOnly ? (
            <button type="button" className="apj-chip-x" aria-label={`Remover etiqueta ${tag}`} onClick={() => onChange(removeTag(tags, tag))}>
              <I n="x" cls="sm" />
            </button>
          ) : null}
        </span>
      ))}
      {tags.length === 0 && readOnly ? <span className="apj-chip" data-empty>Sem etiquetas</span> : null}
      {!readOnly ? (
        <>
          <input
            id={ids.input}
            className="apj-chip apj-chip-in"
            aria-label="Nova etiqueta"
            aria-invalid={error ? true : undefined}
            list={ids.list}
            maxLength={AGENCY_PROJECT_LIMITS.taskTag + 1}
            placeholder="+ Etiqueta"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => text.trim() && commit(text)}
          />
          <datalist id={ids.list}>
            {suggestions.filter((s) => !tags.includes(s)).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      ) : null}
      {error ? (
        <small className="nfe" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
