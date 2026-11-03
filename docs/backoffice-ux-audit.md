# Evolução de UX/UI do Backoffice — auditoria e proposta

Escopo: as 11 páginas do Admin da plataforma (Dashboard, Workspaces, Usuários, Equipe, Campanhas, Criadores, Financeiro,
Comunidade, Atividades, Notificações, Saúde da plataforma). Referência visual: a página **Início** do Portal do Time.

Como foi feito: as 11 telas foram abertas no navegador com a API simulada (desktop 1440 px; celular 375 px em Criadores e
Financeiro) e o código de cada uma foi lido por grupo (telas, kit, CSS, sidebar). Cada achado cita o arquivo. Nada foi
alterado ainda: este documento é a etapa 1 (auditoria e arquitetura). Ele termina com as **decisões que dependem de você**.

Caminhos abreviados: `platform/` = `src/components/admin/platform/`, `CSS/` = `src/styles/`.

---

## 1. Resumo

O Admin já tem um kit bom (`platform/`: cabeçalho, abas, barra de filtros, tabela, cartão de indicador, selo, estados,
diálogo de confirmação). O problema não é falta de kit; é que **ele não é usado de ponta a ponta e faltam 6 peças**:

1. **Três camadas de controle antes do conteúdo** (abas + período + filtros) em Atividades, Financeiro, Criadores e Dashboard.
2. **Ruído em cada número**: selo de tipo ("Realizado", "Posição atual"…) + ícone "i" + às vezes um segundo "i" no hint.
   O Dashboard tem ~21 números e ~45 elementos acessórios.
3. **Texto de regra sempre aberto** (parágrafos em Financeiro, "Regra / Origem" em Saúde, descrições de seção) que deveria
   estar atrás de um "i" ou de um bloco recolhível.
4. **Telas que nem começam pelo kit**: Notificações (cabeçalho, abas e lista à mão) e a aba Grupos da Comunidade.
5. **Peças que o kit não tem e cada tela inventa**: menu de ações de linha, diálogo/drawer com foco preso, aviso de
   sucesso/erro, seletor de período, botão Atualizar, esqueleto de lista, "Carregar mais", linha do tempo, seletor de
   entidade (workspace/pessoa).
6. **Mesma informação dita duas ou três vezes** (status no selo e na linha; workspace na meta e numa seção; "Cadastro" com
   quatro sentidos em Criadores).

O que fazer, em uma frase: **uma anatomia única de página, um papel único para cada tipo de controle, e 7 componentes novos
no kit que substituem ~30 cópias locais** — sem mexer em regra de negócio, consulta, permissão ou rota.

---

## 2. Diagnóstico transversal

| # | Problema | Onde aparece | Evidência |
|---|---|---|---|
| T1 | Camadas de controle em excesso: abas, período e filtros empilhados | Atividades, Financeiro, Criadores, Dashboard | `activity-page.tsx:95-114`, `financial-page.tsx:44-47`, `admin-creators-screen.tsx:17-21` |
| T2 | Selo de tipo + "i" em todo indicador; 2º "i" no hint | Dashboard, Financeiro | `platform/admin-figure-card.tsx:67-76,93-97`, `dashboard-stat-areas.tsx:16-23,47` |
| T3 | Regra/explicação sempre visível em vez de popover ou detalhe recolhido | Financeiro, Saúde, Dashboard, Atividades | `financial-overview.tsx:124-133`, `health-alerts.tsx:55-60`, `dashboard-model.ts:103-224` |
| T4 | Papéis misturados: filtro como segmento solto, seletor de workspace no slot da busca, "Atualizar" no cabeçalho | Usuários, Campanhas, Financeiro, Comunidade, Atividades | `admin-users-list.tsx:182-188`, `admin-campaigns-list.tsx:281-286`, `community-page.tsx:39-56` |
| T5 | Telas que ignoram o kit | Notificações, Comunidade › Grupos, detalhe do grupo | `admin.notifications.tsx:84-124`, `community-groups.tsx:47-161` |
| T6 | Estados (carregando, vazio, erro) escritos à mão, sem `role=status/alert` e sem "Tentar de novo" | Notificações, Grupos, Equipe, gráficos, Dashboard, Saúde, Atividades | `admin-notification-list.tsx:179-215`, `community-groups.tsx:47-77`, `admin-team-page.tsx:120-127` |
| T7 | Diálogos sem foco preso, sem `aria-modal`, Esc fecha mesmo gravando | Grupo (novo/detalhe), formulário de notificação, menu móvel | `groups/pv-group.tsx:159-176`, `admin-notification-form.tsx:150-160,476`, `mobile-nav.tsx:103` |
| T8 | Dica essencial só em `title` (não funciona no teclado nem no toque) | Workspaces, Usuários, Financeiro | `workspaces-list-columns.tsx:158`, `admin-users-list.tsx:67-85`, `financial-movements.tsx:75` |
| T9 | Valores soltos em vez de tokens: `#fff` 57×, `#e4e4e4`, `rgba(5,5,5,.72/.8)`, raios 14/16/18/20/24 px, 2 nomes para o mesmo cinza | Todo `CSS/admin-*.css` | `admin-platform.css:26,29` |
| T10 | Breakpoints diferentes (560, 640, 760, 900, 1000, 1100) e sidebar/barra inferior com gatilhos distintos | CSS e navegação | `sidebar-nav.css:68` × `prototype.css:1245,1903` |
| T11 | Textos em caixa alta pequena (11–12 px, tracking .07–.08em) em cabeçalhos de tabela, diff e grupos | Atividades, Saúde, tabelas | `admin-activity.css:75`, `admin-health.css:21-22` |
| T12 | Ações destrutivas com o mesmo peso das demais, coladas | Usuário (Excluir × Suspender), Workspace (Remover), Comunidade (Remover), Notificações | `admin-user-actions.tsx:256-275`, `workspace-members-tab.tsx:121-139` |

