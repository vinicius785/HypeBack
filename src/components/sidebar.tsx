import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Av, I } from "@/components/prototype/ui";
import { WorkspaceStatusChip } from "@/components/workspace-state/workspace-status-chip";
import hypeappLogoBranca from "@/assets/images/hypeapp-logo-branca.svg";
import {
  useWorkspaceContext,
  useWorkspacePermissions,
} from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useScrollEdges } from "@/hooks/admin/use-scroll-edges";
import { useCampaigns } from "@/hooks/use-campaigns";
import { isPlatformAdmin } from "@/lib/utils/platform-admin";
import { getUploadUrl } from "@/lib/utils/api";
import { clearClientSession } from "@/lib/utils/session";
import { logout } from "@/shared/services/auth";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";
import type { Workspace, WorkspaceRole } from "@/shared/types";

import "@/styles/admin-platform.css";

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  aprovador: "Aprovador",
  observador: "Observador",
  juridico: "Jurídico",
  financeiro: "Financeiro",
  analista: "Analista",
};

const BRAND_COLORS = ["#9e2cfa", "#050505", "#7e7e7e"];

export function isCampaignScopedPath(pathname: string): boolean {
  if (!pathname.startsWith("/campaigns/")) return false;
  const rest = pathname.slice("/campaigns/".length);
  return rest.length > 0 && !rest.startsWith("new");
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Círculo do workspace (`.brand`), com foto quando existir e iniciais como reserva. */
export function Brand({ ws, index }: { ws: Workspace; index: number }) {
  const photo = ws.photo ? getUploadUrl(ws.photo) : undefined;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);
  return (
    <span
      className="brand"
      style={{ background: BRAND_COLORS[index % BRAND_COLORS.length], overflow: "hidden" }}
    >
      {photo && !broken ? (
        <img
          src={photo}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setBroken(true)}
        />
      ) : (
        initialsOf(ws.name)
      )}
    </span>
  );
}

/** Sair da conta: encerra a sessão na API e limpa o estado local. */
export function useLogout() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearClientSession(queryClient);
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    },
  });
  return () => mutate();
}

/**
 * O menu serve a duas áreas: o app do workspace e o Admin da plataforma (`/admin/*`). No Admin ele não
 * mostra o que é do workspace (switcher, Início, Campanhas…) e nada ali mexe no workspace selecionado.
 */
export type NavScope = "workspace" | "platform";

export interface AdminNavItem {
  label: string;
  /** Nome do mapa `I` (`components/prototype/ui.tsx`). */
  icon: string;
  href: string;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
}

/**
 * Menu do Admin da plataforma, em duas áreas. Os caminhos são os das rotas (`/admin/<recurso>`); a de
 * Comunidade segue em `/admin/groups`. Ícones do mapa `I`, todos distintos entre si (Comunidade não repete
 * o de Criadores nem o de Usuários).
 */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "administracao",
    label: "Administração",
    items: [
      { label: "Dashboard", icon: "chart", href: "/admin/dashboard" },
      { label: "Workspaces", icon: "box", href: "/admin/workspaces" },
      { label: "Usuários", icon: "user", href: "/admin/users" },
      { label: "Campanhas", icon: "mega", href: "/admin/campaigns" },
      { label: "Criadores", icon: "star", href: "/admin/creators" },
      { label: "Financeiro", icon: "banknote", href: "/admin/financial" },
      { label: "Comunidade", icon: "msg", href: "/admin/groups" },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    items: [
      { label: "Atividades", icon: "clock", href: "/admin/activity" },
      { label: "Notificações", icon: "bell", href: "/admin/notifications" },
      { label: "Saúde da plataforma", icon: "shield", href: "/admin/health" },
    ],
  },
];

/**
 * No app do workspace o Admin é uma entrada só: "Visão ADM", sob o divisor "Backoffice". Ela leva ao Admin,
 * onde o menu passa para o escopo `platform` e mostra todas as áreas (`ADMIN_NAV_GROUPS`).
 */
export const BACKOFFICE_NAV_GROUP: AdminNavGroup = {
  id: "backoffice",
  label: "Backoffice",
  items: [{ label: "Visão ADM", icon: "shield", href: "/admin/dashboard" }],
};

