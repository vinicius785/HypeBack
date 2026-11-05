/**
 * Dados de Projetos da agência (TanStack Query). As chaves levam o workspace (`withWorkspaceKey`), então trocar de
 * workspace nunca mostra o cache do outro, e só buscam em workspace de agência.
 *
 * API para as telas (a lista e o cabeçalho do detalhe usam os de projeto; o Kanban, o modal da tarefa e os documentos
 * usam os de tarefa e documento — todos já invalidam o que mudou, a tela não precisa invalidar nada):
 *
 * Leitura
 *   useAgencyProjects()                      -> Project[] (todos do workspace; busca/filtro/ordem são do cliente)
 *   useAgencyProject(projectId)              -> Project (usa o item da lista como placeholder enquanto busca)
 *   useProjectTasks(projectId)               -> Task[] plana: 1º nível e subtarefas (`parent_task_id`); sem comentários/anexos
 *   useProjectTask(projectId, taskId)        -> TaskDetail (comentários, anexos, atividade, subtarefas); `taskId` nulo = desligado
 *   useProjectDocuments(projectId)           -> ProjectDocument[] (fixados primeiro)
 *   Cada um devolve o `useQuery`; `isAgencyProjectsUnavailable(error)` (do serviço) diz "API sem a rota" e
 *   `isAgencyProjectNotFound(error)` diz "projeto/tarefa inexistente ou de outro workspace".
 *
 * Projetos (mutations; `mutate`/`mutateAsync` recebem o objeto indicado)
 *   useCreateAgencyProject()                 ProjectInput
 *   useUpdateAgencyProject()                 { projectId, input: ProjectUpdateInput }
 *   useSetAgencyProjectStatus()              { projectId, status }
 *   useDuplicateAgencyProject()              projectId
 *   useDeleteAgencyProject()                 projectId
 *   useUploadAgencyProjectCover()            File -> { url }
 *
 * Tarefas (o `projectId` entra na criação do hook)
 *   useCreateProjectTask(projectId)          TaskInput
 *   useUpdateProjectTask(projectId)          { taskId, input: TaskUpdateInput }
 *   useSetProjectTaskStatus(projectId)       { taskId, status }   <- atualização otimista no Kanban, com reversão em erro
 *   useDeleteProjectTask(projectId)          taskId
 *   useAddTaskComment(projectId)             { taskId, body }
 *   useDeleteTaskComment(projectId)          { taskId, commentId }
 *   useUploadTaskAttachment(projectId)       { taskId, file }
 *   useDeleteTaskAttachment(projectId)       { taskId, attachmentId }
 *
 * Documentos
 *   useCreateProjectDocument(projectId)      ProjectDocumentInput
 *   useUpdateProjectDocument(projectId)      { documentId, input: ProjectDocumentUpdateInput }
 *   useDeleteProjectDocument(projectId)      documentId
 *
 * Mensagem de erro para toast: `agencyProjectErrorMessage(error, "texto padrão")` (serviço).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import { shouldRetryQuery } from "@/lib/workspace-state/query-client";
import {
  createAgencyProject,
  createProjectDocument,
  createProjectTask,
  createTaskComment,
  deleteAgencyProject,
  deleteProjectDocument,
  deleteProjectTask,
  deleteTaskAttachment,
  deleteTaskComment,
  duplicateAgencyProject,
  getAgencyProject,
  getProjectTask,
  isAgencyProjectNotFound,
  isAgencyProjectsUnavailable,
  listAgencyProjects,
  listProjectDocuments,
  listProjectTasks,
  updateAgencyProject,
  updateProjectDocument,
  updateProjectTask,
  uploadAgencyProjectCover,
  uploadTaskAttachment,
  type Project,
  type ProjectDocument,
  type ProjectDocumentInput,
  type ProjectDocumentUpdateInput,
  type ProjectInput,
  type ProjectStatus,
  type ProjectUpdateInput,
  type Task,
  type TaskDetail,
  type TaskInput,
  type TaskStatus,
  type TaskUpdateInput,
} from "@/shared/services/agency-projects";

export const AGENCY_PROJECTS_ROOT = "agency-projects";

export const agencyProjectKeys = {
  list: (ws: string | undefined) => withWorkspaceKey([AGENCY_PROJECTS_ROOT, "list"], ws),
  detail: (projectId: string, ws: string | undefined) => withWorkspaceKey([AGENCY_PROJECTS_ROOT, "detail", projectId], ws),
  tasks: (projectId: string, ws: string | undefined) => withWorkspaceKey([AGENCY_PROJECTS_ROOT, "tasks", projectId], ws),
  task: (projectId: string, taskId: string, ws: string | undefined) =>
    withWorkspaceKey([AGENCY_PROJECTS_ROOT, "task", projectId, taskId], ws),
  documents: (projectId: string, ws: string | undefined) => withWorkspaceKey([AGENCY_PROJECTS_ROOT, "documents", projectId], ws),
};

/** Sem nova tentativa quando a rota não existe ou o registro não existe (a resposta seria a mesma). */
function retryProjectQuery(failureCount: number, error: unknown): boolean {
  if (isAgencyProjectsUnavailable(error) || isAgencyProjectNotFound(error)) return false;
  return shouldRetryQuery(failureCount, error);
}

