# Projetos para agências — contrato

Pedido (2026-11-05): "Quem for AGÊNCIA vai ter a aba PROJETOS também, que vai funcionar igual ao da Plataforma Você no Hype."
Referência funcional: `/Users/vinidugar/Desktop/Clientes/Você no Hype/Plataforma VNH` (`src/components/ProjetosSection.tsx`, `projetos/ProjectCard.tsx`,
`projetos/ProjetoFiltersBar`, `projetos/projeto-ui.ts`, `ProjectWizard`, `src/routes/_authenticated/projeto.$id.tsx`, `tasks/TaskBoard`, `ProjectDocuments`).

Decisões da pessoa: **núcleo completo** (lista de projetos + detalhe com Kanban de tarefas e documentos por link); áreas **Kanban de tarefas** e
**Arquivos e links** apenas (SEM Influenciadores, Bugs e Sugestões, Blog, AEO, Calendário editorial, projeto "Marketing"/"HypeApp");
**sem vínculo com marca**; **acesso reaproveita as permissões de campanha**. Fora do escopo: cronômetro e lançamento de horas, dependências entre tarefas,
bloqueios com questionário, recorrência, replanejamento de prazo, sprints, pontos/Score, mover tarefa entre origens, tarefa criada a partir do chat,
marcos, editor rich-text (a descrição é texto simples com quebras de linha).

Repositórios: API `hypeapi-repo` (worktree `../hypeapi-projetos`, branch `feat/projetos-agencia`, base `origin/feat/solicitacao-tipo-conta`);
front `hype-backoffice-main` (worktree `../hype-backoffice-projetos`, branch `feat/projetos-agencia`, base `origin/feat/novo-visual-backoffice`).

## Quem vê e edita
- Só **workspace de agência** (`workspaces.account_type = 'agency'`): serviço faz `assertAgencyWorkspace` (403 `AGENCY_ONLY`), como Marcas/Elenco. Front: item de menu `agencyOnly`.
- Permissões de workspace já existentes (nada novo): ver = `campaigns_read`; criar projeto e duplicar = `campaigns_create`; editar projeto, mudar status, tarefas,
  comentários, anexos e documentos = `campaigns_write`; excluir projeto = `campaigns_delete`. Excluir comentário: o autor ou quem tem `campaigns_delete`.
- Sem escopo por marca (projeto não tem marca): quem tem a permissão vê todos os projetos do workspace.
- Estado do workspace (mesmas regras dos demais controllers): arquivado = só leitura; suspenso/excluído = bloqueado (guardas existentes).
- Tudo é isolado por `workspace_id` (header `Workspace-Id`); um id de outro workspace é sempre 404.

## Modelo de dados (migration `109_agency_projects.sql` + `supabase/apply/109_agency_projects.supabase.sql`, idempotente, no estilo das 102/104/108)
Relacional (a VNH guarda tudo em JSON; aqui não), FKs com `ON DELETE CASCADE` (a VNH deixa órfãos; aqui excluir o projeto apaga tarefas, comentários, anexos e documentos).
- `agency_projects`: `id` serial, `public_id` uuid único, `workspace_id` FK, `name` (<=120), `description` text (<=2000) null, `cover_url` text null, `status`
  (`ativo|pausado|concluido|arquivado`, padrão `ativo`, CHECK), `created_by`, `created_at`, `updated_at`. Índice `(workspace_id, status)`.
- `agency_project_tasks`: `id`, `public_id` uuid, `project_id` FK cascade, `parent_task_id` FK self cascade null (subtarefa, um nível só), `title` (<=200), `description`
  text (<=5000) null, `status` (`aberto|em_andamento|em_aprovacao|em_ajustes|aprovado|bloqueada|concluido|arquivado`, padrão `aberto`), `priority`
  (`urgente|alta|normal|baixa`, padrão `normal`), `due_date` date null, `tags` text[] (<=10, cada <=30), `completed_at` timestamptz null, `created_by`, `created_at`,
  `updated_at`. Índices `(project_id, status)`, `(parent_task_id)`.