Pontos que **não** são problema e devem ser preservados: título 32 px com migalhas, `AdminTabs` com setas/Home/End,
`AdminFilterBar` com chips e "Limpar", `AdminTable` responsivo (cartões no celular), tokens de contraste do Admin
(`--adm-text-muted` #5c5c5c; o `--muted` #7e7e7e do Início não passa de 4,5:1 e **não** deve ser copiado para o Admin).

### Comparação com o Início

Início: saudação em 40 px, no máximo 2 botões, uma faixa branca de 4 números **sem selos nem ícones**, seções com título +
uma linha de apoio + "Ver todas", estado vazio centralizado com uma ação. Admin: mesmo cartão (raio 28), mesma fonte
(Inter via `.pv`), mesmo preto/roxo — a identidade está igual. O que diverge é a **quantidade de elementos por tela**, não o
estilo. Notificações e Grupos (protótipo puro) usam raios de 32–34 px e título menor; o resto usa 28.

---

## 3. Auditoria por página (principais achados)

### Dashboard
- **Alta** — cada indicador tem selo de tipo + "i" (+ outro "i" no hint): ~45 acessórios para ~21 números (`admin-figure-card.tsx:67-97`).
- **Alta** — 5 seções com descrição longa que repete a regra do período (`dashboard-model.ts:103-224`).
- **Alta** — o seletor de período (segmento + datas + nota + "Atualizado em") pesa mais que o título (`admin-dashboard-page.tsx:37-45`).
- Média — "Precisa de atenção" repete tipo + gravidade + descrição + Regra + contagem + seta em 6 linhas e tem rodapé que duplica o "Ver todos" (`dashboard-attention.tsx:33-49,123-135`).
- Média — a linha do tempo reimplementa a de Atividades (`dashboard-activity.tsx` × `activity-feed.tsx`).

### Workspaces
- **Alta (lista)** — "Ativo" tem dois sentidos na mesma linha: selo de ciclo de vida e "Ativo · há 5 dias" (atividade). O filtro "Atividade" repete o segundo (`workspace-constants.ts:49-62`).
- Média — 9 colunas; quatro números parecidos (membros, criadores, campanhas, aportes); rótulo "Todos, exceto excluídos" (`workspaces-list-columns.tsx:99-203`).
- **Alta (detalhe)** — status, responsável, criado em e última atividade aparecem no cabeçalho **e** no Resumo (`workspace-detail-page.tsx:48-73`, `workspace-summary-tab.tsx:90-138`).
- **Alta** — aba Financeiro: 14 cartões em 4 grupos + tabela de 6 colunas com UUID cru (`workspace-financial-tab.tsx:44-171`).
- Média — "Editar dados" é primário e "Ações" secundário; "Excluir" no mesmo menu, sem separador; menu próprio (`workspace-actions-menu.tsx:93-111`).

### Usuários
- **Alta (lista)** — o seletor de workspace entra no slot da busca: não conta em "Filtros (n)", não vira chip, "Limpar" não o limpa (`admin-users-list.tsx:182-188`).
- Média — coluna "Tipo" mostra "Marca" em toda linha (é o filtro padrão); filtro "Tipo" escondido em "Filtros".
- **Alta (detalhe)** — até 4 botões no cabeçalho; "Excluir conta" (permanente) e "Suspender" são irmãos com o mesmo contorno vermelho (`admin-user-actions.tsx:256-275`).
- Média — e-mail, ID e cadastro duplicados entre cabeçalho e "Dados da conta"; "Dados da conta" acima das abas empurra o conteúdo.

### Equipe
- **Alta** — três cartões de papéis (~6 itens cada) antes da tabela de pessoas; quem vem gerenciar acesso vê primeiro permissões (`admin-team-page.tsx:143-167`).
- Média — seção "Papéis" vazia durante o carregamento (salto de layout); erro troca a página inteira; coluna "Situação" enquanto o Admin usa "Status"; cabeçalho da coluna de ações vazio, sem nome acessível.

### Campanhas
- **Alta (lista)** — 10 colunas; **"Orçamento" é sempre "Não apurado"** (a API devolve `unavailable`: `admin-campaigns.service.ts:23,690`); "Entregas publicadas" e "Pendências" com cabeçalho longo.
- Média — "Proprietário: X" repetido em toda linha; forma de pagamento no subtítulo e em filtro; seletor de workspace importado da pasta de Usuários (dependência cruzada) e fora de `filters`.
- **Alta (detalhe)** — workspace dito duas vezes (meta e seção com um único campo); "Financeiro" vem antes de "Resumo"; erro de "não encontrada" usa `EmptyState`, os outros detalhes usam `ErrorState`.

### Criadores
- **Alta** — a lista não tem `rowLink`: a linha é beco sem saída, ao contrário das outras listas.
- **Alta** — "Cadastro" aparece 4× com sentidos diferentes (segmento de estado, coluna de estado, data, filtro de data).
- Média — três abas misturam papéis: "Criadores" é lista; "Duplicados" e "Inconsistências" são relatórios de qualidade de dados; Duplicados reimplementa tabela com `div` e CSS próprio.
- Média — "Perfil da base" recolhido e depois do paginador; seletor de período próprio; "Filtros" esconde um único select em Duplicados; paginador renderizado com `total=0` enquanto carrega.

### Financeiro
- **Alta** — parágrafo de 60+ palavras em cartão branco antes dos números; 5 seções com descrição + "no período" repetido em 6 números + selo + "i".
- **Alta** — abas + seletor de período (7 opções + datas + linha de datas) + filtros próprios por aba.
- **Alta** — Movimentações usa segmento de 5 opções + seletor de workspace + "Limpar filtros" próprio em vez do `AdminFilterBar`.
- Média — o tipo do valor (Realizado/Comprometido) só em `title`; IDs copiáveis com alvo de 24 px.

### Comunidade
- **Alta** — aba Grupos reimplementa filtros e busca (`div.tools/.seg/.find`), sem rótulo na busca, estados à mão.
- **Alta** — diálogos de grupo sem foco preso; Esc fecha mesmo gravando (`pv-group.tsx:159-176`).
- Média — dois botões "Criar grupo" na aba Grupos; botão do cabeçalho muda por aba (Criar grupo ↔ Atualizar); "Remover" vermelho em cada publicação, fora do alcance no celular.

### Atividades
- **Alta** — abas → período → barra de filtros → cartão; Workspace e Autor são campos de busca misturados com selects; "Atualizar" no cabeçalho só faz refetch.
- Média — tipo dito 3× (ícone, rótulo, filtro); a descrição repete os 6 tipos que já estão no filtro; cabeçalho de diff em caixa alta 11,5 px.

### Notificações
- **Alta** — **não usa o kit**: cabeçalho, abas deslizantes e lista (`div` de 6 colunas sem cabeçalho) feitos à mão; título menor que o das outras telas.
- **Alta** — estados sem acessibilidade; CTA "Nova notificação" duplicado no vazio; aba vazia "Rascunhos" sugere criar em vez de limpar filtro.
- Média — "Falhou" e "Entrega parcial" escondidos dentro de "Enviadas"; rascunho só tem "Duplicar" (sem "Continuar"); confirmação inline muda a altura da linha.

### Saúde da plataforma
- **Alta** — filtro "Tipo" (Alertas/Sugestões) repete a divisão das duas seções logo abaixo e cria vazios "ocultos pelo filtro".
- **Alta** — cada alerta diz a gravidade 3× (selo, grupo, seção) e traz o bloco "Regra / Origem" (nomes de tabela) sempre aberto.
- Média — o estado do **sistema** (banco fora do ar) fica no fim, abaixo de listas longas; 3 indicadores de "verificado"; `role="status"` no relógio anuncia a cada 30 s.

### Navegação e celular
- Média — trilho (≤1100) e barra inferior (≤960/720) com gatilhos diferentes; menu móvel `aria-modal` sem `inert` quando fechado, foco não preso.
- No celular: abas de Criadores/Financeiro cortadas sem indício de rolagem; rótulo "Financeiro" da barra inferior truncado; cartão de criador com rede/seguidores desalinhados.

---

## 4. Proposta de arquitetura da informação

### 4.1 Papel de cada tipo de controle (regra única para todas as páginas)

| Tipo | Serve para | Onde fica | Exemplo |
|---|---|---|---|
| **Navegação principal** | trocar de área | sidebar (já reestruturada) | Workspaces → Usuários |
| **Abas** | trocar de **visão do mesmo objeto** (conteúdos diferentes) | logo abaixo do cabeçalho, sublinhadas (`AdminTabs`) | Financeiro: Visão geral · Movimentações · Por workspace |
| **Período** | recorte de tempo da página inteira | **um único** `AdminPeriodSelect` no cabeçalho, à direita | Dashboard, Financeiro, Atividades |
| **Filtros** | reduzir **a lista** | uma única `AdminFilterBar` acima da lista: segmento (1 dimensão principal) + busca + "Filtros (n)" | Workspaces: segmento por status |
| **Busca** | achar um item pelo texto | dentro da `AdminFilterBar` (`AdminSearchInput`, com rótulo) | — |
| **Ação primária** | criar/mudar algo | cabeçalho, à direita, **uma só**, botão preto | Nova notificação |
| **Ações secundárias** | tudo o mais | menu "⋯" (`AdminActionMenu`), itens destrutivos separados e vermelhos | Usuário: Mais ▾ |
| **Ação de linha** | agir sobre um item | menu "⋯" na última coluna ou clique na linha (`rowLink`) | Remover publicação |

Regras decorrentes: filtro **nunca** é aba e aba **nunca** é filtro; no máximo **dois** níveis de controle antes do conteúdo
(cabeçalho → barra); "Atualizar" sai do cabeçalho (vira ícone no fim da barra de filtros, ou refetch automático).

### 4.2 Anatomia única de página

```
AdminPageHeader   migalhas (só detalhe) · título 32 px · [selos] · 1 linha de apoio · [Período] [Ação primária] [⋯]
AdminTabs         (só se houver visões diferentes; sublinhadas; contagem opcional)
AdminFilterBar    segmento · busca · Filtros (n) · chips · Limpar · ↻
Conteúdo          AdminSection (cartão 28 px) com AdminTable / AdminFigureGrid / lista
Rodapé do conteúdo  AdminPager ou AdminLoadMore
```

Cabeçalho de **detalhe**: não repete no corpo o que já está no cabeçalho (status, responsável, criado em). O Resumo mostra
só o que o cabeçalho não mostra.

Indicadores (modelo do Início): número + rótulo + uma linha de apoio. Tipo do valor (Realizado, Posição atual…) e a regra
passam a viver **só no popover do "i" do rótulo** (`showKind={false}` na faixa). Uma explicação por seção, em uma linha.

### 4.3 Ajustes de organização por página (mudam de lugar, não somem)

| Página | Mudança proposta |
|---|---|
| Dashboard | descrições longas das seções saem; "Atualizado em" e nota do período fundem numa linha sob o título; alertas mostram só gravidade + título + contagem (regra fica na Saúde) |
| Workspaces | segmento "Todos · Ativos · Suspensos · Arquivados"; "Excluídos" vira filtro; filtro "Atividade" → "Uso recente"; lista com 6 colunas (Workspace, Responsável, Status, Campanhas, Aportes, Criado em); Membros/Criadores/Em custódia continuam no detalhe |
| Workspace (detalhe) | Resumo sem status/criado em/última atividade (já no cabeçalho); Financeiro com 6–8 indicadores e o resto em "Ver detalhes" |
| Usuários | seletor de workspace entra em `filters`; "Tipo" vira segmento; coluna "Tipo" some quando o filtro é "Marca"; detalhe: ação reversível visível + "Mais ▾" (Excluir conta separado, vermelho) |
| Equipe | **pessoas primeiro**, papéis recolhidos em "O que cada papel pode fazer"; linha leva ao usuário; "Situação" → "Status" |
| Campanhas | tirar a coluna Orçamento (sempre "Não apurado"); fundir Entregas e Pendências; "Proprietário:" some da linha; detalhe sem a seção "Workspace" (link na meta) e Resumo antes de Financeiro |
| Criadores | linha vira link para o usuário; "Cadastro" → segmento "Perfil" / coluna "Perfil" / data "Cadastrado em"; Duplicados e Inconsistências continuam abas (ver decisão D3) |
| Financeiro | aviso de 60 palavras vira "i" no título + uma linha; período único no cabeçalho; Movimentações usa `AdminFilterBar` |
| Comunidade | cabeçalho só com "Criar grupo"; "Atualizar" na barra do Feed; Grupos com `AdminFilterBar`/estados do kit; um só "Criar grupo" |
| Atividades | período no cabeçalho; Workspace/Autor viram selects da mesma barra; texto longo → "i" |
| Notificações | passa a usar `AdminPage`/`AdminPageHeader`/`AdminTabs`/`AdminTable`/estados do kit; "Falhou" e "Parcial" visíveis (filtro de status); rascunho ganha "Continuar" |
| Saúde | sem filtro "Tipo" (as seções já separam); gravidade dita uma vez; "Regra/Origem" recolhido; **estado do sistema no topo** |

---

## 5. Padronização de componentes

### 5.1 Já existe — adotar onde falta
`AdminPage`, `AdminPageHeader`, `AdminTabs`, `AdminFilterBar`, `AdminSearchInput`, `AdminTable`, `AdminPager`, `AdminSection`,
`AdminFigureCard/Grid`, `AdminEmptyState`, `AdminErrorState`, `AdminSkeleton`, `AdminStatusBadge`, `AdminConfirmDialog`,
`AdminInfoPopover`, `AdminKeyValueList`, `AdminEntityCell`, `AdminAlertItem` (hoje usado por nenhuma tela de alerta).

### 5.2 Novos no kit (cada um substitui cópias locais)
| Componente | Substitui | Onde |
|---|---|---|
| `AdminPeriodSelect` | `FinancialPeriodSelect`, `DashboardPeriodSelector`, `WorkspacePeriodSelector`, período de Criadores/Atividades | financeiro, dashboard, workspace, criadores, atividades |
| `AdminActionMenu` (dropdown acessível: setas, Esc, item destrutivo separado) | `workspace-actions-menu`, botões soltos de linha | workspace, usuário, comunidade, notificações |
| `AdminDialog` / `AdminDrawer` sobre `useModalBehavior` | `PvOverlay`, `ovd` da notificação, `sh-h` do grupo, confirmações `hdx-cf` | comunidade, notificações |
| `adminToast` (sucesso/erro padronizados, `role=status`) | 36 usos de `sonner` direto | todo o Admin |
| `AdminRefreshButton` | 5 cópias (`adm-act/health/fin-refresh`, comunidade, notificações) | atividades, saúde, financeiro, comunidade |
| `AdminListSkeleton` + `AdminLoadMore` | 6 esqueletos e 2 "Carregar mais" próprios | dashboard, atividades, saúde, financeiro |
| `AdminTimeline` | linha do tempo de Dashboard, Atividades, Workspace, Usuário | 4 lugares |
| `AdminEntityPicker` (pílula + popover com busca) | seletor de workspace, de ator, de conta da Equipe | usuários, campanhas, atividades, equipe |
| `AdminNotFound` | 3 variações de "não encontrado" | 3 detalhes |
| `AdminTooltip` (ou `title` + foco) para botões só-ícone | `aria-label` sem dica | todo o Admin |

Extensões de componentes existentes: `AdminFigureCard showKind={false}`; `AdminFilterBar` filtro `kind:"custom"`; `AdminTable`
com limite de colunas configurável (`hideBelow`); `AdminTable` com linha expansível; botão `danger-out` promovido ao kit.

### 5.3 Estados — padrão único
Carregando = `AdminSkeleton` (nunca "Carregando…" solto); vazio = `AdminEmptyState` com **uma** ação (e, quando há filtro
ativo, a ação é "Limpar filtros"); erro = `AdminErrorState` com `onRetry` e `role=alert`; sucesso/erro de ação = `adminToast`.

---

## 6. Diretrizes visuais (preservar o Início)

Sem mudar tipografia, paleta, identidade nem proporções. Só **tokenizar** o que hoje está solto:
- `--adm-surface` (#fff), `--adm-hover`, `--adm-ring` (foco), `--adm-brand-text` (#7a1fc4), `--adm-shadow-pop`.
- Raios: `--adm-r-sm 12`, `--adm-r-md 16`, `--adm-r-lg 28` (hoje 14/16/18/20/24 soltos).
- Unificar `--adm-muted-strong` e `--adm-text-muted` (mesmo #5c5c5c).
- Breakpoints fixos: **≤560** (celular), **≤900** (tablet), **≤1100** (trilho); sidebar e barra inferior no mesmo gatilho.
- Cabeçalhos de tabela/grupo em frase normal, 12,5 px (sai a caixa alta de 11–12 px).
- Menos cartões: seção sem descrição não repete o título; sem borda dupla; sombra só em popover.
- Alvo de toque ≥ 40 px (≥ 44 px no celular) para ações de linha e copiar.

---

## 7. Acessibilidade e usabilidade (itens que entram no escopo)

Foco preso e `aria-modal` em todos os diálogos; Esc/backdrop travados enquanto grava; `inert` no menu móvel fechado; `<label>`
real em toda busca; `aria-live` em listas que mudam; dica essencial nunca só em `title`; `role=status` só para o que muda de
fato (tirar do relógio da Saúde); nome acessível em coluna de ações; `aria-current="step"` nos passos; cabeçalhos de página com
`document.title` (já existe).

---

## 8. Decisões que dependem de você

Nada abaixo é feito sem o seu aval, porque remove ou muda de lugar algo que existe hoje.

- **D1 — Coluna "Orçamento" (Campanhas):** hoje é sempre "Não apurado" (o banco não tem orçamento). *Proposta:* tirar da lista e do detalhe; volta quando existir o dado.
- **D2 — Filtro "Tipo" da Saúde:** repete as seções. *Proposta:* remover; as seções já filtram.
- **D3 — Duplicados e Inconsistências (Criadores):** são relatórios de qualidade de dados, não lista de criadores. *Proposta A (mais segura):* manter como abas, só padronizar. *Proposta B:* mover para a Saúde.
- **D4 — Equipe:** inverter a ordem (pessoas primeiro, papéis recolhidos). *Proposta:* sim.
- **D5 — Workspaces: "Excluídos" e "Todos, exceto excluídos":** segmento passa a "Todos · Ativos · Suspensos · Arquivados" e "Excluídos" vira filtro. *Proposta:* sim.
- **D6 — Colunas da lista de Workspaces (9 → 6):** Membros, Criadores e Em custódia ficam só no detalhe. *Proposta:* sim, se você confirmar que ninguém usa essas colunas na lista.
- **D7 — "Atualizar" sai do cabeçalho** (vira ícone na barra de filtros). *Proposta:* sim.
- **D8 — Notificações:** trocar a lista por `AdminTable` (muda a aparência de 6 colunas de `div`). *Proposta:* sim; mantém todas as ações.
- **D9 — Exclusão de conta no detalhe do usuário:** passa para o menu "Mais" (continua com a mesma confirmação). *Proposta:* sim.

---

## 9. Plano de execução

Cada onda termina com `tsc` + testes + conferência visual (desktop, 900, 375) e pode ser publicada sozinha.

0. **Tokens e breakpoints** — só CSS: tokens, raios, breakpoints, caixa alta, foco. Sem mudar markup.
1. **Kit** — os 10 componentes novos + as extensões, cada um com teste (teclado, foco, estados). Nenhuma tela muda ainda.
2. **Cabeçalho, período e filtros** — `AdminPeriodSelect` + `AdminFilterBar` em Dashboard, Financeiro, Atividades, Usuários, Campanhas, Criadores, Comunidade; "Atualizar" para a barra.
3. **Estados e feedback** — esqueleto/vazio/erro/toast do kit em todo o Admin; diálogos migrados para `AdminDialog`.
4. **Telas que não usam o kit** — Notificações e Comunidade › Grupos.
5. **Redundância e densidade** — Dashboard e Financeiro (selos, "i", textos), Saúde, Workspaces, Usuários, Equipe, Campanhas, Criadores (conforme decisões D1–D9).
6. **Ações** — `AdminActionMenu` em workspace, usuário, comunidade, notificações.
7. **Verificação final** — varredura de responsividade e acessibilidade nas 11 páginas, comparação com o Início, relatório.

### Fora do escopo (preservado)
Regras de negócio, permissões, consultas, contrato da API (`admin-platform.types.ts`), rotas, banco de dados, textos de
definição vindos do backend, comportamento de ações (suspender, arquivar, excluir, creditar…). Toda mudança é de
apresentação, organização e acessibilidade; nenhuma funcionalidade some sem estar na lista de decisões acima.

---

## 10. Execução (2026-11-03)

Decisões D1–D9 aprovadas e aplicadas. Estado no worktree `feat/ux-backoffice`: `tsc -b` limpo e suíte completa verde (178 arquivos, 2729 testes). Conferência visual no navegador (API simulada) em 1440, 900 e 375 px; sem rolagem horizontal em nenhuma das 11 páginas no celular.

**Kit (src/components/admin/platform):** AdminPeriodSelect, AdminRefreshButton, AdminActionMenu, AdminIconButton/AdminTooltip, AdminDialog/AdminDrawer, adminToast, AdminListSkeleton, AdminLoadMore, AdminTimeline (+ groupTimelineByDay), AdminNotFound, AdminEntityPicker; extensões em AdminFigureCard (showKind), AdminFilterBar (custom, toggle, inline, trailing, segmentDefault, searchLabel), AdminTable (hideBelow, renderExpanded, rowActions, headerLabel), AdminInfoPopover (triggerLabel, prefix, Paragraph), AdminKeyValueList (strip), AdminAlertItem, AdminEntityCell, AdminStatusBadge (notification). Tokens e breakpoints (≤560, ≤900, ≤1100) em `admin-platform.css`.

**Mudanças de comportamento a saber**
- Período personalizado com datas invertidas: aviso e o período anterior continua (antes a outra ponta era empurrada).
- Workspaces: ordenar por membros só pela URL (a coluna saiu da lista, D6).
- Notificações: nova aba "Com falha" (falhou + entrega parcial); "Enviadas" ficou só com enviado/enviando.
- Ids de movimentações do Financeiro ficam na linha expandida; motivo de eventos na linha do tempo fica em "Ver detalhes".
- Criadores: a linha agora leva a `/admin/users/$userId`.
- Rótulo do selo da Saúde: "Banco e Redis operando" (é o que ele mede).

**Pendências conhecidas**
- Rascunho de notificação continua só com "Duplicar" (a API não tem edição de rascunho).
- Formulário de notificação e diálogos de grupo seguem na casca `ovd` do protótipo (com foco preso via `useModalBehavior`); o `AdminDialog` não comporta o assistente largo com prévia lateral.
- Notificações usa abas para status: pela regra "filtro nunca é aba" deveria ser um segmento da barra de filtros; ficou como está por precisar de contagem no segmento.
- Atualizar (ícone) ainda não existe em Dashboard, Equipe e Notificações.
- Atalhos e texto de resumo do período diferem entre telas (mudar os atalhos muda o que a URL aceita).
- Código morto antigo em `src/components/groups/` (anterior a esta mudança) e `periodLabel`/`periodQueryString` em `lib/admin/period.ts` sem uso fora de testes.
- Notificações, Equipe e Comunidade só foram vistas vazias no navegador (o mock não tem esses dados); o resto é coberto por testes.