function useProjectsEnabled(options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceQueryKey();
  const isAgency = useIsAgencyWorkspace();
  return { workspaceId, enabled: options?.enabled !== false && isAgency && !!workspaceId };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export function useAgencyProjects(options?: { enabled?: boolean }) {
  const { workspaceId, enabled } = useProjectsEnabled(options);
  return useQuery({
    queryKey: agencyProjectKeys.list(workspaceId),
    queryFn: listAgencyProjects,
    enabled,
    retry: retryProjectQuery,
  });
}

export function useAgencyProject(projectId: string | undefined, options?: { enabled?: boolean }) {
  const { workspaceId, enabled } = useProjectsEnabled(options);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: agencyProjectKeys.detail(projectId ?? "", workspaceId),
    queryFn: () => getAgencyProject(projectId as string),
    enabled: enabled && !!projectId,
    retry: retryProjectQuery,
    // Vindo da lista, o cabeçalho aparece de imediato enquanto o detalhe atualiza.
    placeholderData: () =>
      queryClient.getQueryData<Project[]>(agencyProjectKeys.list(workspaceId))?.find((p) => p.id === projectId),
  });
}

export function useProjectTasks(projectId: string | undefined, options?: { enabled?: boolean }) {
  const { workspaceId, enabled } = useProjectsEnabled(options);
  return useQuery({
    queryKey: agencyProjectKeys.tasks(projectId ?? "", workspaceId),
    queryFn: () => listProjectTasks(projectId as string),
    enabled: enabled && !!projectId,
    retry: retryProjectQuery,
  });
}

export function useProjectTask(projectId: string | undefined, taskId: string | null | undefined, options?: { enabled?: boolean }) {
  const { workspaceId, enabled } = useProjectsEnabled(options);
  return useQuery({
    queryKey: agencyProjectKeys.task(projectId ?? "", taskId ?? "", workspaceId),
    queryFn: () => getProjectTask(projectId as string, taskId as string),
    enabled: enabled && !!projectId && !!taskId,
    retry: retryProjectQuery,
  });
}

export function useProjectDocuments(projectId: string | undefined, options?: { enabled?: boolean }) {
  const { workspaceId, enabled } = useProjectsEnabled(options);
  return useQuery({
    queryKey: agencyProjectKeys.documents(projectId ?? "", workspaceId),
    queryFn: () => listProjectDocuments(projectId as string),
    enabled: enabled && !!projectId,
    retry: retryProjectQuery,
  });
}

// ---------------------------------------------------------------------------
// Invalidação
// ---------------------------------------------------------------------------

