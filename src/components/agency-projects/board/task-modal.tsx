import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminDialog } from "@/components/admin/platform/admin-dialog";
import { useAuth } from "@/contexts/auth-context";
import {
  useAddTaskComment,
  useCreateProjectTask,
  useDeleteProjectTask,
  useDeleteTaskAttachment,
  useDeleteTaskComment,
  useProjectTask,
  useUpdateProjectTask,
  useUploadTaskAttachment,
} from "@/hooks/use-agency-projects";
import {
  agencyProjectErrorMessage,
  isAgencyProjectNotFound,
  type Project,
  type Task,
  type TaskDetail,
  type TaskStatus,
  type TaskUpdateInput,
} from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { deriveTaskTags } from "../project-ui";
import type { ProjectPermissions } from "../use-project-permissions";
import { AttachmentsSection } from "./task-attachments";
import { TaskCreator } from "./task-creator";
import { TaskDialogShell } from "./task-dialog";
import { TaskFields, type FieldFeedback, type FieldKey } from "./task-fields";
import { SubtasksSection } from "./task-subtasks";
import { ActivitySection, CommentsSection } from "./task-comments";
import {
  canRemoveComment,
  draftFromTask,
  isPlausibleDueDate,
  validateTaskDescription,
  validateTaskTitle,
  type TaskDraft,
} from "./task-logic";
import { useWorkspacePeople, type PersonOption } from "./use-workspace-people";

import "@/styles/agency-projects.css";

