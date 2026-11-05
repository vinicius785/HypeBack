import type { CSSProperties, KeyboardEventHandler, ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ChevronRight, GripVertical } from "lucide-react";

import { AdminActionMenu, type AdminActionMenuItem } from "@/components/admin/platform/admin-action-menu";
import { Av, I } from "@/components/prototype/ui";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/shared/services/agency-projects";

import { tagColor } from "./task-menus";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, subtaskProgress, taskDueLabel } from "../project-ui";

const MAX_TAGS = 3;
const MAX_AVATARS = 3;

/** Itens do "⋯" do cartão: abrir e, com edição, "Mover para <status>" (a alternativa ao arrastar, pelo teclado e no celular). */
export function buildTaskMenu(task: Task, canWrite: boolean, actions: { onOpen: () => void; onMove: (status: TaskStatus) => void }): AdminActionMenuItem[] {
  const items: AdminActionMenuItem[] = [{ id: "open", label: "Abrir tarefa", icon: "external", onSelect: actions.onOpen }];
  if (!canWrite) return items;
  TASK_STATUSES.filter((s) => s !== task.status).forEach((status, index) =>
    items.push({ id: `move-${status}`, label: `Mover para ${TASK_STATUS_LABEL[status]}`, separatorBefore: index === 0, onSelect: () => actions.onMove(status) }),
  );
  return items;
}

interface CardFaceProps {
  task: Task;
  /** Título da tarefa-mãe quando o cartão é uma subtarefa (exibida no quadro). */
  parentTitle?: string;
  today: string;
  /** Alça de arrastar e menu (ausentes no clone que segue o ponteiro). */
  handle?: ReactNode;
  menu?: ReactNode;
  onOpen?: () => void;
}

/** O desenho do cartão (a mesma coisa parada na coluna e flutuando durante o arrasto). */
export function TaskCardFace({ task, parentTitle, today, handle, menu, onOpen }: CardFaceProps) {
  const due = taskDueLabel(task, today);
  const progress = subtaskProgress(task);
  const people = [...task.assignees].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const peopleNames = people.map((a) => (a.is_primary && people.length > 1 ? `${a.name} (principal)` : a.name)).join(", ");
  const extraTags = task.tags.length - MAX_TAGS;

  return (
    <div className="apj-tk-in">
      {handle || menu ? (
        <div className="apj-tk-ctl">
          {handle}
          {menu ? <span className="apj-tk-menu">{menu}</span> : null}
        </div>
      ) : null}

      {onOpen ? (
        <button type="button" className="apj-tk-open" onClick={onOpen}>
          {task.title}
        </button>
      ) : (
        <b className="apj-tk-open">{task.title}</b>
      )}
      {task.parent_task_id ? <small className="apj-tk-parent">Subtarefa{parentTitle ? ` de ${parentTitle}` : ""}</small> : null}

      {progress ? (
        <span className="apj-tk-sub">
          <ChevronRight className="ico sm" aria-hidden />
          <span className="sr-only">Subtarefas concluídas: </span>
          {progress} subtarefas
        </span>
      ) : null}

      <div className="apj-tk-meta">
        {people.length > 0 ? (
          <span className="apj-tk-people" role="group" aria-label={`Responsáveis: ${peopleNames}`} title={peopleNames}>
            {people.slice(0, MAX_AVATARS).map((a) => (
              <Av key={a.user_id} name={a.name} src={a.avatar ?? undefined} size={20} />
            ))}
            {people.length > MAX_AVATARS ? <em>+{people.length - MAX_AVATARS}</em> : null}
          </span>
        ) : null}
        {due.text ? (
          <span className={`apj-tk-due${due.overdue ? " apj-is-late" : ""}`}>
            <i className="apj-tk-dot" aria-hidden="true" />
            <span className="sr-only">Prazo: </span>
            {due.text}
          </span>
        ) : null}
        {task.priority !== "normal" ? (
          <span className="apj-tk-pri" data-priority={task.priority}>
            <I n="flag" cls="sm" />
            {TASK_PRIORITY_LABEL[task.priority]}
          </span>
        ) : null}
        {task.counts.comments > 0 ? (
          <span>
            <I n="msg" cls="sm" />
            <span className="sr-only">Comentários: </span>
            {task.counts.comments}
          </span>
        ) : null}
        {task.counts.attachments > 0 ? (
          <span>
            <I n="paperclip" cls="sm" />
            <span className="sr-only">Anexos: </span>
            {task.counts.attachments}
          </span>
        ) : null}
      </div>

      {task.tags.length > 0 ? (
        <div className="apj-tk-tags">
          <I n="tag" cls="sm" />
          {task.tags.slice(0, MAX_TAGS).map((tag) => (
            <span key={tag} className="apj-tk-tag" title={tag} style={tagColor(tag) as CSSProperties}>
              {tag}
            </span>
          ))}
          {extraTags > 0 ? (
            <span className="apj-tk-tag more" title={task.tags.slice(MAX_TAGS).join(", ")}>
              +{extraTags}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  parentTitle?: string;
  today: string;
  canWrite: boolean;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
}

/**
 * Cartão de tarefa do quadro. Arrastar: o mouse e o toque começam em qualquer ponto do cartão (toque com um pequeno
 * atraso, para a rolagem do quadro continuar funcionando) e o teclado, na alça (Espaço pega, setas trocam de coluna).
 * "Mover para…" no menu "⋯" faz o mesmo sem arrastar. Sem permissão de edição o cartão só abre.
 */
export function TaskCard({ task, parentTitle, today, canWrite, onOpen, onMove }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canWrite });
  // O teclado fica só na alça: Enter/Espaço num botão de dentro do cartão não pode pegar o cartão.
  const { onKeyDown, ...pointer } = listeners ?? {};
  const menu = buildTaskMenu(task, canWrite, { onOpen, onMove });

  return (
    <li ref={setNodeRef} className="apj-tk" data-task-id={task.id} data-dragging={isDragging || undefined} {...pointer}>
      <TaskCardFace
        task={task}
        parentTitle={parentTitle}
        today={today}
        onOpen={onOpen}
        handle={
          canWrite ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="apj-tk-grip"
              {...attributes}
              onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
              aria-label={`Arrastar a tarefa ${task.title}`}
              title="Arrastar para outra coluna"
            >
              <GripVertical className="ico sm" aria-hidden />
            </button>
          ) : null
        }
        menu={
          // O menu não começa arrasto (o clique nele também sobe pela árvore do React, mesmo vindo do portal).
          <span onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <AdminActionMenu items={menu} iconOnly variant="ghost" ariaLabel={`Mais ações da tarefa ${task.title}`} />
          </span>
        }
      />
    </li>
  );
}
