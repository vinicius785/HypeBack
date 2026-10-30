# Publicação do backoffice

O backoffice é um app estático (Vite + React). O build gera a pasta `dist/` e
qualquer hospedagem estática serve. Já existem as regras de rotas para
Vercel (`vercel.json`), Netlify (`public/_redirects`) e Apache
(`public/.htaccess`).

## 0. Endereço público: `hypeapp.com.br/backoffice`

O app é publicado em um **subcaminho**: `base: "/backoffice/"` no `vite.config.ts`, `basepath`
no roteador (`src/main.tsx`) e o build sai em `dist/backoffice/` (o mesmo caminho da URL pública).
Em dev, abra `http://localhost:5173/backoffice/`.

### Como o `/backoffice` chega ao domínio principal

Este projeto fica no Vercel, com o domínio técnico `backoffice-v2.hypeapp.com.br` (**não apague nem
redirecione** esse domínio: ele é a origem do app). O endereço público é `www.hypeapp.com.br/backoffice`
(o apex `hypeapp.com.br` redireciona para `www`).

Quem faz a ponte é uma **Worker da Cloudflare** (`backoffice-proxy`), com as rotas
`www.hypeapp.com.br/backoffice*` e `hypeapp.com.br/backoffice*`, na zona `hypeapp.com.br`:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = "backoffice-v2.hypeapp.com.br";
    return fetch(new Request(url, request));
  },
};
```

Links antigos sem o prefixo (ex.: `backoffice-v2.hypeapp.com.br/campaigns/…/invite`) são redirecionados
pelo `vercel.json` para `www.hypeapp.com.br/backoffice/…`; só `/backoffice/*` é servido direto neste domínio.

Só `/backoffice*` passa pela Worker; o resto do domínio vai para o site, onde quer que ele esteja
hospedado. Se o site mudar de hospedagem, nada muda aqui, desde que o registro `www` continue com o
proxy da Cloudflare ligado (nuvem laranja).

Ao mudar de domínio: o `localStorage` é por origem, então todos precisam entrar de novo; e ele
passa a ser compartilhado com o site (origem `www.hypeapp.com.br`).

### Vercel (este projeto)

- Branch de produção: `feat/novo-visual-backoffice` (Settings → Environments → Production).
- **Install Command sem override** (ou `npm ci`): o projeto usa npm. Um `pnpm i` configurado no painel
  derruba o build com "Command pnpm i exited with 1".
- Framework Vite, build `npm run build`, saída `dist`.

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
