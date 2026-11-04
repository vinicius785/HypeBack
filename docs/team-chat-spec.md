# Chat da equipe (pessoas do mesmo workspace) — contrato

Pedido: "As pessoas de um mesmo workspace devem conseguir trocar chats entre si." Decisões da pessoa (2026-11-03):
conversa **1 a 1** entre membros **+ canal geral da equipe**; anexos (imagem e arquivo); **não lidas e "visto"**; **aviso fora
da tela** (sino); aparece na **gaveta de chat do cabeçalho** (aba "Equipe"). O chat das campanhas (cliente ↔ criador,
`/chat`, `campaign_messages`) NÃO muda.

Repositórios: API `hypeapi-repo` (worktree `../hypeapi-chat-equipe`, branch `feat/chat-da-equipe`, base `origin/build/admin-e-marca`);
front `hype-backoffice-main` (worktree `../hype-backoffice-chat`, branch `feat/chat-da-equipe`, base `origin/feat/novo-visual-backoffice`).

## Quem participa
- Membro **ativo** do workspace (`user_workspace`, qualquer papel, inclusive observador) participa do canal e abre conversa 1 a 1 com outro
  membro ativo **do mesmo workspace**. Não precisa de permissão nova.
- Nunca entre workspaces diferentes; a conversa pertence ao workspace do header `Workspace-Id` (como as demais rotas do backoffice).
- Sair/ser removido do workspace tira o acesso (a conversa e o histórico ficam para quem permanece). Voltar ao workspace devolve o acesso.
- Estado do workspace (mesmas regras do chat das campanhas, `src/common/utils/workspace-state-socket.ts`): `archived` = só leitura
  (enviar/marcar lida/criar conversa recusados com o erro de estado); `suspended`/`deleted` = bloqueado e sockets expulsos
  (registrar no `workspaceEvictionRegistry`). Estado do **usuário** (suspenso etc.) segue as guardas existentes.

## Modelo de dados (migration `supabase/migrations/101_workspace_team_chat.sql`)
- `workspace_conversations`: `id` serial, `public_id` uuid único, `workspace_id` FK, `kind` (`channel` | `direct`), `direct_key` text
  (`"<menorUserId>:<maiorUserId>"` só para `direct`; único por `(workspace_id, direct_key)`; no máximo UM `channel` por workspace, índice único
  parcial), `last_message_id`, `last_message_at`, `created_at`.
- `workspace_conversation_participants` (só `direct`): `conversation_id`, `user_id`, PK composta.
- `workspace_messages`: `id` bigserial, `public_id` uuid único, `conversation_id`, `sender_id` (users.id), `body` text (<= 4000, pode ser vazio se houver anexo),
  `attachments` jsonb (array de `{url,name,mime_type,size}`, <= 5), `created_at`; índice `(conversation_id, id desc)`.
- `workspace_conversation_reads`: `(conversation_id, user_id)` PK, `last_read_message_id`, `updated_at`. "Visto" e não lidas saem daqui.
- O canal é criado sob demanda (primeiro acesso do workspace). Migration só cria tabelas/índices (nada de dados); aplicar com `pnpm db:migrate`
  é feito pelo dono da infraestrutura.

## REST (backoffice, header `Workspace-Id`, mesmas guardas do `campaign-messages.controller.ts`; respostas `{ data: ... }`)
Todas exigem membro ativo. Controller novo `src/modules/backoffice/controllers/team-chat.controller.ts` (+ service em `src/modules/workspaces/`).

- `GET /backoffice/team-chat/conversations` → `{ data: Conversation[] }` — o canal primeiro, depois as conversas 1 a 1 do usuário por `last_message_at desc`.
- `GET /backoffice/team-chat/members` → `{ data: TeamChatMember[] }` — membros ativos do workspace, exceto o próprio usuário (para "Nova conversa").
- `POST /backoffice/team-chat/conversations/direct` body `{ user_id: number }` → `{ data: Conversation }` — abre ou devolve a conversa 1 a 1 (idempotente). 400 se
  `user_id` for o próprio usuário; 404 se não for membro ativo do mesmo workspace.
