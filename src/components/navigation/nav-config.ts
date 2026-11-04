/**
 * Configuração de navegação de cada ambiente. O componente `SidebarNav` (menu lateral) e a `MobileNav` (barra
 * inferior + gaveta) só desenham o que está aqui: itens, ordem, agrupamento, rotas e a regra de visibilidade
 * de cada item moram neste arquivo e em nenhum outro.
 *
 * Os dois ambientes têm configurações independentes de propósito: o Admin da plataforma é a central da equipe
 * Hype; o Workspace é o dia a dia do cliente e não replica a estrutura administrativa.
 */

/** O menu serve a duas áreas: o app do workspace e o Admin da plataforma (`/admin/*`). */
export type NavScope = "workspace" | "platform";

/** Permissões do workspace que decidem a visibilidade de um item (as mesmas de `useWorkspacePermissions`). */
export type NavPermission = "campaigns_read" | "catalog_read" | "community_lives_read" | "financial_read";

export interface NavItem {
  /** Estável: serve de chave e de ponto de apoio nos testes; não muda quando o rótulo muda. */
  id: string;
  label: string;
  /** Nome do mapa `I` (`components/prototype/ui.tsx`). */
  icon: string;
  /** Caminho da rota existente. Nenhum item aponta para uma página que não exista. */
  href: string;
  /** Só aparece quando o usuário tem esta permissão no workspace selecionado. */
  permission?: NavPermission;
  /** Só aparece para a equipe da plataforma (admin, suporte ou somente leitura); o backend segue sendo a barreira real (403). */
  platformStaffOnly?: boolean;
  /** Só aparece quando o workspace selecionado é de agência (`account_type = agency`); o backend responde 403 nos demais. */
  agencyOnly?: boolean;
  /** Atalho fixo da barra inferior do celular; o resto fica na gaveta "Mais". */
  pinned?: boolean;
  /** Mostra o número de campanhas ativas do workspace como selo. */
  badge?: "activeCampaigns";
}

export interface NavSection {
  id: string;
  label: string;
  items: readonly NavItem[];
}

/**
 * Workspace (clientes). O "Backoffice" é a porta para o Admin da plataforma e só existe para quem é da equipe
 * Hype: sem ele, o cliente nunca vê a palavra. A estrutura do Admin não é replicada aqui.
 */
export const WORKSPACE_NAV: readonly NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [{ id: "home", label: "Início", icon: "grid", href: "/", pinned: true }],
  },
  {
    id: "campanhas",
    label: "Gestão de campanhas",
    items: [
      { id: "brands", label: "Marcas", icon: "box", href: "/brands", permission: "campaigns_read", agencyOnly: true },
      { id: "campaigns", label: "Campanhas", icon: "mega", href: "/campaigns", permission: "campaigns_read", pinned: true, badge: "activeCampaigns" },
      { id: "creators", label: "Criadores", icon: "users", href: "/creators", permission: "catalog_read", pinned: true },
      { id: "lives", label: "Lives", icon: "video", href: "/lives", permission: "community_lives_read" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [{ id: "financial", label: "Financeiro", icon: "wallet", href: "/financial", permission: "financial_read", pinned: true }],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [{ id: "backoffice", label: "Backoffice", icon: "shield", href: "/admin/dashboard", platformStaffOnly: true }],
  },
];

/**
 * Admin da plataforma. A Comunidade segue em `/admin/groups`. Os ícones são todos distintos entre si.
 */
export const PLATFORM_NAV: readonly NavSection[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    items: [{ id: "dashboard", label: "Dashboard", icon: "chart", href: "/admin/dashboard", pinned: true }],
  },
  {
    id: "gestao",
    label: "Gestão da plataforma",
    items: [
      { id: "workspaces", label: "Workspaces", icon: "box", href: "/admin/workspaces", pinned: true },
      { id: "users", label: "Usuários", icon: "user", href: "/admin/users", pinned: true },
      { id: "team", label: "Equipe", icon: "users", href: "/admin/team" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "campaigns", label: "Campanhas", icon: "mega", href: "/admin/campaigns" },
      { id: "creators", label: "Criadores", icon: "star", href: "/admin/creators" },
      { id: "financial", label: "Financeiro", icon: "banknote", href: "/admin/financial", pinned: true },
      { id: "community", label: "Comunidade", icon: "msg", href: "/admin/groups" },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    items: [
      { id: "activity", label: "Atividades", icon: "clock", href: "/admin/activity" },
      { id: "notifications", label: "Notificações", icon: "bell", href: "/admin/notifications" },
      { id: "health", label: "Saúde da plataforma", icon: "shield", href: "/admin/health" },
    ],
  },
];

export const NAV_BY_SCOPE: Record<NavScope, readonly NavSection[]> = {
  workspace: WORKSPACE_NAV,
  platform: PLATFORM_NAV,
};

/** Seção já filtrada por permissão, com o selo calculado: o que de fato aparece para este usuário. */
export interface VisibleNavItem extends NavItem {
  /** Número do selo (0 e `undefined` não desenham nada). */
  count?: number;
}

export interface VisibleNavSection {
  id: string;
  label: string;
  items: readonly VisibleNavItem[];
}
