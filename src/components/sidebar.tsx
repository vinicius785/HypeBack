import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SIGNUP_ENABLED } from "@/shared/constants/signup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Av, I } from "@/components/prototype/ui";
import { WorkspaceStatusChip } from "@/components/workspace-state/workspace-status-chip";
import hypeappLogoBranca from "@/assets/images/hypeapp-logo-branca.svg";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { getUploadUrl } from "@/lib/utils/api";
import { clearClientSession } from "@/lib/utils/session";
import { logout } from "@/shared/services/auth";
import type { Workspace, WorkspaceRole } from "@/shared/types";

import type { NavScope } from "@/components/navigation/nav-config";
import { useRailTooltip } from "@/components/navigation/rail-tooltip";
import { SidebarNav, cascadeOf } from "@/components/navigation/sidebar-nav";
import { useNavSections } from "@/components/navigation/use-nav-sections";

import "@/styles/admin-sidebar-motion.css";
import "@/styles/sidebar-nav.css";

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  aprovador: "Aprovador",
  observador: "Observador",
  juridico: "Jurídico",
  financeiro: "Financeiro",
  analista: "Analista",
  cliente: "Cliente",
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

/** Papel na equipe da plataforma, curto, para o perfil do menu (uma linha só). Sem papel conhecido, "Administrador". */
const PLATFORM_ROLE_SHORT = { admin: "Administrador", support: "Suporte", viewer: "Somente leitura" } as const;

/**
 * Escopo do menu que está montado agora (ou `null` se não há nenhum). O menu do Admin e o do app são de layouts
 * diferentes: ao passar de um para o outro o novo monta na mesma troca em que o antigo sai, então na primeira
 * renderização do novo isto ainda guarda o escopo do antigo (a limpeza do efeito dele só roda depois).
 */
let mountedScope: NavScope | null = null;

/**
 * "Voltar ao app": o menu do Admin sai (cascata de baixo para cima, `adm-leaving`) e só então a rota troca, para o
 * menu do app entrar animado em seguida. O tempo cobre a saída inteira (o teste do CSS confere a conta).
 */
export const LEAVE_MS = 230;
/** Se a rota não trocar depois da saída (navegação recusada), o menu do Admin volta ao normal. */
const LEAVE_RESTORE_MS = 1500;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Menu lateral — marcação e CSS idênticos ao protótipo, com os grupos vindos da configuração do ambiente
 * (`navigation/nav-config.ts`).
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
  const { sections, isOn } = useNavSections(scope);
  const platform = scope === "platform";
  // Veio do Admin? Lido uma vez, na primeira renderização (depois o menu fica como está).
  const [fromAdmin] = useState(() => !platform && mountedScope === "platform");
  useEffect(() => {
    mountedScope = scope;
    return () => {
      mountedScope = null;
    };
  }, [scope]);
  // O menu do Admin sempre entra animado, e o do app só quando chega do Admin: com a cascata, cada título e item
  // leva a sua vez (`--i`) e o "Voltar ao app" a última.
  const cascade = platform || fromAdmin ? cascadeOf(sections) : null;
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);
  const wswRef = useRef<HTMLDivElement>(null);
  const doLogout = useLogout();
  const { handlers: tipHandlers, element: tip } = useRailTooltip();

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

  // Enquanto o menu do Admin sai, nenhum clique navega (senão pisaria na volta ao app, que já está a caminho).
  const go = (to: string) => {
    if (!leaving) navigate({ to });
  };

  // "Voltar ao app": o menu sai primeiro e a rota troca depois; com movimento reduzido, a troca é na hora.
  const backToApp = () => {
    if (leaving) return;
    if (prefersReducedMotion()) navigate({ to: "/" });
    else setLeaving(true);
  };
  useEffect(() => {
    if (!leaving) return;
    const leave = setTimeout(() => navigate({ to: "/" }), LEAVE_MS);
    const restore = setTimeout(() => setLeaving(false), LEAVE_RESTORE_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(restore);
    };
  }, [leaving, navigate]);

  const wsIndex = Math.max(
    0,
    workspaces.findIndex((w) => w.id === selectedWorkspace?.id),
  );
  const roleOf = (ws?: Workspace) => (ws?.role ? (ROLE_LABEL[ws.role] ?? ws.role) : "");

  return (
    // `minHeight: 0`: este div é o item da grade do layout, e sem isso a linha da grade cresce até a altura do
    // menu (o mínimo automático de um item é o conteúdo dele) em vez de ficar na altura da tela. Com o menu
    // limitado à tela, a lista de itens (`.sb-nav`) rola sozinha e o logo e o perfil ficam à vista.
    <div className="pv" style={{ height: "100%", minHeight: 0 }}>
      <aside
        className={`side sb-side${platform ? " adm-side" : ""}${fromAdmin ? " adm-returning" : ""}${leaving ? " adm-leaving" : ""}`}
        // `--n`: a vez do "Voltar ao app" na cascata, de onde a saída conta para trás (ver o CSS do movimento).
        style={{ height: "100%", ["--n" as string]: platform ? cascade?.total : undefined }}
        {...tipHandlers}
      >
        <div className="logo">
          <img src={hypeappLogoBranca} alt="HypeApp" />
        </div>

        <div className={`wsw ${open ? "open" : ""}`} ref={wswRef}>
          {platform ? (
            <div className="wsb sb-ws-static" role="group" aria-label="Área atual: Admin da plataforma" data-tip="Admin da plataforma">
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
                data-tip={selectedWorkspace.name}
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
                {SIGNUP_ENABLED ? (
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
                ) : null}
              </div>
            </>
          ) : (
            <div className="wsb" style={{ justifyContent: "center", color: "var(--dim)" }}>
              Sem workspaces
            </div>
          )}
        </div>

        <SidebarNav
          sections={sections}
          isOn={isOn}
          onNavigate={go}
          ariaLabel={platform ? "Navegação do Admin" : "Navegação principal"}
          cascade={cascade}
        />

        <div className="spacer" />

        <div className="sb-foot">
          {platform ? (
            <button
              type="button"
              className="sb-exit"
              aria-label="Voltar ao app"
              data-tip="Voltar ao app"
              style={cascade ? { ["--i" as string]: cascade.total } : undefined}
              onClick={backToApp}
            >
              <I n="back" />
              <span>Voltar ao app</span>
            </button>
          ) : null}
          {platform ? <hr className="sb-sep" /> : null}

          <div className="me">
            <button type="button" className="me-profile" aria-label="Meu perfil" data-tip="Meu perfil" onClick={() => go("/settings")}>
              <Av
                name={user?.name ?? "Perfil"}
                src={user?.avatar != null ? String(user.avatar) : undefined}
                size={38}
              />
              <span className="me-id">
                <b>{user?.name ?? "—"}</b>
                <small>{platform ? PLATFORM_ROLE_SHORT[user?.platform_role ?? "admin"] : roleOf(selectedWorkspace)}</small>
              </span>
            </button>
            <button
              type="button"
              className="me-out"
              aria-label="Sair da conta"
              data-tip="Sair da conta"
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
        </div>
        {open ? null : tip}
      </aside>
    </div>
  );
}