- `GET /backoffice/team-chat/conversations/:conversationId/messages?before=<messageId>&limit=<=50>` → `{ data: TeamChatMessage[], meta: { has_more: boolean } }` —
  mais recentes primeiro (o front inverte para exibir); `before` pagina para trás.
- `POST /backoffice/team-chat/conversations/:conversationId/messages` body `{ body?: string, attachments?: TeamChatAttachment[] }` → `{ data: TeamChatMessage }` — mesmo efeito
  do socket (grava, emite `new_message`, atualiza notificação). `@Idempotent` se o projeto já usa; texto vazio sem anexo = 400. Throttle por usuário.
- `POST /backoffice/team-chat/conversations/:conversationId/attachments` (multipart `file`) → `{ data: TeamChatAttachment }` — reaproveita o mesmo mecanismo/limites de
  tipo e tamanho do upload de anexos do chat das campanhas (`campaign-messages.controller.ts`). Só aceita URLs de anexo geradas aqui ao enviar a mensagem (validar que a URL
  pertence ao diretório de uploads do chat da equipe).
- `POST /backoffice/team-chat/conversations/:conversationId/read` body `{ last_message_id: string }` → `{ data: { unread: number } }` — só avança (nunca recua), emite `read`.
- `GET /backoffice/team-chat/unread` → `{ data: { total: number, by_conversation: Record<string, number> } }` (não lidas, não conta mensagens próprias).

Tipos (ids públicos em string; `user_id` numérico como no resto do backoffice):
```ts
type TeamChatAttachment = { url: string; name: string; mime_type: string; size: number };
type TeamChatMember = { user_id: number; name: string; avatar: string | null; role: string };
type TeamChatMessage = {
  id: string; conversation_id: string; sender_id: number; sender_name: string; sender_avatar: string | null;
  body: string; attachments: TeamChatAttachment[]; created_at: string; // ISO
};
type Conversation = {
  id: string; kind: "channel" | "direct";
  title: string;                       // "Equipe" no canal; nome do outro no 1 a 1
  peer: { user_id: number; name: string; avatar: string | null } | null; // só em direct
  last_message: { body: string; sender_id: number; sender_name: string; created_at: string; has_attachments: boolean } | null;
  unread: number;
  peer_last_read_message_id: string | null; // direct: até onde a outra pessoa leu ("Visto")
};
```

## Socket (namespace NOVO `/team-chat`, mesmo handshake do `/chat`: `auth: { token, workspaceId }`)
- Ao conectar: o socket entra na sala pessoal `tc:user:<userId>:ws:<workspaceId>` e nas salas das conversas que o usuário pode ver
  (`tc:conv:<conversationId>`); conversa nova (1 a 1 criada por outra pessoa) entra via `conversation_created` na sala pessoal.
- Cliente → servidor: `send_message { conversationId, body?, attachments? }` (ack `{ ok, message? , error? }`), `mark_read { conversationId, lastMessageId }`.
- Servidor → cliente: `new_message (TeamChatMessage)` na sala da conversa; `read { conversationId, userId, lastMessageId }` na sala da conversa;
  `conversation_created (Conversation)` na sala pessoal do outro participante; `error { message, error? }` com os mesmos códigos de estado (`WORKSPACE_ARCHIVED`,
  `WORKSPACE_SUSPENDED`, `WORKSPACE_DELETED`) do chat das campanhas.
- Segurança: toda checagem de pertencimento (workspace e conversa) é feita no servidor a cada evento (nunca confiar em `workspaceId`/`conversationId` do cliente);
  `body` é texto puro (o front escapa); anexos validados; rate limit por socket.

## Aviso fora da tela (sino)
- Ao chegar mensagem para alguém que NÃO está com a conversa aberta (sem socket na sala `tc:conv:*` ativo/visível — use presença por sala; "aberta" = o cliente
  emitiu `focus_conversation`/`blur_conversation`), mantém **uma** notificação não lida por (usuário, conversa) na tabela `notifications` (`type = 'team_chat_message'`,
  `metadata = { conversation_id, workspace_id, kind, sender_id, sender_name, preview }`), atualizando-a em vez de criar uma por mensagem; marcar a conversa como lida
  marca a notificação como lida. Usar o mecanismo de criação/leitura de notificações já existente (não criar tabela nova).