- `agency_project_task_assignees`: `task_id` FK cascade, `user_id` FK users, `is_primary` bool; PK `(task_id, user_id)`; no máximo um primário por tarefa (índice único parcial).
  Responsável é **id de usuário membro do workspace** (a VNH guarda nomes: não repetir).
- `agency_project_task_comments`: `id`, `public_id`, `task_id` cascade, `author_id`, `body` (<=2000), `created_at`.
- `agency_project_task_attachments`: `id`, `public_id`, `task_id` cascade, `url`, `name`, `mime_type`, `size`, `uploaded_by`, `created_at` (storage igual ao dos anexos do chat; só URLs geradas pelo endpoint).
- `agency_project_task_events` (log de atividade): `id`, `task_id` cascade, `actor_id`, `type` (`created|status|assignees|due_date|priority|completed|reopened|comment|attachment`), `data` jsonb, `created_at`.
- `agency_project_documents`: `id`, `public_id`, `project_id` cascade, `name` (<=120), `url` (http/https, <=2000), `category` (`briefing|planejamento|apresentacao|relatorio|contrato|referencia|outro`),
  `pinned` bool, `created_by`, `created_at`.
Status "bloqueada"/"concluido": entrar em `concluido` grava `completed_at`; sair de `concluido` limpa e registra `reopened`. Qualquer troca de status é permitida (sem máquina de estados, como na VNH).

## Regras calculadas no servidor (iguais à VNH; fuso America/Sao_Paulo)
- **Tarefas abertas** = status em `aberto, em_andamento, em_aprovacao, em_ajustes, aprovado, bloqueada`. **Fechadas** = `concluido, arquivado`.
- **Atrasada** = aberta com `due_date < hoje`. **Progresso** = `concluidas / (tarefas de 1º nível, sem arquivadas)`; subtarefas não entram.
  Como na VNH, **todas** as contagens de `stats` (`tasks_total/done/open/overdue/blocked`), `deadline`, `next_due`, a saúde e o responsável olham só as tarefas de **1º nível**: subtarefa nunca conta duas vezes a mesma entrega.
- **Prazo final do projeto** = maior `due_date` entre as tarefas abertas de 1º nível (substitui os "marcos" da VNH, que nunca tiveram UI); sem tarefa com prazo = null ("Sem entrega definida").
  **Próxima entrega** = menor `due_date` entre as abertas de 1º nível.
- **Última atividade** = maior entre `projects.updated_at`, `created_at`/`completed_at` das tarefas e os eventos.
- **Saúde** (só se `status = ativo`; calculada, nunca gravada): `em_risco` se mais de 25% das tarefas abertas atrasadas, ou qualquer tarefa `bloqueada`, ou prazo final vencido com tarefas abertas;
  `atencao` se 10% ou mais atrasadas, ou prazo final em até 7 dias, ou 14 dias ou mais sem atividade; senão `saudavel`. Projeto não ativo: `saude = null`.
- **Responsável principal e participantes**: derivados de quem mais aparece como responsável nas tarefas abertas de 1º nível (empate: o primário mais frequente, depois o nome pt-BR, depois o id); participantes = os demais
  (a API devolve até 50; o cartão mostra o responsável e "+N", sem limitar a 5, para o número ser verdadeiro).
- **Atividade** (`data` de cada evento): `status` e `priority` e `due_date` = `{ from, to }`; `reopened` = `{ to }`; `assignees` = `{ added: number[], removed: number[], primary: number | null }` (ids de usuário);
  `comment` = `{ comment_id }`; `attachment` = `{ action: "added" | "removed", name }`; `created` e `completed` = `{}`. O `id` do evento é o número do registro, em texto (evento não tem uuid). Criar a tarefa grava só `created`
  (mesmo com status ou responsáveis na criação); mais recentes primeiro, até 100.

