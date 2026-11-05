import { useState, type FormEvent } from "react";

import { I } from "@/components/prototype/ui";
import { agencyProjectErrorMessage, AGENCY_PROJECT_LIMITS, type Task } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { TASK_STATUS_LABEL } from "../project-ui";
import { SectionSkeleton, TaskSection } from "./task-section";
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
    <TaskSection title="Subtarefas" count={subtasks ? `${done}/${total}` : undefined}>
      {!subtasks ? (
        <SectionSkeleton label="Carregando subtarefas" />
      ) : (
        <>
          {total > 0 ? (
            <div className="apj-bar" role="progressbar" aria-label="Subtarefas concluídas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <i style={{ width: `${percent}%` }} />
            </div>
          ) : null}
          {total === 0 ? <p className="apj-tm-none">Nenhuma subtarefa.</p> : null}
          <ul className="apj-tm-list" role="list">
            {subtasks.map((s) => {
              const isDone = s.status === "concluido";
              return (
                <li key={s.id} className="apj-tm-row" data-done={isDone || undefined}>
                  <label className="apj-tm-check">
                    <input
                      type="checkbox"
                      checked={isDone}
                      disabled={!canWrite || working === s.id}
                      aria-label={`${isDone ? "Reabrir" : "Concluir"} subtarefa ${s.title}`}
                      onChange={() => void run(s.id, () => onToggle(s, !isDone), "Não foi possível atualizar a subtarefa.")}
                    />
                  </label>
                  <button type="button" className="apj-tm-rowt" onClick={() => onOpen(s.id)}>
                    {s.title}
                  </button>
                  {!isDone ? <small>{TASK_STATUS_LABEL[s.status]}</small> : null}
                  {canWrite ? (
                    <button type="button" className="apj-tm-x" aria-label={`Remover subtarefa ${s.title}`} disabled={working === s.id} onClick={() => void remove(s)}>
                      <I n="trash" cls="sm" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canWrite ? (
            <form className="apj-tm-add" onSubmit={(e) => void submit(e)} noValidate>
              <input
                className="ni"
                aria-label="Nova subtarefa"
                aria-invalid={fieldError ? true : undefined}
                maxLength={AGENCY_PROJECT_LIMITS.taskTitle}
                placeholder="Adicionar subtarefa"
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