/** Itens de navegação (e permissões) compartilhados pela sidebar e pelo menu do celular. */
export function useNavItems(scope: NavScope = "workspace") {
  const permissions = useWorkspacePermissions();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { selectedWorkspace } = useWorkspaceContext();
  const showPlatformAdmin = isPlatformAdmin(user);

  // O número de campanhas ativas é do workspace: no Admin nem se busca (nem com o workspace suspenso, que
  // recusa toda chamada).
  const { data: campaigns = [] } = useCampaigns({
    enabled:
      scope === "workspace" &&
      !!selectedWorkspace &&
      selectedWorkspace.status !== "suspended" &&
      permissions.campaigns_read,
  });
  const activeCampaigns = campaigns.filter((c: { status?: unknown }) => {
    const v = getCampaignStatusValue(c.status);
    return v === "active" || v === "published";
  }).length;

  // Ativo também nas rotas filhas (`/admin/workspaces/:id` acende "Workspaces").
  const isOn = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const menus: Array<[string, string, string, boolean, number?]> =
    scope === "platform"
      ? []
      : [
          ["Início", "grid", "/", true],
          ["Campanhas", "mega", "/campaigns", !!permissions.campaigns_read, activeCampaigns],
          ["Criadores", "users", "/creators", !!permissions.catalog_read],
          ["Lives", "video", "/lives", !!permissions.community_lives_read],
          ["Financeiro", "wallet", "/financial", !!permissions.financial_read],
        ];
  // Fora do Admin, só a porta de entrada; dentro dele, todas as áreas.
  const adminGroups: readonly AdminNavGroup[] = !showPlatformAdmin
    ? []
    : scope === "platform"
      ? ADMIN_NAV_GROUPS
      : [BACKOFFICE_NAV_GROUP];

  return { menus, adminGroups, showPlatformAdmin, isOn };
}

/**
 * Menu lateral — marcação e CSS idênticos ao protótipo.
 *
 * `scope="platform"` (layout do Admin): no lugar do seletor de workspace entra um bloco fixo "Admin da
 * plataforma" — o seletor mexeria no `workspaceId` guardado, e o Admin não usa workspace —, os itens do
 * workspace saem e um "Voltar ao app" leva de volta. Nada neste escopo chama `selectWorkspace`.
 */
