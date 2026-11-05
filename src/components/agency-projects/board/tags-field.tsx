import { useId, useState } from "react";

import { I } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import type { FieldFeedback } from "./field-label";
import { addTag, removeTag } from "./task-logic";
import { ChipPopover, tagColor } from "./task-menus";

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
  const ids = { label: useId(), input: useId() };

  const commit = (raw: string): boolean => {
    if (!raw.trim()) return false;
    const next = addTag(tags, raw);
    if (next.error) {
      setError(next.error);
      return false;
    }
    setError(null);
    setText("");
    onChange(next.tags);
    return true;
  };

  const needle = text.trim().toLocaleLowerCase("pt-BR");
  const available = suggestions.filter((t) => !tags.includes(t) && (!needle || t.toLocaleLowerCase("pt-BR").includes(needle)));
  const exact = needle && [...suggestions, ...tags].some((t) => t.toLocaleLowerCase("pt-BR") === needle);

  return (
    <div className="apj-prop apj-prop-tags" role="group" aria-labelledby={ids.label}>
      <span id={ids.label} className="sr-only">
        Etiquetas
      </span>
      {tags.map((tag) => (
        <span key={tag} className="apj-chip apj-chip-tag" style={tagColor(tag) as React.CSSProperties}>
          {tag}
          {!readOnly ? (
            <button type="button" className="apj-chip-x" aria-label={`Remover etiqueta ${tag}`} onClick={() => onChange(removeTag(tags, tag))}>
              <I n="x" cls="sm" />
            </button>
          ) : null}
        </span>
      ))}
      {tags.length === 0 && readOnly ? (
        <span className="apj-chip" data-empty>
          Sem etiquetas
        </span>
      ) : null}
      {!readOnly ? (
        <ChipPopover
          label="Adicionar etiqueta"
          className="apj-chip-add"
          width={260}
          content={
            <>
              <I n="tag" cls="sm" />
              Adicionar etiqueta
            </>
          }
        >
          {(close) => (
            <div className="apj-tagpop">
              <label className="apj-tagpop-s">
                <I n="search" cls="sm" />
                <input
                  id={ids.input}
                  autoFocus
                  aria-label="Nova etiqueta"
                  aria-invalid={error ? true : undefined}
                  maxLength={AGENCY_PROJECT_LIMITS.taskTag + 1}
                  placeholder="Buscar ou criar etiqueta…"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      if (commit(text)) close();
                    }
                  }}
                />
              </label>
              <div className="apj-menu" role="menu" aria-label="Etiquetas existentes">
                {available.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="menuitem"
                    className="apj-mi"
                    onClick={() => {
                      if (commit(t)) close();
                    }}
                  >
                    <span className="apj-tg" style={tagColor(t) as React.CSSProperties}>
                      {t}
                    </span>
                  </button>
                ))}
                {needle && !exact ? (
                  <button type="button" role="menuitem" className="apj-mi" onClick={() => commit(text) && close()}>
                    Criar “{text.trim()}”
                  </button>
                ) : null}
                {available.length === 0 && !needle ? <p className="apj-tm-none apj-pad">Digite para criar uma etiqueta.</p> : null}
              </div>
              {error ? (
                <small className="nfe apj-pad" role="alert">
                  {error}
                </small>
              ) : null}
            </div>
          )}
        </ChipPopover>
      ) : null}
    </div>
  );
}
