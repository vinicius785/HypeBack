import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCreateProjectTask } from "@/hooks/use-agency-projects";
import { agencyProjectErrorMessage } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { deriveTaskTags } from "../project-ui";
import { TaskDialogShell } from "./task-dialog";
import { TaskFields } from "./task-fields";
import { draftToInput, emptyDraft, isDraftDirty, validateDueDate, validateTaskDescription, validateTaskTitle, type TaskDraft } from "./task-logic";
import type { TaskModalProps } from "./task-modal";
import { knownProjectPeople, useWorkspacePeople } from "./use-workspace-people";

import "@/styles/agency-projects.css";

/** Formulário de criação da tarefa: grava tudo de uma vez e pede confirmação de descarte ao cancelar com algo preenchido. */
export function TaskCreator({ project, can, defaultStatus, tasks, onClose }: TaskModalProps) {
  const base = useMemo(() => emptyDraft(defaultStatus ?? "aberto"), [defaultStatus]);
  const [draft, setDraft] = useState<TaskDraft>(base);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProjectTask(project.id);
  const known = useMemo(() => knownProjectPeople(project, tasks), [project, tasks]);
  const people = useWorkspacePeople({ enabled: can.canWrite, known });
  const { confirm, dialog } = useProjectConfirm();
  const tagSuggestions = useMemo(() => deriveTaskTags(tasks), [tasks]);
  const busy = create.isPending;
  const dirty = isDraftDirty(draft, base);

  const titleError = tried ? validateTaskTitle(draft.title) : null;
  const descriptionError = validateTaskDescription(draft.description);
  const dueError = validateDueDate(draft.due_date);

  const requestClose = async () => {
    if (busy) return;
    if (dirty) {
      const discard = await confirm({
        title: "Descartar a tarefa?",
        description: "O que foi preenchido nesta tarefa será perdido.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        tone: "danger",
      });
      if (!discard) return;
    }
    onClose();
  };

  const submit = async () => {
    setTried(true);
    setError(null);
    if (validateTaskTitle(draft.title) || descriptionError || dueError) return;
    try {
      await create.mutateAsync(draftToInput(draft));
      toast.success("Tarefa criada");
      onClose();
    } catch (e) {
      setError(agencyProjectErrorMessage(e, "Não foi possível criar a tarefa."));
    }
  };

  return (
    <>
      <TaskDialogShell
        label="Nova tarefa"
        crumbs={[project.name, "Tarefas", "Nova tarefa"]}
        busy={busy}
        dirty={dirty}
        onClose={() => void requestClose()}
        footer={
          <>
            <button type="button" className="btn out" disabled={busy} onClick={() => void requestClose()}>
              Cancelar
            </button>
            <button type="submit" form="apj-task-form" className="btn" disabled={busy}>
              {busy ? "Criando…" : "Criar tarefa"}
            </button>
          </>
        }
      >
        <form
          id="apj-task-form"
          className="apj-tm"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TaskFields
            values={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            readOnly={false}
            people={people.people}
            current={[]}
            peopleLoading={people.isLoading}
            peopleFailed={people.failed}
            tagSuggestions={tagSuggestions}
            titleError={titleError}
            descriptionError={descriptionError}
            dueError={dueError}
            autoFocusTitle
            kindLabel="Tarefa"
          />
          {error ? (
            <div className="apj-err" role="alert">
              {error}
            </div>
          ) : null}
        </form>
      </TaskDialogShell>
      {dialog}
    </>
  );
}
