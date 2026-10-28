# Publicação do backoffice

O backoffice é um app estático (Vite + React). O build gera a pasta `dist/` e
qualquer hospedagem estática serve. Já existem as regras de rotas para
Vercel (`vercel.json`), Netlify (`public/_redirects`) e Apache
(`public/.htaccess`).

## 1. Variáveis de ambiente (por ambiente)

Cadastre no painel da hospedagem, nunca no código. Veja `.env.example`.

| Variável | Exemplo | Observação |
|---|---|---|
| `VITE_SERVER_URL` | `https://hypeapp-api.onrender.com/api/backoffice` | Termina em `/api/backoffice`, sem `/` final. |
| `VITE_PLATFORM_ADMIN_EMAILS` | `voce@empresa.com` | Só controla o menu Admin. |

Depois de mudar uma variável é preciso refazer o deploy (ela é gravada no build).

## 2. Build

```bash
npm ci
npm run build # gera dist/
```

Vercel: framework "Vite", build `npm run build`, saída `dist`.
Netlify: build `npm run build`, publish `dist`.

> O projeto usa **npm** (`package-lock.json`). Não há lockfile do pnpm: o Vercel e o Netlify
> detectam o npm sozinhos, sem precisar trocar o Install Command.

## 3. API: liberar o domínio do front

Na API (Render), ajuste e reinicie:

- `ALLOWED_ORIGINS` — inclua a URL do front (ex.: `https://backoffice.seudominio.com`),
  separada por vírgula das demais.
- `FRONTEND_URL` — a mesma URL base do front (usada em links de e-mail/convites).

Sem isso o navegador bloqueia as chamadas e o app mostra "Failed to fetch".

## 4. Segurança antes de abrir

- Rotacione credenciais que tenham sido coladas em chat/e-mail (banco, SMTP,
  LiveKit, Asaas, OAuth, WhatsApp, Spaces/Supabase).
- Confirme que homologação usa banco de homologação.
- HTTPS é obrigatório (a câmera da live só funciona em HTTPS).

## 5. Roteiro de validação

Use `docs/qa-smoke-2026-08-07.md` mais:

- login, troca de workspace, sair da conta;
- campanha com influenciadores: Visão geral, Gerenciamento, Gestão (Grupo, Contratos,
  Pricing, Métricas);
- Criadores: filtros, perfil, salvar em lista, convidar para campanha;
- Lives: agendar, estúdio (câmera/áudio), encerrar;
- Financeiro: saldo e movimentações; depósito PIX em ambiente de teste;
- Configurações: membros, permissões, convite;
- Admin (conta de plataforma): Dashboard, Notificações, Grupos;
- sino de notificações e chat do topo.

## 6. Rollback

Mantenha o deploy anterior. No Vercel/Netlify, promova o deploy anterior a
produção; não é preciso mexer na API.