export interface TaskModalProps {
  project: Project;
  can: ProjectPermissions;
  /** `null` = criar uma tarefa nova. */
  taskId: string | null;
  /** Status inicial de uma tarefa nova (a coluna onde se clicou em "Adicionar tarefa"). */
  defaultStatus?: TaskStatus;
  /** Tarefas do quadro: o modal mostra a da lista enquanto o detalhe carrega, e sugere as etiquetas já usadas. */
  tasks: readonly Task[];
  /** Abrir outra tarefa (uma subtarefa, ou a tarefa-mãe). */
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

/**
 * Modal da tarefa. Sem `taskId` é o formulário de criação (grava tudo de uma vez); com `taskId` é a edição, que salva
 * campo a campo com aviso ("Salvando…", "Salvo" ou o erro) e traz subtarefas, anexos, comentários e atividade.
 * Sem `campaigns_write` tudo é somente leitura. Foco preso, Esc, `aria-modal` e "gravando bloqueia fechar" vêm do `AdminDialog`.
 */
export function TaskModal(props: TaskModalProps) {
  return props.taskId ? <TaskEditor {...props} taskId={props.taskId} /> : <TaskCreator {...props} />;
}

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------

function TaskEditor(props: TaskModalProps & { taskId: string }) {
  const { project, taskId, tasks, onClose } = props;
  const query = useProjectTask(project.id, taskId);
  const detail = query.data;
  const task: Task | undefined = detail ?? tasks.find((t) => t.id === taskId);

  if (!task) {
    const notFound = isAgencyProjectNotFound(query.error);
    return (
      <AdminDialog
        open
        title="Tarefa"
        size="lg"
        onClose={onClose}
        footer={
          <>
            {query.error && !notFound ? (
              <button type="button" className="btn out" disabled={query.isFetching} onClick={() => void query.refetch()}>
                Tentar de novo
              </button>
            ) : null}
            <button type="button" className="btn" onClick={onClose}>
              Fechar
            </button>
          </>
        }
      >
        {query.error ? (
          <div className="apj-err" role="alert">
            {notFound ? agencyProjectErrorMessage(query.error, "Essa tarefa não existe mais.") : agencyProjectErrorMessage(query.error, "Não foi possível carregar a tarefa.")}
          </div>
        ) : (
          <span className="apj-sk apj-tm-sk" aria-busy="true" aria-label="Carregando tarefa" />
        )}
      </AdminDialog>
    );
  }

  // A tarefa da lista basta para os campos; o que falta (subtarefas, anexos, comentários, atividade) vem do detalhe, que pode falhar.
  const detailProblem =
    detail || !query.error
      ? null
      : {
          notFound: isAgencyProjectNotFound(query.error),
          retrying: query.isFetching,
          retry: () => void query.refetch(),
        };
  return <TaskEditorBody {...props} task={task} detail={detail} detailProblem={detailProblem} />;
}

interface DetailProblem {
  notFound: boolean;
  retrying: boolean;
  retry: () => void;
}

function TaskEditorBody({
  project,
  can,
  task,
  detail,
  detailProblem,
  tasks,
  onOpenTask,
  onClose,
}: TaskModalProps & {
  task: Task;
  detail: TaskDetail | undefined;
  detailProblem: DetailProblem | null;
}) {
  const { user } = useAuth();
  const update = useUpdateProjectTask(project.id);
  const removeTask = useDeleteProjectTask(project.id);
  const createSubtask = useCreateProjectTask(project.id);
  const addComment = useAddTaskComment(project.id);
  const removeComment = useDeleteTaskComment(project.id);
  const upload = useUploadTaskAttachment(project.id);
  const removeAttachment = useDeleteTaskAttachment(project.id);
  const people = useWorkspacePeople({ enabled: can.canWrite });
  const { confirm, dialog } = useProjectConfirm();

  const readOnly = !can.canWrite;
  const busy =
    update.isPending || removeTask.isPending || createSubtask.isPending || addComment.isPending || removeComment.isPending || upload.isPending || removeAttachment.isPending;

  // Rascunhos de texto (gravam ao sair do campo) e valores já escolhidos que a resposta da API ainda não confirmou.
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Partial<TaskDraft>>({});
  const [feedback, setFeedback] = useState<Partial<Record<FieldKey, FieldFeedback>>>({});
  const [textErrors, setTextErrors] = useState<{
    title?: string;
    description?: string;
  }>({});
  const timers = useRef<Partial<Record<FieldKey, number>>>({});
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((t) => window.clearTimeout(t));
  }, []);

  const server = draftFromTask(task);
  const values: TaskDraft = {
    ...server,
    ...optimistic,
    title: titleDraft ?? server.title,
    description: descriptionDraft ?? server.description,
    due_date: dueDraft ?? optimistic.due_date ?? server.due_date,
  };
  const tagSuggestions = useMemo(() => deriveTaskTags(tasks), [tasks]);
  const current: PersonOption[] = task.assignees.map((a) => ({
    id: a.user_id,
    name: a.name,
    avatar: a.avatar,
  }));

  const save = async (field: FieldKey, patch: Partial<TaskDraft>, input: TaskUpdateInput): Promise<boolean> => {
    window.clearTimeout(timers.current[field]);
    setOptimistic((o) => ({ ...o, ...patch }));
    setFeedback((f) => ({ ...f, [field]: { state: "saving" } }));
    try {
      await update.mutateAsync({ taskId: task.id, input });
      setFeedback((f) => ({ ...f, [field]: { state: "saved" } }));
      timers.current[field] = window.setTimeout(
        () =>
          setFeedback((f) => {
            const next = { ...f };
            delete next[field];
            return next;
          }),
        2500,
      );
      return true;
    } catch (e) {
      setFeedback((f) => ({
        ...f,
        [field]: {
          state: "error",
          message: agencyProjectErrorMessage(e, "Não foi possível salvar."),
        },
      }));
      return false;
    } finally {
      setOptimistic((o) => {
        const next = { ...o };
        for (const key of Object.keys(patch)) delete next[key as keyof TaskDraft];
        return next;
      });
    }
  };

  const onChange = (patch: Partial<TaskDraft>) => {
    if ("title" in patch) {
      setTitleDraft(patch.title ?? "");
      setTextErrors((e) => ({ ...e, title: undefined }));
    } else if ("description" in patch) {
      setDescriptionDraft(patch.description ?? "");
      setTextErrors((e) => ({ ...e, description: undefined }));
    } else if ("due_date" in patch) {
      const due = patch.due_date ?? "";
      setDueDraft(due);
      // O campo de data dispara a cada dígito do ano: só grava quando a data está completa e plausível (ou foi apagada).
      if (due === "" || isPlausibleDueDate(due)) void save("due_date", { due_date: due }, { due_date: due || null }).then(() => setDueDraft(null));
    } else if ("status" in patch) void save("status", patch, { status: patch.status });
    else if ("priority" in patch) void save("priority", patch, { priority: patch.priority });
    else if ("tags" in patch) void save("tags", patch, { tags: patch.tags });
    else if ("assignee_ids" in patch)
      void save("assignees", patch, {
        assignee_ids: patch.assignee_ids,
        primary_assignee_id: patch.primary_assignee_id ?? null,
      });
  };

  /** Grava o texto digitado ao sair do campo. `true` quando não há nada pendente (ou gravou). */
  const commitText = async (field: "title" | "description"): Promise<boolean> => {
    const draft = field === "title" ? titleDraft : descriptionDraft;
    if (draft === null) return true;
    const problem = field === "title" ? validateTaskTitle(draft) : validateTaskDescription(draft);
    if (problem) {
      setTextErrors((e) => ({ ...e, [field]: problem }));
      return false;
    }
    const next = draft.trim();
    const unchanged = field === "title" ? next === task.title : next === (task.description ?? "");
    const clear = () => (field === "title" ? setTitleDraft(null) : setDescriptionDraft(null));
    if (unchanged) {
      clear();
      return true;
    }
    const ok = await save(field, {}, field === "title" ? { title: next } : { description: next === "" ? null : next });
    if (ok) clear();
    return ok;
  };

  const textPending = titleDraft !== null || descriptionDraft !== null;
  const stuck = !!textErrors.title || !!textErrors.description || feedback.title?.state === "error" || feedback.description?.state === "error";

  const handleClose = async () => {
    if (busy) return;
    // Texto com erro (título vazio, falha de rede): um segundo pedido de fechar descarta, em vez de prender a pessoa aqui.
    if (!stuck) {
      const saved = await Promise.all([commitText("title"), commitText("description")]);
      if (!saved.every(Boolean)) return;
    }
    onClose();
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: "Excluir tarefa?",
      description: `“${task.title}” será apagada.`,
      consequences: ["As subtarefas, os comentários e os anexos da tarefa também serão apagados.", "Esta ação não pode ser desfeita."],
      confirmLabel: "Excluir tarefa",
      tone: "danger",
      errorFallback: "Não foi possível excluir a tarefa.",
      run: () => removeTask.mutateAsync(task.id),
    });
    if (ok) {
      toast.success("Tarefa excluída");
      onClose();
    }
  };

  const parentTitle = task.parent_task_id ? tasks.find((t) => t.id === task.parent_task_id)?.title : undefined;
  const [activityOpen, setActivityOpen] = useState(true);
  const [composerHost, setComposerHost] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<"all" | "comments" | "history">("all");
  const feedbackStates = Object.values(feedback);
  const failed = feedbackStates.find((f) => f?.state === "error");
  const status = failed ? (
    <span key="err" className="error">Não foi possível salvar</span>
  ) : feedbackStates.some((f) => f?.state === "saving") || textPending ? (
    <span key="saving" role="status">{textPending && !feedbackStates.some((f) => f?.state === "saving") ? "Alterações pendentes" : "Salvando…"}</span>
  ) : (
    <span key="saved" className="saved" role="status">
      Salvo ✓
    </span>
  );

  const kindLabel = task.parent_task_id ? (
    <>
      Subtarefa de{" "}
      <button type="button" className="apj-link" onClick={() => onOpenTask(task.parent_task_id as string)}>
        {parentTitle ?? "tarefa-mãe"}
      </button>
    </>
  ) : (
    "Tarefa"
  );

  const crumbs = [
    project.name,
    "Tarefas",
    ...(task.parent_task_id ? [parentTitle ?? "Tarefa-mãe"] : []),
    values.title.trim() || "Sem título",
  ];

  return (
    <>
      <TaskDialogShell
        label={task.parent_task_id ? "Subtarefa" : "Tarefa"}
        crumbs={crumbs}
        status={status}
        busy={busy}
        dirty={textPending}
        onClose={() => void handleClose()}
        menu={can.canWrite ? [{ id: "delete", label: "Excluir tarefa", icon: "trash", tone: "danger", disabled: busy, onSelect: () => void confirmDelete() }] : undefined}
        activity={
          detailProblem
            ? undefined
            : {
                count: (detail?.comments.length ?? 0) + (detail?.events.length ?? 0) || undefined,
                open: activityOpen,
                onToggle: () => setActivityOpen((v) => !v),
                panel: (
                  <>
                    <div className="apj-td-tabs" role="tablist" aria-label="Filtrar atividade">
                      {(
                        [
                          ["all", "Tudo"],
                          ["comments", "Comentários"],
                          ["history", "Histórico"],
                        ] as const
                      ).map(([key, text]) => (
                        <button key={key} type="button" role="tab" aria-selected={tab === key} data-on={tab === key || undefined} onClick={() => setTab(key)}>
                          {text}
                        </button>
                      ))}
                    </div>
                    <div className="apj-td-feed">
                      {tab === "history" ? null : (
                        <CommentsSection
                          comments={detail?.comments}
                          canWrite={can.canWrite}
                          canRemove={(comment) => canRemoveComment(comment, user?.id, can)}
                          onAdd={(body) => addComment.mutateAsync({ taskId: task.id, body })}
                          onRemove={(comment) => removeComment.mutateAsync({ taskId: task.id, commentId: comment.id })}
                          composerHost={composerHost}
                        />
                      )}
                      {tab === "comments" ? null : <ActivitySection events={detail?.events} />}
                    </div>
                    <div className="apj-td-compose" ref={setComposerHost} />
                  </>
                ),
              }
        }
      >
        <div className="apj-tm">
          {readOnly ? <p className="apj-tm-ro">Você pode ver esta tarefa, mas não editá-la.</p> : null}
          <TaskFields
            values={values}
            onChange={onChange}
            onTextBlur={(field) => void commitText(field)}
            readOnly={readOnly}
            people={people.people}
            current={current}
            peopleLoading={people.isLoading}
            peopleFailed={people.failed}
            tagSuggestions={tagSuggestions}
            titleError={textErrors.title}
            descriptionError={textErrors.description}
            feedback={feedback}
            kindLabel={kindLabel}
          />

          {detailProblem ? (
            <div className="apj-err" role="alert">
              {detailProblem.notFound ? "Essa tarefa não existe mais." : "Não foi possível carregar as subtarefas, os anexos, os comentários e a atividade."}
              {detailProblem.notFound ? null : (
                <>
                  {" "}
                  <button type="button" className="apj-link" disabled={detailProblem.retrying} onClick={detailProblem.retry}>
                    Tentar de novo
                  </button>
                </>
              )}
            </div>
          ) : null}

          {!task.parent_task_id && !detailProblem ? (
            <SubtasksSection
              subtasks={detail?.subtasks}
              canWrite={can.canWrite}
              onAdd={(input) => createSubtask.mutateAsync({ ...input, parent_task_id: task.id })}
              people={people.people}
              peopleLoading={people.isLoading}
              peopleFailed={people.failed}
              onToggle={(subtask, done) => update.mutateAsync({ taskId: subtask.id, input: { status: done ? "concluido" : "aberto" } })}
              onRemove={(subtask) => removeTask.mutateAsync(subtask.id)}
              onOpen={onOpenTask}
            />
          ) : null}

          {detailProblem ? null : (
            <AttachmentsSection
              attachments={detail?.attachments}
              canWrite={can.canWrite}
              onUpload={(file) => upload.mutateAsync({ taskId: task.id, file })}
              onRemove={(attachment) => removeAttachment.mutateAsync({ taskId: task.id, attachmentId: attachment.id })}
            />
          )}
        </div>
      </TaskDialogShell>
      {dialog}
    </>
  );
}
