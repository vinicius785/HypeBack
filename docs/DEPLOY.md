# Publicação do backoffice

O backoffice é um app estático (Vite + React). O build gera a pasta `dist/` e
qualquer hospedagem estática serve. Já existem as regras de rotas para
Vercel (`vercel.json`), Netlify (`public/_redirects`) e Apache
(`public/.htaccess`).

## 0. Endereço público: `hypeapp.com.br/backoffice`

O app é publicado em um **subcaminho**: `base: "/backoffice/"` no `vite.config.ts`, `basepath`
no roteador (`src/main.tsx`) e o build sai em `dist/backoffice/` (o mesmo caminho da URL pública).
Em dev, abra `http://localhost:5173/backoffice/`.

O domínio principal (`www.hypeapp.com.br`) é outro projeto no Vercel. Para ele entregar o backoffice,
adicione no `vercel.json` **do projeto do site** (troque o destino pela URL de produção deste projeto):

```json
{
  "rewrites": [
    { "source": "/backoffice", "destination": "https://SEU-PROJETO-BACKOFFICE.vercel.app/backoffice/" },
    { "source": "/backoffice/:path*", "destination": "https://SEU-PROJETO-BACKOFFICE.vercel.app/backoffice/:path*" }
  ]
}
```

O apex `hypeapp.com.br` redireciona para `www`, então o endereço final é `www.hypeapp.com.br/backoffice`.

Ao mudar de domínio: o `localStorage` é por origem, então todos precisam entrar de novo; o
`localStorage` passa a ser compartilhado com o site (origem `www.hypeapp.com.br`).

## 1. Variáveis de ambiente (por ambiente)

Cadastre no painel da hospedagem, nunca no código. Veja `.env.example`.

| Variável | Exemplo | Observação |
|---|---|---|
| `VITE_SERVER_URL` | `https://api-v2.hypeapp.com.br/api/backoffice` | Termina em `/api/backoffice`, sem `/` final. |
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

Na API (DigitalOcean), ajuste as variáveis de ambiente do serviço (no painel do App Platform ou no `.env` do servidor) e **reinicie** o serviço:

- `ALLOWED_ORIGINS` — inclua a **origem** do front, sem caminho (ex.: `https://www.hypeapp.com.br`),
  separada por vírgula das demais.
- `FRONTEND_URL` / `BACKOFFICE_URL` — a URL base **com o caminho** (`https://www.hypeapp.com.br/backoffice`),
  usada em links de e-mail e convites.

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
