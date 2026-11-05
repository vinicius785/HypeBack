import { useWorkspacePermissions } from "@/contexts/workspace-context";

export interface ProjectPermissions {
  /** Ver projetos, tarefas e documentos (`campaigns_read`). */
  canRead: boolean;
  /** Criar e duplicar projeto (`campaigns_create`). */
  canCreate: boolean;
  /** Editar projeto, mudar status, tarefas, comentários, anexos e documentos (`campaigns_write`). */
  canWrite: boolean;
  /** Excluir projeto (`campaigns_delete`). Excluir comentário: o autor ou quem tem esta permissão. */
  canDelete: boolean;
}

/** Projetos reaproveita as permissões de campanha do workspace (nada novo): ver, criar, editar e excluir. */
export function useProjectPermissions(): ProjectPermissions {
  const p = useWorkspacePermissions();
  return {
    canRead: !!p.campaigns_read,
    canCreate: !!p.campaigns_create,
    canWrite: !!p.campaigns_write,
    canDelete: !!p.campaigns_delete,
  };
}
