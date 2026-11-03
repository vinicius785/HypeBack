# Sidebars do HypeApp: auditoria e decisões

Reestruturação do menu lateral dos dois ambientes (Admin da plataforma e Workspace). Este documento registra o que
havia antes, o que foi decidido e o que ficou de fora de propósito.

## Como está estruturado agora

| Peça | Arquivo | O que controla |
|---|---|---|
| Configuração de cada ambiente | `src/components/navigation/nav-config.ts` | grupos, itens, ordem, rotas, permissão de cada item, atalhos fixos do celular |
| Quais itens este usuário vê | `src/components/navigation/use-nav-sections.ts` | filtro por permissão do workspace e por administrador da plataforma, selo de campanhas ativas, "item ativo" por rota |
| Lista de navegação | `src/components/navigation/sidebar-nav.tsx` | grupos com título, divisória, itens, selo, rolagem |
| Dica do trilho | `src/components/navigation/rail-tooltip.tsx` | nome do item no menu recolhido (mouse e teclado) |
| Casca da sidebar | `src/components/sidebar.tsx` | logo, seletor de workspace (ou bloco do Admin), rodapé (Voltar ao app, perfil, Sair) |
| Navegação do celular | `src/components/mobile-nav.tsx` | barra inferior (itens `pinned`) e gaveta "Mais" (o resto, nos mesmos grupos) |
| Estilos | `src/styles/sidebar-nav.css` | hierarquia, estados, rodapé e trilho; a base continua em `prototype.css` |

Os dois ambientes usam o mesmo componente; só a configuração muda. Nenhuma rota, permissão ou regra de negócio foi
alterada: cada permissão de leitura continua no mesmo item de antes e o Admin continua protegido no backend
(`PlatformAdminGuard`).

### Admin da plataforma

- **Visão geral:** Dashboard.
- **Gestão da plataforma:** Workspaces, Usuários, Equipe.
- **Operação:** Campanhas, Criadores, Financeiro, Comunidade.
- **Monitoramento:** Atividades, Notificações, Saúde da plataforma.
- **Rodapé:** Voltar ao app (faixa própria, separada por divisória), perfil, Sair.

### Workspace

- **Workspace:** Início. **Gestão de campanhas:** Campanhas, Criadores, Lives. **Financeiro:** Financeiro.
- **Administração:** Backoffice (só para a equipe Hype; leva a `/admin/dashboard`).
- **Rodapé:** perfil, Sair.

## O que foi encontrado na estrutura anterior

1. **O Admin inteiro era empilhado no menu do cliente.** No escopo `workspace`, quem é administrador da plataforma
   via os 5 itens do cliente e mais os 10 do Admin em dois grupos, na mesma lista. Isso replicava a estrutura
   administrativa no ambiente dos clientes. Agora há um único item, o Backoffice.
2. **"Backoffice" (Workspace) não era uma rota própria.** Foi mapeado para a única porta real para o Admin, o
   Dashboard (`/admin/dashboard`), e só aparece para a equipe da plataforma (admin, suporte ou somente leitura, o
   mesmo critério que abre o Admin: `isPlatformStaff`). A "Equipe" da proposta passou a existir como página
   (`/admin/team`) durante este trabalho e entrou em "Gestão da plataforma".
3. **Sem "Sair" no menu recolhido.** Abaixo de 1100px o botão Sair do rodapé era escondido pelo CSS do protótipo,
   e a pessoa só encontrava a saída em Configurações. No trilho, o perfil agora fica em coluna (avatar em cima,
   Sair embaixo).
4. **O selo de campanhas ativas sumia no trilho** (`.n` com `display: none`). Virou um número pequeno sobre o ícone.
5. **A lista de workspaces ficava com 56px de largura no trilho** (`left: 0; right: 0` dentro de um seletor de 56px).
   Agora abre para o lado, com 268px.
6. **O perfil era um `div` clicável**, sem foco de teclado nem papel de botão. Agora é um botão (`Meu perfil`), com
   o Sair ao lado.
7. **A dica dos itens era só o atributo `title`** (atraso de cerca de 1 segundo, sem teclado). No trilho há uma dica
   própria, que abre com o mouse e com o foco e fecha com Esc. Ela é uma camada fixa porque a lista rola e uma dica
   dentro dela seria cortada.
8. **A barra do celular decidia os atalhos por rótulo** (`BAR = ["Início", ...]`), o que quebra se um rótulo mudar.
   Agora cada item tem `pinned` na configuração.
9. **Divisórias só existiam no trilho do Admin**, e a identidade visual de cada ambiente divergia (alturas de item
   42px no Admin e 46px no app). Agora todos os itens têm 40px e os grupos têm título e divisória.

## Movimento na troca entre o app e o Admin

A entrada animada do Admin, a saída em cascata ao clicar em "Voltar ao app" e o menu do app que chega animado
(`src/styles/admin-sidebar-motion.css`, lógica em `sidebar.tsx`) foram mantidos. A cascata agora segue as seções da
configuração: cada título e cada item leva a sua vez (`--i`), "Voltar ao app" fecha a sequência, e o passo da saída
passou de 7 para 6 ms para a cascata maior (4 títulos e 11 itens) continuar cabendo em `LEAVE_MS`.

## Decisões de design

- Tudo parte do que já existia: item ativo em roxo (`--brand`), hover em branco 8%, pílulas de 999px, ícones do mapa
  `I` e preto, branco, cinza e roxo. Nenhuma cor nova.
- Título de grupo: 10.5px, maiúsculas, branco a 50% sobre o preto da sidebar (contraste de cerca de 5:1), mais quieto
  que o item (62%). Divisória: branco a 8%.
- Hover do ícone: `scale(1.12)` em 0,3s, o mesmo `transition` dos botões do app (`.ab:hover .ico`), e desligado
  com "reduzir movimento". "Voltar ao app" move a seta para a esquerda.
- Foco de teclado: anel branco de 2px por dentro, visível sobre o preto e sobre o item roxo.
- Seção sem nenhum item visível (ex.: "Administração" para um cliente, ou "Financeiro" sem permissão) não deixa
  título solto.

## Sidebar recolhida

Não existe botão para recolher: o menu vira trilho sozinho abaixo de 1100px (84px de coluna) e vira a barra inferior
abaixo de 900px. Não foi criado um controle manual de recolher, porque isso seria uma funcionalidade nova. No trilho:
todos os ícones continuam, os títulos somem, um fio separa os grupos, o nome vem na dica, o selo vira número, o
seletor de workspace fica só com a imagem (e abre a lista para o lado) e o perfil mostra o avatar com o Sair embaixo.

## Limites conhecidos

- Em telas com menos de cerca de 920px de altura, a lista do Admin (10 itens e 4 títulos) rola dentro da sidebar. O
  logo, o seletor e o rodapé ficam sempre à vista, e uma linha fina na borda indica que há mais itens.
- Grupos de um só item (Workspace, Financeiro, Visão geral) seguem a proposta; o título deixa claro o contexto.