/** Troca o projeto na lista em cache e no detalhe (a resposta da API já traz estatísticas e saúde recalculadas). */
function putProject(queryClient: QueryClient, workspaceId: string | undefined, project: Project) {
  queryClient.setQueryData<Project[]>(agencyProjectKeys.list(workspaceId), (old) =>
    old ? old.map((p) => (p.id === project.id ? project : p)) : old,
  );
  queryClient.setQueryData<Project>(agencyProjectKeys.detail(project.id, workspaceId), project);
}

function invalidateProjectList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [AGENCY_PROJECTS_ROOT, "list"] });
}

/** O projeto (cartão da lista e cabeçalho) leva estatísticas das tarefas: toda mudança de tarefa as atualiza. */
function invalidateProjectSummary(queryClient: QueryClient, projectId: string) {
  void invalidateProjectList(queryClient);
  void queryClient.invalidateQueries({ queryKey: [AGENCY_PROJECTS_ROOT, "detail", projectId] });
}

function invalidateTaskData(queryClient: QueryClient, projectId: string, taskId?: string) {
  void queryClient.invalidateQueries({ queryKey: [AGENCY_PROJECTS_ROOT, "tasks", projectId] });
  // Sem `taskId` (criação, que pode ser subtarefa): todos os detalhes do projeto em cache (contadores do pai).
  void queryClient.invalidateQueries({
    queryKey: taskId ? [AGENCY_PROJECTS_ROOT, "task", projectId, taskId] : [AGENCY_PROJECTS_ROOT, "task", projectId],
  });
  invalidateProjectSummary(queryClient, projectId);
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

export function useCreateAgencyProject() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: (input: ProjectInput) => createAgencyProject(input),
    onSuccess: (project) => {
      queryClient.setQueryData<Project>(agencyProjectKeys.detail(project.id, workspaceId), project);
      void invalidateProjectList(queryClient);
    },
  });
}

export function useUpdateAgencyProject() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: ProjectUpdateInput }) => updateAgencyProject(projectId, input),
    onSuccess: (project) => {
      putProject(queryClient, workspaceId, project);
      invalidateProjectSummary(queryClient, project.id);
    },
  });
}

export function useSetAgencyProjectStatus() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: ProjectStatus }) => updateAgencyProject(projectId, { status }),
    onSuccess: (project) => {
      putProject(queryClient, workspaceId, project);
      invalidateProjectSummary(queryClient, project.id);
    },
  });
}

export function useDuplicateAgencyProject() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: (projectId: string) => duplicateAgencyProject(projectId),
    onSuccess: (project) => {
      queryClient.setQueryData<Project>(agencyProjectKeys.detail(project.id, workspaceId), project);
      void invalidateProjectList(queryClient);
    },
  });
}

export function useDeleteAgencyProject() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: (projectId: string) => deleteAgencyProject(projectId),
    onSuccess: (_data, projectId) => {
      queryClient.setQueryData<Project[]>(agencyProjectKeys.list(workspaceId), (old) => old?.filter((p) => p.id !== projectId));
      // Tarefas e documentos foram apagados em cascata: nada deles pode sobrar em cache.
      for (const kind of ["detail", "tasks", "task", "documents"]) {
        queryClient.removeQueries({ queryKey: [AGENCY_PROJECTS_ROOT, kind, projectId] });
      }
      void invalidateProjectList(queryClient);
    },
  });
}

export function useUploadAgencyProjectCover() {
  return useMutation({ mutationFn: (file: File) => uploadAgencyProjectCover(file) });
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export function useCreateProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => createProjectTask(projectId, input),
    onSuccess: () => invalidateTaskData(queryClient, projectId),
  });
}

export function useUpdateProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TaskUpdateInput }) => updateProjectTask(projectId, taskId, input),
    onSuccess: (task, { taskId }) => {
      // A resposta já é a tarefa gravada: o modal e o quadro mostram o valor novo na hora, sem esperar o recarregamento
      // (o detalhe guarda comentários, anexos e atividade, que a resposta não traz: só os campos da tarefa são trocados).
      queryClient.setQueryData<TaskDetail>(agencyProjectKeys.task(projectId, taskId, workspaceId), (old) => (old ? { ...old, ...task } : old));
      queryClient.setQueryData<Task[]>(agencyProjectKeys.tasks(projectId, workspaceId), (old) => old?.map((t) => (t.id === task.id ? task : t)));
      // A subtarefa muda o contador do pai (subtarefas concluídas): o detalhe da mãe também precisa recarregar.
      invalidateTaskData(queryClient, projectId);
    },
  });
}

