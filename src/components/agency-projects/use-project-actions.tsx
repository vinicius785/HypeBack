import { toast } from "sonner";
import { Archive, ArrowUpRight, Copy, Pause, Pencil, Play, Trash2 } from "lucide-react";

import type { AdminActionMenuItem } from "@/components/admin/platform/admin-action-menu";
import { useDeleteAgencyProject, useDuplicateAgencyProject, useSetAgencyProjectStatus } from "@/hooks/use-agency-projects";
import { agencyProjectErrorMessage, type Project, type ProjectStatus } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "./project-confirm";
import { statusMenuActions } from "./project-ui";
import type { ProjectPermissions } from "./use-project-permissions";

interface Options {
  /** Depois de duplicar (a lista e o detalhe levam para a cópia, como na Plataforma VNH). */
  onDuplicated?: (copy: Project) => void;
  /** Depois de excluir (o detalhe volta para a lista). */
  onDeleted?: (project: Project) => void;
}

const STATUS_TOAST: Record<ProjectStatus, (name: string) => string> = {
  ativo: (name) => `“${name}” foi reativado`,
  pausado: (name) => `“${name}” foi pausado`,
  concluido: (name) => `“${name}” foi concluído`,
  arquivado: (name) => `“${name}” foi arquivado`,
};

/**
 * Ações de um projeto compartilhadas pela lista e pelo detalhe: pausar, reativar, arquivar (com confirmação), duplicar e
 * excluir (com confirmação e o que será apagado), cada uma com seu toast. Renderize `dialog` na página.
 */
export function useProjectActions({ onDuplicated, onDeleted }: Options = {}) {
  const { confirm, dialog } = useProjectConfirm();
  const setStatus = useSetAgencyProjectStatus();
  const duplicateProject = useDuplicateAgencyProject();
  const deleteProject = useDeleteAgencyProject();
  const busy = setStatus.isPending || duplicateProject.isPending || deleteProject.isPending;

  const changeStatus = (project: Project, status: ProjectStatus) =>
    setStatus.mutate(
      { projectId: project.id, status },
      {
        onSuccess: () => toast.success(STATUS_TOAST[status](project.name)),
        onError: (e) => toast.error(agencyProjectErrorMessage(e, "Não foi possível alterar o projeto.")),
      },
    );

  const archive = async (project: Project) => {
    const ok = await confirm({
      title: "Arquivar projeto?",
      description: `“${project.name}” sai das listas ativas, mas nada é apagado.`,
      confirmLabel: "Arquivar",
    });
    if (ok) changeStatus(project, "arquivado");
  };

  const duplicate = (project: Project) =>
    duplicateProject.mutate(project.id, {
      onSuccess: (copy) => {
        toast.success(`“${copy.name}” foi criado`);
        onDuplicated?.(copy);
      },
      onError: (e) => toast.error(agencyProjectErrorMessage(e, "Não foi possível duplicar o projeto.")),
    });

  const remove = async (project: Project) => {
    const ok = await confirm({
      title: "Excluir projeto?",
      description: `Você está prestes a excluir “${project.name}”.`,
      consequences: [
        "As tarefas, os comentários, os anexos e os documentos do projeto serão apagados.",
        "Esta ação não pode ser desfeita.",
      ],
      confirmLabel: "Excluir projeto",
      tone: "danger",
      errorFallback: "Não foi possível excluir o projeto.",
      run: () => deleteProject.mutateAsync(project.id),
    });
    if (!ok) return;
    toast.success(`“${project.name}” foi excluído`);
    onDeleted?.(project);
  };

  return {
    busy,
    dialog,
    duplicate,
    archive,
    remove,
    pause: (project: Project) => changeStatus(project, "pausado"),
    reactivate: (project: Project) => changeStatus(project, "ativo"),
  };
}

export type ProjectActions = ReturnType<typeof useProjectActions>;

const icon = (Icon: typeof Archive) => <Icon className="ico sm" aria-hidden />;

interface MenuOptions {
  project: Project;
  can: Pick<ProjectPermissions, "canCreate" | "canWrite" | "canDelete">;
  actions: ProjectActions;
  /** Desenhado no cartão da lista: "Abrir" e "Editar" ficam no menu. No detalhe, "Editar" é um botão ao lado. */
  onOpen?: () => void;
  onEdit?: () => void;
}

/**
 * Itens do menu "⋯" do projeto, com as permissões: Abrir (cartão); Editar, Pausar/Reativar e Arquivar com
 * `campaigns_write`; Duplicar com `campaigns_create`; Excluir com `campaigns_delete`. Quem não pode nada vê só "Abrir"
 * (ou nenhum menu, no detalhe).
 */
export function buildProjectMenu({ project, can, actions, onOpen, onEdit }: MenuOptions): AdminActionMenuItem[] {
  const { canPause, canReactivate, canArchive } = statusMenuActions(project.status);
  const items: AdminActionMenuItem[] = [];
  if (onOpen) items.push({ id: "open", label: "Abrir", icon: icon(ArrowUpRight), onSelect: onOpen });
  if (can.canWrite && onEdit) items.push({ id: "edit", label: "Editar", icon: icon(Pencil), onSelect: onEdit });
  if (can.canCreate) items.push({ id: "duplicate", label: "Duplicar", icon: icon(Copy), onSelect: () => actions.duplicate(project), disabled: actions.busy });
  if (can.canWrite) {
    const status: AdminActionMenuItem[] = [];
    if (canPause) status.push({ id: "pause", label: "Pausar", icon: icon(Pause), onSelect: () => actions.pause(project), disabled: actions.busy });
    if (canReactivate) status.push({ id: "reactivate", label: "Reativar", icon: icon(Play), onSelect: () => actions.reactivate(project), disabled: actions.busy });
    if (canArchive) status.push({ id: "archive", label: "Arquivar", icon: icon(Archive), onSelect: () => void actions.archive(project), disabled: actions.busy });
    // Linha fina entre "abrir/editar/duplicar" e as mudanças de status.
    if (status.length > 0 && items.length > 0) status[0] = { ...status[0], separatorBefore: true };
    items.push(...status);
  }
  if (can.canDelete) items.push({ id: "delete", label: "Excluir", icon: icon(Trash2), tone: "danger", onSelect: () => void actions.remove(project), disabled: actions.busy });
  return items;
}