- Front: o sino mostra o item e, ao clicar, abre a gaveta na conversa (`src/shared/utils/notification-navigation.ts`).

## Front (gaveta de chat do cabeçalho)
- `src/components/chat-drawer.tsx` ganha duas abas no topo da gaveta: **Criadores** (comportamento atual, sem mudanças) e **Equipe** (nova). Contador de não lidas do botão do
  cabeçalho soma as duas. Aba Equipe: lista (canal "Equipe" fixado no topo + conversas 1 a 1, prévia, hora, contador), botão "Nova conversa" (escolhe membro), conversa aberta
  (mensagens agrupadas por dia, balões, avatar/nome no canal, "Visto" abaixo da última mensagem própria no 1 a 1, anexos de imagem com pré-visualização e de arquivo com ícone/nome/tamanho,
  campo de texto com Enter para enviar e Shift+Enter para quebra, botão de anexo, estado de envio/erro com "Tentar de novo", rolagem para a última, carregar anteriores).
- `openTeamChat({ conversationId? , userId? })` (evento `hype:open-team-chat`) abre a gaveta na aba Equipe/conversa (usado pelo clique no sino).
- Serviço `src/shared/services/team-chat.ts`, hook de socket `src/hooks/use-team-chat.ts`, hooks de dados `src/hooks/use-team-chat-queries.ts` (TanStack Query, chaves com workspace via
  `useWorkspaceQueryKey`). Tolerar API antiga (404 nas rotas = aba Equipe mostra "Disponível em breve" sem erro e sem quebrar a aba Criadores).
- Visual: kit do protótipo (`.pv`), tipografia/cores da gaveta atual; acessibilidade (lista com `role="list"`, foco no campo ao abrir, `aria-live` para chegada de mensagem, botões com nome).
- Estado do workspace: arquivado = campo desabilitado com a mensagem de estado existente; suspenso/excluído = erro de estado (reaproveitar `WORKSPACE_STATE_DEFAULT_MESSAGE`).

## Fora do escopo desta entrega
Editar/apagar mensagem, reações, digitando…, busca, menções, canais extras, push móvel (a equipe usa a web), moderação pelo Admin da plataforma.

## Adendo 1 (revisão): envio idempotente e handshake recusado
- **`client_id`** (uuid v4 gerado pelo front por mensagem, reaproveitado no "Tentar de novo"): aceito no body do `POST .../messages` e no payload do socket
  `send_message`. O servidor garante UMA mensagem por `(conversation_id, sender_id, client_id)` (coluna `client_id uuid null` em `workspace_messages` + índice único
  parcial `WHERE client_id IS NOT NULL`; ajustar a migration 101, que ainda não foi aplicada em lugar nenhum). Reenvio com o mesmo `client_id` devolve a mensagem já
  gravada (REST 200 com `{ data }`; ack do socket `{ ok: true, message }`) e NÃO emite `new_message` nem toca o sino de novo. `TeamChatMessage` ganha `client_id: string | null`.
  Com `client_id` duplicado vindo de outro remetente/conversa não há colisão (a chave é composta). `client_id` inválido = 400.
- **Handshake recusado:** quem não é membro ativo do workspace do handshake recebe `error { message, error: 'TEAM_CHAT_FORBIDDEN' }` e é desconectado; token ausente/inválido
  recebe `error { message, error: 'TEAM_CHAT_UNAUTHENTICATED' }`. O front NÃO tenta reconectar (nem em `io server disconnect`) depois desses dois códigos nem dos de estado do workspace.
- **Presença:** `focus_conversation` / `blur_conversation` com payload `{ conversationId: string }`; o front reemite `focus_conversation` a cada reconexão.
- **Sino de outro workspace:** se `metadata.workspace_id` da notificação difere do workspace atual, o front troca de workspace (mesmo mecanismo que as outras
  notificações com workspace) e só então abre a conversa; se não houver como trocar, mostra aviso claro (toast) em vez de cair na lista em silêncio.
