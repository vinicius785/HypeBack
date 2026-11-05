import { useDroppable } from "@dnd-kit/core";

import { I } from "@/components/prototype/ui";
import type { Task, TaskStatus } from "@/shared/services/agency-projects";

import { KANBAN_COLUMN_LIMIT, TASK_STATUS_LABEL, TASK_STATUS_TONE, columnView } from "../project-ui";
import { TaskCard } from "./task-card";
import { columnDropId } from "./task-logic";

interface BoardColumnProps {
  status: TaskStatus;
  /** Tarefas da coluna, já filtradas e ordenadas. */
  tasks: readonly Task[];
  /** Título das tarefas-mães (para o rótulo "Subtarefa de …" dos cartões de subtarefa). */
  titleById: ReadonlyMap<string, string>;
  today: string;
  expanded: boolean;
  /** Coluna em foco no celular (as demais ficam ocultas por CSS; no desktop todas aparecem). */
  active: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}

/** Uma coluna do quadro (um status): alvo de soltar, contador, "Adicionar tarefa", cartões e "Ver mais" acima do limite. */
export function BoardColumn({ status, tasks, titleById, today, expanded, active, canWrite, onToggle, onAdd, onOpen, onMove }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status), disabled: !canWrite });
  const view = columnView(tasks, expanded, KANBAN_COLUMN_LIMIT);
  const label = TASK_STATUS_LABEL[status];
  const headingId = `apj-col-${status}`;

  return (
    <section ref={setNodeRef} className="apj-kb-col" data-status={status} data-active={active} data-over={isOver || undefined} aria-labelledby={headingId}>
      <header className="apj-kb-h">
        <span className="apj-kb-dot" data-tone={TASK_STATUS_TONE[status]} aria-hidden="true" />
        <h3 id={headingId}>{label}</h3>
        <span className="apj-kb-n" aria-label={`${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}`}>
          {tasks.length}
        </span>
      </header>

      {canWrite ? (
        <button type="button" className="apj-kb-add" aria-label={`Adicionar tarefa em ${label}`} onClick={onAdd}>
          <I n="plus" cls="sm" />
          Adicionar tarefa
        </button>
      ) : null}

      {tasks.length === 0 ? (
        <p className="apj-kb-empty">Nenhuma tarefa</p>
      ) : (
        <ul className="apj-kb-list" role="list" aria-label={`Tarefas em ${label}`}>
          {view.visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              parentTitle={task.parent_task_id ? titleById.get(task.parent_task_id) : undefined}
              today={today}
              canWrite={canWrite}
              onOpen={() => onOpen(task)}
              onMove={(next) => onMove(task, next)}
            />
          ))}
        </ul>
      )}

      {view.hiddenCount > 0 || view.canCollapse ? (
        <button type="button" className="apj-kb-more" aria-expanded={expanded} onClick={onToggle}>
          {view.hiddenCount > 0 ? `Ver mais (${view.hiddenCount})` : "Ver menos"}
        </button>
      ) : null}
    </section>
  );
}