## REST (`/backoffice/agency/projects…`, header `Workspace-Id`, guardas do `agency-brands.controller.ts`, respostas `{ data }`, ids públicos uuid, campos snake_case)
Projetos:
- `GET /backoffice/agency/projects` → `{ data: Project[] , meta: { total } }` (todos do workspace, até 500, sem paginação; filtro/ordenação/busca ficam no cliente como na VNH; cada item já traz `stats`).
- `POST /backoffice/agency/projects` `{ name, description?, cover_url? }` → `{ data: Project }` (`campaigns_create`).
- `GET /backoffice/agency/projects/:projectId` → `{ data: Project }`. `PATCH` `{ name?, description?, cover_url? | null, status? }` (`campaigns_write`).
- `POST /backoffice/agency/projects/:projectId/duplicate` → `{ data: Project }` (copia nome com " (cópia)", descrição e capa; NÃO copia tarefas nem documentos; status `ativo`).
- `DELETE /backoffice/agency/projects/:projectId` (`campaigns_delete`) → 200 `{ data: { deleted: true } }`; apaga em cascata e tenta remover os arquivos dos anexos e da capa (melhor esforço).
- `POST /backoffice/agency/projects/cover` (multipart `file`, imagem até 5 MB; `campaigns_write`) → `{ data: { url } }` (o front redimensiona para no máx. 1600x900 JPEG antes).
Tarefas:
- `GET /…/:projectId/tasks` → `{ data: Task[] }` (1º nível e subtarefas numa lista plana com `parent_task_id`; sem comentários/anexos/eventos, só contagens).
- `POST /…/:projectId/tasks` `{ title, description?, status?, priority?, due_date?, tags?, assignee_ids?, primary_assignee_id?, parent_task_id? }` (`campaigns_write`) → `{ data: Task }`.
- `GET /…/:projectId/tasks/:taskId` → `{ data: TaskDetail }` (com `comments`, `attachments`, `events`, `subtasks`). `PATCH` mesmos campos de criação (parcial) → `{ data: Task }`; `DELETE` → 200.
- `POST /…/tasks/:taskId/comments` `{ body }`; `DELETE /…/tasks/:taskId/comments/:commentId`.
- `POST /…/tasks/:taskId/attachments` (multipart `file`, mesmos limites de tipo/tamanho do chat da equipe/campanhas, até 10 por tarefa); `DELETE /…/tasks/:taskId/attachments/:attachmentId`.
Documentos:
- `GET /…/:projectId/documents` → `{ data: ProjectDocument[] }` (fixados primeiro); `POST` `{ name, url, category? }`; `PATCH /…/documents/:documentId` `{ name?, url?, category?, pinned? }`; `DELETE`.
Anexos: só os tipos do chat/campanhas (JPEG, PNG, GIF, WebP, HEIC/HEIF, MP4, MOV, AVI, PDF, DOC, DOCX; fora disso 400 `Tipo de arquivo não suportado...`), até 25 MB (acima, **413** `File too large`) e a assinatura
do arquivo é conferida. Capa: JPEG, PNG ou WebP, até 5 MB (413 acima), conferida pelos bytes.
Validação: class-validator com mensagens pt-BR, `@Transform` vazio→null, URLs de anexo/capa só do diretório do próprio endpoint, texto puro, status/prioridade/categoria por enum, `assignee_ids` precisam ser membros ativos do workspace (400 `ASSIGNEE_NOT_MEMBER`).

