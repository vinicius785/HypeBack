import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { Av, I } from "@/components/prototype/ui";
import {
  useWorkspaceContext,
  useWorkspacePermissions,
} from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useCampaigns } from "@/hooks/use-campaigns";
import { isPlatformAdmin } from "@/lib/utils/platform-admin";
import { getUploadUrl, removeAuthToken } from "@/lib/utils/api";
import { logout } from "@/shared/services/auth";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";
import type { Workspace, WorkspaceRole } from "@/shared/types";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
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

function isCampaignScopedPath(pathname: string): boolean {
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
function Brand({ ws, index }: { ws: Workspace; index: number }) {
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

/** Menu lateral — marcação e CSS idênticos ao protótipo. */
export function Sidebar() {
  const permissions = useWorkspacePermissions();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaces, selectedWorkspace, selectWorkspace } = useWorkspaceContext();
  const showPlatformAdmin = isPlatformAdmin(user);
  const [open, setOpen] = useState(false);
  const wswRef = useRef<HTMLDivElement>(null);

  const { data: campaigns = [] } = useCampaigns({
    enabled: !!selectedWorkspace && permissions.campaigns_read,
  });
  const activeCampaigns = campaigns.filter((c: { status?: unknown }) => {
    const v = getCampaignStatusValue(c.status);
    return v === "active" || v === "published";
  }).length;

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

  const { mutate: doLogout } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      removeAuthToken();
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    },
  });

  const pick = (ws: Workspace) => {
    selectWorkspace(ws);
    setOpen(false);
    if (isCampaignScopedPath(pathname)) {
      navigate({ to: "/campaigns", replace: true });
    }
  };

  const go = (to: string) => navigate({ to });
  const isOn = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const menus: Array<[string, string, string, boolean, number?]> = [
    ["Início", "grid", "/", true],
    ["Campanhas", "mega", "/campaigns", !!permissions.campaigns_read, activeCampaigns],
    ["Criadores", "users", "/creators", !!permissions.catalog_read],
    ["Lives", "video", "/lives", !!permissions.community_lives_read],
    ["Financeiro", "wallet", "/financial", !!permissions.financial_read],
  ];
  const admin: Array<[string, string, string]> = [
    ["Dashboard", "shield", "/admin/dashboard"],
    ["Notificações", "bell", "/admin/notifications"],
    ["Grupos", "users", "/admin/groups"],
  ];

  const wsIndex = Math.max(
    0,
    workspaces.findIndex((w) => w.id === selectedWorkspace?.id),
  );
  const roleOf = (ws?: Workspace) => (ws?.role ? (ROLE_LABEL[ws.role] ?? ws.role) : "");

  return (
    <div className="pv" style={{ height: "100%" }}>
      <aside className="side" style={{ height: "100%" }}>
        <div className="logo">
          <i>h</i>
          <span>hypeapp</span>
        </div>

        <div className={`wsw ${open ? "open" : ""}`} ref={wswRef}>
          {selectedWorkspace ? (
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
                  <small>{roleOf(selectedWorkspace)}</small>
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
                        <small>{roleOf(x)}</small>
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

        <nav className="nav">
          {menus
            .filter((m) => m[3])
            .map(([label, icon, href, , n]) => (
              <button
                key={label}
                type="button"
                className={isOn(href) ? "on" : ""}
                onClick={() => go(href)}
              >
                <I n={icon} />
                <span>{label}</span>
                {n ? <b className="n">{n}</b> : null}
              </button>
            ))}
          {showPlatformAdmin && (
            <>
              <h6>Admin da plataforma</h6>
              {admin.map(([label, icon, href]) => (
                <button
                  key={label}
                  type="button"
                  className={isOn(href) ? "on" : ""}
                  onClick={() => go(href)}
                >
                  <I n={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="spacer" />

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
            <small>{roleOf(selectedWorkspace)}</small>
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
