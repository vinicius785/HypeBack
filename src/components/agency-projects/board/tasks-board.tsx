import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useProjectTasks, useSetProjectTaskStatus } from "@/hooks/use-agency-projects";
import { TASK_STATUSES, agencyProjectErrorMessage, isAgencyProjectsUnavailable, type Project, type Task, type TaskStatus } from "@/shared/services/agency-projects";

import {
  DEFAULT_TASK_FILTERS,
  TASK_STATUS_LABEL,
  countActiveTaskFilters,
  deriveTaskAssignees,
  deriveTaskTags,
  filterTasks,
  groupTasksByStatus,
  readStoredTaskSort,
  sortTasks,
  todayInSaoPaulo,
  writeStoredTaskSort,
  type StoredTaskSort,
  type TaskFilters,
} from "../project-ui";
import type { ProjectPermissions } from "../use-project-permissions";
import { BoardColumn } from "./board-column";
import { boardCollisionDetection, columnKeyboardCoordinates } from "./board-dnd";
import { BoardToolbar } from "./board-toolbar";
import { TaskCardFace } from "./task-card";
import { TaskModal } from "./task-modal";
import { readShowSubtasks, resolveDrop, statusFromDropId, writeShowSubtasks } from "./task-logic";

import "@/styles/agency-projects.css";

type ModalState = { mode: "new"; status: TaskStatus } | { mode: "edit"; taskId: string } | null;

interface ProjectTasksBoardProps {
  project: Project;
  can: ProjectPermissions;
}

/**
 * Quadro de tarefas do projeto: Kanban de 8 colunas (uma por status; no celular, uma por vez com seletor), busca,
 * filtros com chips, ordenação guardada por projeto, "subtarefas no quadro", limite por coluna com "Ver mais", arrastar
 * com mouse, toque e teclado (e "Mover para…" no cartão) e o modal da tarefa. O título "Tarefas" é da página.
 */
export function ProjectTasksBoard({ project, can }: ProjectTasksBoardProps) {
  // Um quadro por projeto: filtros, ordenação e colunas abertas recomeçam ao trocar de projeto.
  return <Board key={project.id} project={project} can={can} />;
}

