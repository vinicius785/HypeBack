# Lives da Comunidade — integração do backoffice

> **Fonte da verdade do contrato:** `hypeapp-api/docs/backoffice-community-lives.md`.
> Este arquivo é só um índice da integração feita no frontend.

A feature já está integrada ao backend real (NestJS + **LiveKit/WebRTC**), não a um
contrato genérico. Resumo do que o frontend consome:

- **Base HTTP:** `/community/lives` (resolve para `/api/backoffice/community/lives`).
  Workspace-scoped (header `Workspace-Id`).
- **Permissões:** `community_lives_read` (ver) e `community_lives_write`
  (criar/abrir/editar/encerrar). Member já possui ambas; Observador só read.
- **Status:** `upcoming` · `live` · `ended` · `cancelled`.
- **Streaming:** WebRTC via **LiveKit**. `POST /:id/start` devolve
  `{ live, broadcaster }`; o navegador publica câmera/mic/tela com `livekit-client`
  (`src/components/lives/live-studio.tsx`). Reconexão via `POST /:id/broadcaster-token`.
- **Thumbnail:** upload prévio em `POST /community/lives/uploads` (campo `image`)
  → usar a `url` em `thumbnail_url` ao criar/editar.
- **Realtime (chat/curtidas/viewers):** socket.io namespace `/community/live`
  (`join_live` / evento `frame` com `comment` | `like_burst` | `viewer_count`).
  Moderação de chat NÃO está nesta entrega do backend.
- **VOD:** lives `ended` com `recording_status = ready` tocam `recording_url`.

### Mapa de arquivos (frontend)

| Camada | Arquivo |
|---|---|
| Tipos | `src/shared/types.ts` (`Live`, `BroadcasterCredentials`, …) |
| Serviço | `src/shared/services/lives.ts` |
| Hooks | `src/hooks/use-lives.ts`, `src/hooks/use-live-socket.ts` |
| Estúdio LiveKit | `src/components/lives/live-studio.tsx` |
| UI | `src/components/lives/*`, `src/screens/(private)/(app)/lives*.tsx` |
| Permissões | `src/shared/utils/workspace-permissions.ts` |