export function Sidebar({ scope = "workspace" }: { scope?: NavScope }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaces, selectedWorkspace, selectWorkspace } = useWorkspaceContext();
  const { menus, adminGroups, isOn } = useNavItems(scope);
  const platform = scope === "platform";
  const [open, setOpen] = useState(false);
  const wswRef = useRef<HTMLDivElement>(null);
  const doLogout = useLogout();
  // A lista de itens rola quando é mais alta que a tela; a linha fina na borda mostra que ela continua.
  const { ref: navRef, edges: navEdges } = useScrollEdges<HTMLElement>();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wswRef.current && !wswRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (ws: Workspace) => {
    selectWorkspace(ws);
    setOpen(false);
    if (isCampaignScopedPath(pathname)) {
      navigate({ to: "/campaigns", replace: true });
    }
  };

  const go = (to: string) => navigate({ to });

  const wsIndex = Math.max(
    0,
    workspaces.findIndex((w) => w.id === selectedWorkspace?.id),
  );
  const roleOf = (ws?: Workspace) => (ws?.role ? (ROLE_LABEL[ws.role] ?? ws.role) : "");

  return (
    // `minHeight: 0`: este div é o item da grade do layout, e sem isso a linha da grade cresce até a altura do
    // menu (o mínimo automático de um item é o conteúdo dele) em vez de ficar na altura da tela. Com o menu
    // limitado à tela, a lista de itens (`.adm-nav`) rola sozinha e o logo e o perfil ficam à vista.
    <div className="pv" style={{ height: "100%", minHeight: 0 }}>
      <aside className={`side${platform ? " adm-side" : ""}`} style={{ height: "100%" }}>
        <div className="logo">
          <img src={hypeappLogoBranca} alt="HypeApp" />
        </div>

        <div className={`wsw ${open ? "open" : ""}`} ref={wswRef}>
          {platform ? (
            <div className="wsb adm-ws-static" role="group" aria-label="Área atual: Admin da plataforma" title="Admin da plataforma">
              <span className="brand">
                <I n="shield" />
              </span>
              <div>
                <b>Admin da plataforma</b>
                <small>Visão global</small>
              </div>
            </div>
          ) : selectedWorkspace ? (
            <>
              <button
                type="button"
                className="wsb"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <Brand ws={selectedWorkspace} index={wsIndex} />
                <div>
                  <b>{selectedWorkspace.name}</b>
                  <small>
                    {roleOf(selectedWorkspace)}
                    <WorkspaceStatusChip status={selectedWorkspace.status} />
                  </small>
                </div>
                <I n="chev" cls="sm" />
              </button>
              <div className="wsl" role="listbox">
                <h6>Seus workspaces</h6>
                {workspaces.map((x, k) => {
                  const on = x.id === selectedWorkspace.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`wso ${on ? "on" : ""}`}
                      onClick={() => pick(x)}
                    >
                      <Brand ws={x} index={k} />
                      <div>
                        <b>{x.name}</b>
                        <small>
                          {roleOf(x)}
                          <WorkspaceStatusChip status={x.status} />
                        </small>
                      </div>
                      {on && (
                        <i className="wsc">
                          <I n="check" cls="sm" />
                        </i>
                      )}
                    </button>
                  );
                })}
                <div className="wsd" />
                <button
                  type="button"
                  className="wsa"
                  onClick={() => {
                    setOpen(false);
                    go("/workspace/settings");
                  }}
                >
                  <span className="wsi">
                    <I n="gear" cls="sm" />
                  </span>
                  Configurações
                </button>
                <button
                  type="button"
                  className="wsa"
                  onClick={() => {
                    setOpen(false);
                    go("/onboarding/create-workspace");
                  }}
                >
                  <span className="wsi">
                    <I n="plus" cls="sm" />
                  </span>
                  Novo workspace
                </button>
              </div>
            </>
          ) : (
            <div className="wsb" style={{ justifyContent: "center", color: "var(--dim)" }}>
              Sem workspaces
            </div>
          )}
        </div>

        <nav
          ref={navRef}
          className="nav adm-nav"
          aria-label={platform ? "Navegação do Admin" : "Navegação principal"}
          data-more-before={navEdges.before ? "true" : undefined}
          data-more-after={navEdges.after ? "true" : undefined}
        >
          {menus.length > 0 ? (
            <div className="adm-nav-group">
              {menus
                .filter((m) => m[3])
                .map(([label, icon, href, , n]) => (
                  <button
                    key={label}
                    type="button"
                    className={isOn(href) ? "on" : ""}
                    aria-label={n ? `${label} (${n})` : label}
                    aria-current={isOn(href) ? "page" : undefined}
                    title={label}
                    onClick={() => go(href)}
                  >
                    <I n={icon} />
                    <span>{label}</span>
                    {n ? <b className="n">{n}</b> : null}
                  </button>
                ))}
            </div>
          ) : null}
          {adminGroups.map((group) => (
            <div key={group.id} className="adm-nav-group" role="group" aria-labelledby={`adm-nav-${group.id}`}>
              <h6 id={`adm-nav-${group.id}`}>{group.label}</h6>
              {group.items.map(({ label, icon, href }) => (
                <button
                  key={href}
                  type="button"
                  className={isOn(href) ? "on" : ""}
                  aria-label={label}
                  aria-current={isOn(href) ? "page" : undefined}
                  title={label}
                  onClick={() => go(href)}
                >
                  <I n={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="spacer" />

        {platform ? (
          <button type="button" className="adm-nav-exit" aria-label="Voltar ao app" title="Voltar ao app" onClick={() => go("/")}>
            <I n="back" />
            <span>Voltar ao app</span>
          </button>
        ) : null}

        <div
          className="me"
          title="Meu perfil"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest(".me-out")) return;
            go("/settings");
          }}
        >
          <Av
            name={user?.name ?? "Perfil"}
            src={user?.avatar != null ? String(user.avatar) : undefined}
            size={38}
          />
          <div>
            <b>{user?.name ?? "—"}</b>
            <small>{platform ? "Administrador" : roleOf(selectedWorkspace)}</small>
          </div>
          <button
            type="button"
            className="me-out"
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={() => doLogout()}
          >
            <svg
              className="ico"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>
    </div>
  );
}