export function useDeleteProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteProjectTask(projectId, taskId),
    onSuccess: (_data, taskId) => {
      // O detalhe da tarefa apagada não deve ser recarregado (daria 404).
      queryClient.removeQueries({ queryKey: [AGENCY_PROJECTS_ROOT, "task", projectId, taskId] });
      invalidateTaskData(queryClient, projectId);
    },
  });
}

interface StatusContext {
  previous?: Task;
}

/**
 * Muda o status da tarefa (arrastar entre colunas, "Mover para…"). Atualiza o quadro na hora; se a API recusar,
 * devolve a tarefa à coluna de origem (só ela: mudanças feitas em outras tarefas nesse meio-tempo ficam) e o
 * chamador mostra o toast com `agencyProjectErrorMessage`. `completed_at` acompanha a regra do servidor
 * (entrar em `concluido` grava, sair limpa) só para o cartão não ficar inconsistente até a resposta chegar.
 */
export function useSetProjectTaskStatus(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation<Task, Error, { taskId: string; status: TaskStatus }, StatusContext>({
    mutationFn: ({ taskId, status }) => updateProjectTask(projectId, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      const key = agencyProjectKeys.tasks(projectId, workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key)?.find((t) => t.id === taskId);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status, completed_at: status === "concluido" ? (t.completed_at ?? new Date().toISOString()) : null }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_error, { taskId }, context) => {
      const previous = context?.previous;
      if (!previous) return;
      queryClient.setQueryData<Task[]>(agencyProjectKeys.tasks(projectId, workspaceId), (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: previous.status, completed_at: previous.completed_at } : t)),
      );
    },
    onSettled: (_data, _error, { taskId }) => invalidateTaskData(queryClient, projectId, taskId),
  });
}

export function useAddTaskComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) => createTaskComment(projectId, taskId, body),
    onSuccess: (_data, { taskId }) => invalidateTaskData(queryClient, projectId, taskId),
  });
}

export function useDeleteTaskComment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) => deleteTaskComment(projectId, taskId, commentId),
    onSuccess: (_data, { taskId }) => invalidateTaskData(queryClient, projectId, taskId),
  });
}

export function useUploadTaskAttachment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) => uploadTaskAttachment(projectId, taskId, file),
    onSuccess: (_data, { taskId }) => invalidateTaskData(queryClient, projectId, taskId),
  });
}

export function useDeleteTaskAttachment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, attachmentId }: { taskId: string; attachmentId: string }) =>
      deleteTaskAttachment(projectId, taskId, attachmentId),
    onSuccess: (_data, { taskId }) => invalidateTaskData(queryClient, projectId, taskId),
  });
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

function invalidateDocuments(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({ queryKey: [AGENCY_PROJECTS_ROOT, "documents", projectId] });
}

export function useCreateProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectDocumentInput) => createProjectDocument(projectId, input),
    onSuccess: () => void invalidateDocuments(queryClient, projectId),
  });
}

export function useUpdateProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: ({ documentId, input }: { documentId: string; input: ProjectDocumentUpdateInput }) =>
      updateProjectDocument(projectId, documentId, input),
    onSuccess: (document: ProjectDocument) => {
      queryClient.setQueryData<ProjectDocument[]>(agencyProjectKeys.documents(projectId, workspaceId), (old) =>
        old?.map((d) => (d.id === document.id ? document : d)),
      );
      void invalidateDocuments(queryClient, projectId);
    },
  });
}

export function useDeleteProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteProjectDocument(projectId, documentId),
    onSuccess: () => void invalidateDocuments(queryClient, projectId),
  });
}
