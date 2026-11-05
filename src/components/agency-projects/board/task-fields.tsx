import { useId, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";

import { AGENCY_PROJECT_LIMITS, TASK_PRIORITIES, TASK_STATUSES } from "@/shared/services/agency-projects";

import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, taskDueLabel } from "../project-ui";
import { AssigneesField } from "./assignees-field";
import type { FieldFeedback, FieldKey } from "./field-label";
import { TagsField } from "./tags-field";
import { isPlausibleDueDate, type TaskDraft } from "./task-logic";
import type { PersonOption } from "./use-workspace-people";

export type { FieldFeedback, FieldKey };

// ---------------------------------------------------------------------------
// Campos juntos
// ---------------------------------------------------------------------------

interface TaskFieldsProps {
  values: TaskDraft;
  /** Mudança vinda de um campo. No modo de edição cada uma já é gravada; na criação só atualiza o rascunho. */
  onChange: (patch: Partial<TaskDraft>) => void;
  /** Texto (título, descrição) só é gravado ao sair do campo: o modo de edição passa isto. */
  onTextBlur?: (field: "title" | "description") => void;
  readOnly: boolean;
  people: readonly PersonOption[];
  current: readonly PersonOption[];
  peopleLoading: boolean;
  peopleFailed: boolean;
  tagSuggestions: readonly string[];
  titleError?: string | null;
  descriptionError?: string | null;
  dueError?: string | null;
  feedback?: Partial<Record<FieldKey, FieldFeedback>>;
  autoFocusTitle?: boolean;
  /** Rótulo acima do título: Tarefa ou Subtarefa de … */
  kindLabel?: ReactNode;
}

/** Título, status, prioridade, prazo, responsáveis, etiquetas e descrição: os mesmos campos na criação e na edição. */
export function TaskFields({
  values,
  onChange,
  onTextBlur,
  readOnly,
  people,
  current,
  peopleLoading,
  peopleFailed,
  tagSuggestions,
  titleError,
  descriptionError,
  dueError,
  feedback = {},
  autoFocusTitle,
  kindLabel,
}: TaskFieldsProps) {
  const ids = { title: useId(), status: useId(), priority: useId(), due: useId(), description: useId() };
  const due = values.due_date && isPlausibleDueDate(values.due_date) ? taskDueLabel({ status: values.status, due_date: values.due_date }) : null;

  const problem = Object.values(feedback).find((f) => f?.state === "error");

  return (
    <div className="apj-tm-fields">
      {kindLabel ? <p className="apj-td-kind">{kindLabel}</p> : null}
      <div className={`apj-td-title${titleError ? " err" : ""}`}>
        <textarea
          id={ids.title}
          rows={1}
          aria-label="Título"
          data-adm-autofocus={autoFocusTitle ? "" : undefined}
          maxLength={AGENCY_PROJECT_LIMITS.taskTitle}
          placeholder="Nome da tarefa"
          value={values.title}
          readOnly={readOnly}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${ids.title}-e` : undefined}
          onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, " ") })}
          onBlur={() => onTextBlur?.("title")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (onTextBlur) e.currentTarget.blur();
            }
          }}
        />
        {titleError ? (
          <small className="nfe" id={`${ids.title}-e`}>
            {titleError}
          </small>
        ) : null}
      </div>

      <div className="apj-props">
        <label className="apj-chip apj-chip-sel" data-status={values.status}>
          <span className="apj-chip-dot" aria-hidden="true" />
          <select id={ids.status} aria-label="Status" value={values.status} disabled={readOnly} onChange={(e) => onChange({ status: e.target.value as TaskDraft["status"] })}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <AssigneesField
          value={{ ids: values.assignee_ids, primary: values.primary_assignee_id }}
          people={people}
          current={current}
          loading={peopleLoading}
          failed={peopleFailed}
          readOnly={readOnly}
          onChange={(v) => onChange({ assignee_ids: v.ids, primary_assignee_id: v.primary })}
        />

        <label className="apj-chip apj-chip-date" data-empty={!values.due_date || undefined} data-late={due?.overdue || undefined}>
          <I n="clock" cls="sm" />
          <input id={ids.due} aria-label="Prazo" type="date" value={values.due_date} disabled={readOnly} onChange={(e) => onChange({ due_date: e.target.value })} />
          {values.due_date && !readOnly ? (
            <button
              type="button"
              className="apj-chip-x"
              aria-label="Remover prazo"
              onClick={(e) => {
                e.preventDefault();
                onChange({ due_date: "" });
              }}
            >
              <I n="x" cls="sm" />
            </button>
          ) : null}
        </label>
        {due?.overdue ? <span className="apj-chip apj-chip-late">{due.text}</span> : null}

        <label className="apj-chip apj-chip-sel" data-priority={values.priority}>
          <I n="flag" cls="sm" />
          <select id={ids.priority} aria-label="Prioridade" value={values.priority} disabled={readOnly} onChange={(e) => onChange({ priority: e.target.value as TaskDraft["priority"] })}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <TagsField tags={values.tags} suggestions={tagSuggestions} readOnly={readOnly} feedback={feedback.tags} onChange={(tags) => onChange({ tags })} />
      </div>
      {dueError ? (
        <small className="nfe" role="alert">
          {dueError}
        </small>
      ) : null}
      {problem ? (
        <small className="nfe" role="alert">
          {problem.message ?? "Não foi possível salvar."}
        </small>
      ) : null}

      <div className={`apj-td-desc${descriptionError ? " err" : ""}`}>
        <label htmlFor={ids.description}>Descrição</label>
        <textarea
          id={ids.description}
          rows={4}
          maxLength={AGENCY_PROJECT_LIMITS.taskDescription}
          placeholder="Contexto, critérios de aceite e links úteis"
          value={values.description}
          readOnly={readOnly}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError ? `${ids.description}-e` : undefined}
          onChange={(e) => onChange({ description: e.target.value })}
          onBlur={() => onTextBlur?.("description")}
        />
        {descriptionError ? (
          <small className="nfe" id={`${ids.description}-e`}>
            {descriptionError}
          </small>
        ) : null}
      </div>
    </div>
  );
}
