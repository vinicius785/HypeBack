import { TaskModal } from "@/components/agency-projects/board";
import { useProjectPermissions } from "@/components/agency-projects/use-project-permissions";
import { useAgencyProject, useProjectTasks } from "@/hooks/use-agency-projects";

interface MyTaskModalProps {
  projectId: string;
  taskId: string;
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

/** O cartão da tarefa (o mesmo do quadro do projeto) aberto direto da Início, sem sair da página. */
export function MyTaskModal({ projectId, taskId, onOpenTask, onClose }: MyTaskModalProps) {
  const can = useProjectPermissions();
  const project = useAgencyProject(projectId).data;
  const tasks = useProjectTasks(projectId).data ?? [];
  if (!project) return null;
  return <TaskModal project={project} can={can} taskId={taskId} tasks={tasks} onOpenTask={onOpenTask} onClose={onClose} />;
}
