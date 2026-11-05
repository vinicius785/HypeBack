import { useId } from "react";

import { AGENCY_PROJECT_LIMITS, TASK_PRIORITIES, TASK_STATUSES } from "@/shared/services/agency-projects";

import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, taskDueLabel } from "../project-ui";
import { AssigneesField } from "./assignees-field";
import { FieldLabel, type FieldFeedback, type FieldKey } from "./field-label";
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
}: TaskFieldsProps) {
  const ids = { title: useId(), status: useId(), priority: useId(), due: useId(), description: useId() };
  const due = values.due_date && isPlausibleDueDate(values.due_date) ? taskDueLabel({ status: values.status, due_date: values.due_date }) : null;

  return (
    <div className="apj-tm-fields">
      <div className={`nf${titleError ? " err" : ""}`}>
        <FieldLabel htmlFor={ids.title} feedback={feedback.title}>
          Título
        </FieldLabel>
        <input
          id={ids.title}
          className="ni"
          data-adm-autofocus={autoFocusTitle ? "" : undefined}
          maxLength={AGENCY_PROJECT_LIMITS.taskTitle}
          placeholder="Ex.: Aprovar roteiro do primeiro vídeo"
          value={values.title}
          readOnly={readOnly}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${ids.title}-e` : undefined}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => onTextBlur?.("title")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onTextBlur) e.currentTarget.blur();
          }}
        />
        {titleError ? (
          <small className="nfe" id={`${ids.title}-e`}>
            {titleError}
          </small>
        ) : null}
      </div>

      <div className="apj-tm-grid">
        <div className="nf">
          <FieldLabel htmlFor={ids.status} feedback={feedback.status}>
            Status
          </FieldLabel>
          <select id={ids.status} className="ni" value={values.status} disabled={readOnly} onChange={(e) => onChange({ status: e.target.value as TaskDraft["status"] })}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="nf">
          <FieldLabel htmlFor={ids.priority} feedback={feedback.priority}>
            Prioridade
          </FieldLabel>
          <select id={ids.priority} className="ni" value={values.priority} disabled={readOnly} onChange={(e) => onChange({ priority: e.target.value as TaskDraft["priority"] })}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="nf">
          <FieldLabel htmlFor={ids.due} feedback={feedback.due_date}>
            Prazo
          </FieldLabel>
          <div className="apj-tm-due">
            <input id={ids.due} className="ni" type="date" value={values.due_date} disabled={readOnly} onChange={(e) => onChange({ due_date: e.target.value })} />
            {values.due_date && !readOnly ? (
              <button type="button" className="apj-tm-link" onClick={() => onChange({ due_date: "" })}>
                Remover prazo
              </button>
            ) : null}
          </div>
          {dueError ? (
            <small className="nfe" role="alert">
              {dueError}
            </small>
          ) : due?.overdue ? (
            <small className="apj-tm-late">{due.text}</small>
          ) : null}
        </div>
      </div>

      <AssigneesField
        value={{ ids: values.assignee_ids, primary: values.primary_assignee_id }}
        people={people}
        current={current}
        loading={peopleLoading}
        failed={peopleFailed}
        readOnly={readOnly}
        feedback={feedback.assignees}
        onChange={(v) => onChange({ assignee_ids: v.ids, primary_assignee_id: v.primary })}
      />

      <TagsField tags={values.tags} suggestions={tagSuggestions} readOnly={readOnly} feedback={feedback.tags} onChange={(tags) => onChange({ tags })} />

      <div className={`nf${descriptionError ? " err" : ""}`}>
        <FieldLabel htmlFor={ids.description} feedback={feedback.description}>
          Descrição <em className="apj-opt">· texto simples</em>
        </FieldLabel>
        <textarea
          id={ids.description}
          className="ni ta"
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