function Board({ project, can }: ProjectTasksBoardProps) {
  const { data: tasks, isLoading, error, refetch, isFetching } = useProjectTasks(project.id);
  const setStatus = useSetProjectTaskStatus(project.id);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const [sort, setSort] = useState<StoredTaskSort>(() => readStoredTaskSort(project.id));
  const [showSubtasks, setShowSubtasks] = useState(() => readShowSubtasks(project.id));
  const [expanded, setExpanded] = useState<ReadonlySet<TaskStatus>>(new Set());
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("aberto");
  const [modal, setModal] = useState<ModalState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Aviso para leitor de tela depois de mover um cartão. */
  const [live, setLive] = useState("");

  const today = todayInSaoPaulo();
  const all = useMemo(() => tasks ?? [], [tasks]);
  const titleById = useMemo(() => new Map(all.map((t) => [t.id, t.title])), [all]);
  const assigneeOptions = useMemo(() => deriveTaskAssignees(all), [all]);
  const tagOptions = useMemo(() => deriveTaskTags(all), [all]);
  const columns = useMemo(
    () => groupTasksByStatus(sortTasks(filterTasks(all, query, filters, today), sort.primary, sort.secondary), {
        includeSubtasks: showSubtasks,
        // Sem ordenação escolhida, as concluídas mais recentes ficam no alto (o limite de 4 por coluna não esconde as últimas).
        recentDoneFirst: sort.primary === "none",
      }),
    [all, query, filters, today, sort, showSubtasks],
  );
  const visibleTotal = TASK_STATUSES.reduce((sum, s) => sum + columns[s].length, 0);
  const hasCriteria = query.trim() !== "" || countActiveTaskFilters(filters) > 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Com atraso: um toque que desliza continua rolando o quadro; segurar um instante pega o cartão.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const moveTask = (task: Task, status: TaskStatus, source: "menu" | "drag") => {
    if (!can.canWrite || task.status === status) return;
    setStatus.mutate(
      { taskId: task.id, status },
      {
        onSuccess: () => {
          setLive(`Tarefa “${task.title}” movida para ${TASK_STATUS_LABEL[status]}.`);
          // Arrastar já mostra o resultado; pelo menu (principalmente no celular, com uma coluna por vez) o cartão some.
          if (source === "menu") toast.success(`Tarefa movida para ${TASK_STATUS_LABEL[status]}`);
        },
        // O hook já devolveu o cartão à coluna de origem; aqui só se explica o porquê.
        onError: (e) => toast.error(agencyProjectErrorMessage(e, "Não foi possível mover a tarefa.")),
      },
    );
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const drop = resolveDrop(all, active.id, over?.id);
    if (drop) moveTask(drop.task, drop.status, "drag");
  };

  const nameOf = (id: string | number) => `“${titleById.get(String(id)) ?? "tarefa"}”`;
  const columnName = (id: string | number | undefined) => {
    const status = statusFromDropId(id);
    return status ? TASK_STATUS_LABEL[status] : null;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou a tarefa ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => {
      const column = columnName(over?.id);
      return column ? `Tarefa ${nameOf(active.id)} sobre a coluna ${column}.` : `Tarefa ${nameOf(active.id)} fora das colunas.`;
    },
    onDragEnd: ({ active, over }) => {
      const column = columnName(over?.id);
      return column ? `Tarefa ${nameOf(active.id)} solta na coluna ${column}.` : `Tarefa ${nameOf(active.id)} solta fora das colunas; nada mudou.`;
    },
    onDragCancel: ({ active }) => `Movimento da tarefa ${nameOf(active.id)} cancelado.`,
  };

  const updateSort = (next: StoredTaskSort) => {
    setSort(next);
    writeStoredTaskSort(project.id, next);
  };
  const updateShowSubtasks = (value: boolean) => {
    setShowSubtasks(value);
    writeShowSubtasks(project.id, value);
  };
  const clearAll = () => {
    setQuery("");
    setFilters(DEFAULT_TASK_FILTERS);
  };

  if (isLoading && !tasks) {
    return (
      <div className="apj-kb-sk" aria-busy="true" aria-label="Carregando tarefas">
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className="apj-sk" />
        ))}
      </div>
    );
  }

  if (error && !tasks) {
    const unavailable = isAgencyProjectsUnavailable(error);
    return (
      <div className="ov-empty" role="alert">
        <span>
          <I n={unavailable ? "clock" : "x"} />
        </span>
        <b>{unavailable ? "Tarefas ainda não estão disponíveis" : "Erro ao carregar as tarefas"}</b>
        <small>{unavailable ? "Esta função chega ao seu workspace em breve." : error instanceof Error ? error.message : "Tente novamente."}</small>
        {unavailable ? null : (
          <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        )}
      </div>
    );
  }

  const modalNode = modal ? (
    <TaskModal
      key={modal.mode === "edit" ? modal.taskId : "new"}
      project={project}
      can={can}
      taskId={modal.mode === "edit" ? modal.taskId : null}
      defaultStatus={modal.mode === "new" ? modal.status : undefined}
      tasks={all}
      onOpenTask={(taskId) => setModal({ mode: "edit", taskId })}
      onClose={() => setModal(null)}
    />
  ) : null;

  const activeTask = activeId ? all.find((t) => t.id === activeId) : undefined;

  return (
    <div className="apj-kb">
      <BoardToolbar
        query={query}
        onQuery={setQuery}
        filters={filters}
        onFilters={setFilters}
        assignees={assigneeOptions}
        tags={tagOptions}
        sort={sort}
        onSort={updateSort}
        showSubtasks={showSubtasks}
        onShowSubtasks={updateShowSubtasks}
        canWrite={can.canWrite}
        onNewTask={() => setModal({ mode: "new", status: "aberto" })}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>

      {hasCriteria && visibleTotal === 0 ? (
        <div className="ov-empty">
          <span>
            <I n="search" />
          </span>
          <b>Nenhuma tarefa encontrada</b>
          <small>Nenhuma tarefa combina com a busca e os filtros.</small>
          <button type="button" className="btn out" onClick={clearAll}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <label className="apj-kb-pick">
            <span className="sr-only">Coluna do quadro</span>
            <select aria-label="Coluna do quadro" value={mobileStatus} onChange={(e) => setMobileStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]} ({columns[s].length})
                </option>
              ))}
            </select>
          </label>

          <DndContext
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  "Para mover a tarefa de coluna, pressione Espaço, use as setas para a esquerda e para a direita e solte com Espaço. Esc cancela. O menu Mais ações do cartão também move a tarefa.",
              },
            }}
          >
            <div className="apj-kb-scroll" role="region" aria-label="Quadro de tarefas" tabIndex={0}>
              <div className="apj-kb-cols">
                {TASK_STATUSES.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    tasks={columns[status]}
                    titleById={titleById}
                    today={today}
                    expanded={expanded.has(status)}
                    active={mobileStatus === status}
                    canWrite={can.canWrite}
                    onToggle={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(status)) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                    onAdd={() => setModal({ mode: "new", status })}
                    onOpen={(task) => setModal({ mode: "edit", taskId: task.id })}
                    onMove={(task, next) => moveTask(task, next, "menu")}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="apj-tk apj-tk-overlay" aria-hidden="true">
                  <TaskCardFace task={activeTask} parentTitle={activeTask.parent_task_id ? titleById.get(activeTask.parent_task_id) : undefined} today={today} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {modalNode}
    </div>
  );
}
