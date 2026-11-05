import { useId, type ReactNode } from "react";


import { AGENCY_PROJECT_LIMITS } from "@/shared/services/agency-projects";

import { taskDueLabel } from "../project-ui";
import { DueDateMenu, PriorityMenu, StatusMenu } from "./task-menus";
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
        <StatusMenu value={values.status} readOnly={readOnly} onChange={(status) => onChange({ status })} />

        <AssigneesField
          value={{ ids: values.assignee_ids, primary: values.primary_assignee_id }}
          people={people}
          current={current}
          loading={peopleLoading}
          failed={peopleFailed}
          readOnly={readOnly}
          onChange={(v) => onChange({ assignee_ids: v.ids, primary_assignee_id: v.primary })}
        />

        <DueDateMenu value={values.due_date} late={due?.overdue} readOnly={readOnly} onChange={(date) => onChange({ due_date: date })} />
        {due?.overdue ? <span className="apj-chip apj-chip-late">{due.text}</span> : null}

        <PriorityMenu value={values.priority} readOnly={readOnly} onChange={(priority) => onChange({ priority })} />

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