Tipos:
```ts
type ProjectStatus = "ativo" | "pausado" | "concluido" | "arquivado";
type ProjectHealth = "saudavel" | "atencao" | "em_risco" | null;
type Project = {
  id: string; name: string; description: string | null; cover_url: string | null; status: ProjectStatus;
  created_at: string; updated_at: string;
  stats: { tasks_total: number; tasks_done: number; tasks_open: number; tasks_overdue: number; tasks_blocked: number; progress: number /* 0..1 */;
           deadline: string | null /* YYYY-MM-DD */; next_due: string | null; last_activity_at: string };
  health: ProjectHealth;
  responsible: { user_id: number; name: string; avatar: string | null } | null;
  participants: { user_id: number; name: string; avatar: string | null }[];
};
type TaskStatus = "aberto" | "em_andamento" | "em_aprovacao" | "em_ajustes" | "aprovado" | "bloqueada" | "concluido" | "arquivado";
type TaskPriority = "urgente" | "alta" | "normal" | "baixa";
type Task = {
  id: string; project_id: string; parent_task_id: string | null; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority; due_date: string | null; tags: string[]; completed_at: string | null;
  assignees: { user_id: number; name: string; avatar: string | null; is_primary: boolean }[];
  counts: { subtasks: number; subtasks_done: number; comments: number; attachments: number };
  created_at: string; updated_at: string;
};
type TaskComment = { id: string; author: { user_id: number; name: string; avatar: string | null }; body: string; created_at: string };
type TaskAttachment = { id: string; url: string; name: string; mime_type: string; size: number; uploaded_by: number; created_at: string };
type TaskEvent = { id: string; actor: { user_id: number; name: string } | null; type: string; data: Record<string, unknown>; created_at: string };
type TaskDetail = Task & { comments: TaskComment[]; attachments: TaskAttachment[]; events: TaskEvent[]; subtasks: Task[] };
type ProjectDocument = { id: string; name: string; url: string; category: "briefing"|"planejamento"|"apresentacao"|"relatorio"|"contrato"|"referencia"|"outro"; pinned: boolean; created_at: string };
```
Erros: `AGENCY_ONLY` (403), `PROJECT_NOT_FOUND`/`TASK_NOT_FOUND` (404, igual para "não existe" e "é de outro workspace"), `ASSIGNEE_NOT_MEMBER` (400), `SUBTASK_DEPTH` (400, subtarefa de subtarefa), `ATTACHMENT_LIMIT` (400);
também: `DOCUMENT_NOT_FOUND`/`COMMENT_NOT_FOUND`/`ATTACHMENT_NOT_FOUND` (404), `PRIMARY_NOT_ASSIGNEE` (400, principal fora da lista), `TASK_LIMIT` (2000 por projeto), `COMMENT_LIMIT` (500 por tarefa), `DOCUMENT_LIMIT` (200 por projeto), `INVALID_COVER_URL` (400),
`COMMENT_NOT_YOURS` (403, excluir comentário alheio sem `campaigns_delete`). A rota de excluir comentário aceita `campaigns_write` **ou** `campaigns_delete`.
O corpo de erro é o do `HttpExceptionFilter`: `{ statusCode, message (texto ou lista), errors?, error? }`; o `error` (código) **só sai se estiver na lista pública do filtro** (os códigos acima estão: `AGENCY_ONLY`, ...); erro de validação
e 404 de rota inexistente (`Cannot GET ...`) vêm **sem** `error`. O front só chama de "rota ausente" o 404 sem código com texto `Cannot <MÉTODO> ...` (ou sem corpo).

