import { useRef, useState, type FormEvent } from "react";

import { I } from "@/components/prototype/ui";
import { agencyProjectErrorMessage, AGENCY_PROJECT_LIMITS, type Task } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, formatDate, taskDueLabel } from "../project-ui";
import { CornerDownRight } from "lucide-react";
import { SectionSkeleton, TaskSection, useSectionOpen } from "./task-section";
import { validateTaskTitle } from "./task-logic";

interface SubtasksSectionProps {
  /** `undefined` enquanto o detalhe da tarefa carrega. */
  subtasks: readonly Task[] | undefined;
  canWrite: boolean;
  onAdd: (title: string) => Promise<unknown>;
  /** Marcar concluída (`true`) ou reabrir (`false`). */
  onToggle: (subtask: Task, done: boolean) => Promise<unknown>;
  onRemove: (subtask: Task) => Promise<unknown>;
  /** Abre a subtarefa no próprio modal (ela tem prazo, responsáveis e comentários como qualquer tarefa). */
  onOpen: (subtaskId: string) => void;
}

/** Subtarefas de um nível: adicionar, marcar concluída, abrir e remover (com confirmação). */
export function SubtasksSection({ subtasks, canWrite, onAdd, onToggle, onRemove, onOpen }: SubtasksSectionProps) {
  const [title, setTitle] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const { confirm, dialog } = useProjectConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useSectionOpen(!subtasks || subtasks.length > 0);

  const run = async (key: string, action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setWorking(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(agencyProjectErrorMessage(e, fallback));
      return false;
    } finally {
      setWorking(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateTaskTitle(title);
    if (problem) {
      setFieldError(title.trim() ? problem : "Informe o título da subtarefa");
      return;
    }
    if (await run("add", () => onAdd(title.trim()), "Não foi possível criar a subtarefa.")) setTitle("");
  };

  const remove = async (subtask: Task) => {
    const ok = await confirm({
      title: "Remover subtarefa?",
      description: `“${subtask.title}” será apagada, com seus comentários e anexos.`,
      confirmLabel: "Remover subtarefa",
      tone: "danger",
    });
    if (ok) await run(subtask.id, () => onRemove(subtask), "Não foi possível remover a subtarefa.");
  };

  const done = subtasks?.filter((s) => s.status === "concluido").length ?? 0;
  const total = subtasks?.length ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <TaskSection
      title="Subtarefas"
      icon={<CornerDownRight className="ico sm" aria-hidden />}
      open={open}
      onOpenChange={setOpen}
      count={
        subtasks ? (
          <>
            {done}/{total} concluídas
            {total > 0 ? (
              <span className="apj-bar apj-bar-mini" role="progressbar" aria-label="Subtarefas concluídas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <i style={{ width: `${percent}%` }} />
              </span>
            ) : null}
          </>
        ) : undefined
      }
      action={
        canWrite ? (
          <button
            type="button"
            className="apj-link"
            onClick={() => {
              setOpen(true);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            + Adicionar
          </button>
        ) : null
      }
    >
      {!subtasks ? (
        <SectionSkeleton label="Carregando subtarefas" />
      ) : (
        <>
          {total === 0 ? <p className="apj-tm-none">Nenhuma subtarefa.</p> : null}
          {total > 0 ? (
            <div className="apj-st-head" aria-hidden="true">
              <span />
              <span>Nome</span>
              <span>Responsável</span>
              <span>Prioridade</span>
              <span>Prazo</span>
              <span />
            </div>
          ) : null}
          <ul className="apj-st-list" role="list">
            {subtasks.map((s) => {
              const isDone = s.status === "concluido";
              const due = s.due_date ? taskDueLabel({ status: s.status, due_date: s.due_date }) : null;
              return (
                <li key={s.id} className="apj-st-row" data-done={isDone || undefined}>
                  <label className="apj-tm-check">
                    <input
                      type="checkbox"
                      checked={isDone}
                      disabled={!canWrite || working === s.id}
                      aria-label={`${isDone ? "Reabrir" : "Concluir"} subtarefa ${s.title}`}
                      onChange={() => void run(s.id, () => onToggle(s, !isDone), "Não foi possível atualizar a subtarefa.")}
                    />
                  </label>
                  <button type="button" className="apj-tm-rowt" title={TASK_STATUS_LABEL[s.status]} onClick={() => onOpen(s.id)}>
                    {s.title}
                  </button>
                  <span className="apj-st-c apj-st-who">{s.assignees.length > 0 ? s.assignees.map((a) => a.name.split(" ")[0]).join(", ") : "—"}</span>
                  <span className="apj-st-c">{TASK_PRIORITY_LABEL[s.priority]}</span>
                  <span className={`apj-st-c${due?.overdue ? " apj-is-late" : ""}`}>{s.due_date ? formatDate(s.due_date) : "—"}</span>
                  {canWrite ? (
                    <button type="button" className="apj-tm-x" aria-label={`Remover subtarefa ${s.title}`} disabled={working === s.id} onClick={() => void remove(s)}>
                      <I n="trash" cls="sm" />
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
          {canWrite ? (
            <form className="apj-st-add" onSubmit={(e) => void submit(e)} noValidate>
              <input
                ref={inputRef}
                aria-label="Nova subtarefa"
                aria-invalid={fieldError ? true : undefined}
                maxLength={AGENCY_PROJECT_LIMITS.taskTitle}
                placeholder="+ Adicionar subtarefa"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFieldError(null);
                }}
              />
              <button type="submit" className="btn out" disabled={working === "add"}>
                {working === "add" ? "Adicionando…" : "Adicionar"}
              </button>
            </form>
          ) : null}
          {fieldError ? (
            <small className="nfe" role="alert">
              {fieldError}
            </small>
          ) : null}
          {error ? (
            <div className="apj-err" role="alert">
              {error}
            </div>
          ) : null}
        </>
      )}
      {dialog}
    </TaskSection>
  );
}