## Front
- Menu: item "Projetos" em `WORKSPACE_NAV` (seção "Gestão de campanhas", ao lado de Marcas e Elenco), `agencyOnly: true`, `permission: "campaigns_read"`, ícone existente do mapa `I` (ex. `list`/`clip`), `href: "/projects"`; atualizar `sidebar.test.tsx` e o menu móvel.
- Rotas `src/screens/(private)/(app)/projects.tsx` (lista) e `projects.$projectId.tsx` (detalhe); regenerar `routeTree.gen.ts`. Bloqueio visual "exclusivo de agências" se `!isAgency`.
- **Lista** (kit `src/components/page/page-kit.tsx`): `PageHeader` "Projetos" ("Organize tarefas e entregas do time."), ação "Novo projeto" (só com `campaigns_create`); três indicadores (Projetos ativos, Em risco, Tarefas atrasadas), só se houver projetos;
  busca por nome/descrição (e responsável: corrige o placeholder da VNH); filtros em popover com contador: Status (todos/ativo/pausado/concluído/arquivado), Saúde (todas/saudável/atenção/em risco), Responsável (lista derivada dos projetos);
  ordenação: atualizados (padrão), criados, nome A–Z, mais tarefas atrasadas, maior e menor progresso; filtros e ordenação na URL (search params) — melhoria sobre a VNH;
  grade de cartões (1/2/3 colunas) com capa/iniciais, nome, responsável + "+N", selo de status e de saúde (só se não saudável), "Entrega dd/mm" ou "Sem entrega definida", "X de Y concluídas · N atrasadas" ou "Nenhuma tarefa cadastrada",
  barra de progresso; menu "⋮" (Abrir; com `campaigns_write`: Editar, Pausar/Reativar, Arquivar; Duplicar com `campaigns_create`; Excluir com `campaigns_delete`); Arquivar e Excluir pedem confirmação (texto de exclusão correto: tarefas, comentários, anexos e documentos são apagados);
  concluídos e arquivados numa seção recolhível "Ver projetos encerrados (N)" (com filtro de status ativo, tudo junto); estados: skeleton, vazio ("Nenhum projeto ainda" + "Novo projeto"), sem resultado ("Limpar filtros"), erro com "Tentar de novo".
- **Formulário** (Sheet/diálogo): nome (obrigatório), descrição, capa (upload ou arrastar; redimensiona 1600x900 JPEG), status só na edição; confirmação de descarte com alterações pendentes.
- **Detalhe**: cabeçalho (voltar para Projetos, capa, nome, selo de status, descrição, "responsável · Atualizado há X"), botões Editar e "⋯" (Duplicar, Pausar/Reativar, Arquivar, Excluir); indicadores Progresso / Próxima entrega / Pendências (+ selo de saúde);
  seção **Tarefas**: Kanban de 8 colunas (uma por status; no celular uma coluna por vez), arrastar entre colunas com `@dnd-kit` (funciona em toque; mudar de coluna = PATCH de status com atualização otimista e reversão com toast em caso de erro),
  busca; filtros por responsável, tag, prioridade e período de prazo (atrasadas, hoje, semana, sem prazo) com chips removíveis; ordenação por prazo, prioridade, criação e nome (preferência em localStorage por projeto); "exibir subtarefas no board"; limite de cards por coluna com "Ver mais"; cartão de tarefa com título, prioridade, prazo (vermelho se atrasada), responsáveis, tags, contadores;
  **modal da tarefa**: título, descrição (texto), status, prioridade, prazo, responsáveis múltiplos com um principal (membros do workspace), tags, subtarefas (adicionar/marcar/remover), anexos (enviar/listar/remover), comentários, atividade;
  seção **Arquivos e links**: lista por categoria com fixar, ícone/tipo detectado pela URL (Google, Figma, Miro, Notion, Canva), adicionar/editar/remover.
- Serviços `src/shared/services/agency-projects.ts`, hooks `src/hooks/use-agency-projects.ts` (padrão `use-agency-brands.ts`: `withWorkspaceKey`, `enabled: isAgency && !!workspaceId`, mutations invalidam), lógica pura em `src/components/agency-projects/project-ui.ts` com testes (saúde/progresso exibidos, filtro, ordenação, agrupamento, período de prazo).
- Tolerar API antiga: 404 nas rotas = estado "Projetos ainda não está disponível" sem erro genérico.
- Visual: protótipo/kit da página (`.pv`), mesmos controles de 48px, estados e acessibilidade do restante (listas com roles, foco, `aria-live` em toasts, teclado no Kanban: mover com menu "Mover para…" além do arrastar).

## Fora do escopo desta entrega
Tudo o que está listado na primeira seção como fora, mais: exportar, templates de projeto, favoritos, visão calendário/Gantt, notificações de atribuição (push/sino), menções, editor rich-text, orçamento, horas.
