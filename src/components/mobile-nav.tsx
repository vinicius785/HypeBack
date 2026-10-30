import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import {
  Brand,
  ROLE_LABEL,
  isCampaignScopedPath,
  useLogout,
  useNavItems,
} from "@/components/sidebar";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { Workspace } from "@/shared/types";

/** Telas que usam a base da tela (assistentes, estúdio de live): sem barra flutuante. */
const HIDE_ON = [/^\/campaigns\/new\/?$/, /^\/campaigns\/[^/]+\/edit\/?$/, /^\/lives\/new\/?$/, /^\/lives\/(?!new\/?$)[^/]+\/?$/];

/** Atalhos fixos da barra; o restante fica na gaveta "Mais". */
const BAR = ["Início", "Campanhas", "Criadores", "Financeiro"];

/**
 * Navegação do celular (≤ 900px, quando a sidebar some): barra inferior com os
 * atalhos principais e uma gaveta "Mais" com workspaces, demais telas e a conta.
 * O CSS (`.bnav`, `#bmore`) vem do protótipo e só aparece em telas estreitas.
 */
export function MobileNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaces, selectedWorkspace, selectWorkspace } = useWorkspaceContext();
  const { menus, admin, showPlatformAdmin, isOn } = useNavItems();
  const doLogout = useLogout();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // Fecha a gaveta ao trocar de tela.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    sheetRef.current?.querySelector<HTMLElement>("button")?.focus();
    const trigger = moreRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const visible = menus.filter((m) => m[3]);
  const barItems = visible.filter((m) => BAR.includes(m[0]));
  const extraItems = visible.filter((m) => !BAR.includes(m[0]));
  const extraHrefs = [
    ...extraItems.map((m) => m[2]),
    ...(showPlatformAdmin ? admin.map((a) => a[2]) : []),
    "/settings",
    "/workspace",
  ];
  const moreOn = open || extraHrefs.some((href) => isOn(href));

  const go = (to: string) => navigate({ to });
  const pick = (ws: Workspace) => {
    selectWorkspace(ws);
    setOpen(false);
    if (isCampaignScopedPath(pathname)) navigate({ to: "/campaigns", replace: true });
  };

  return (
    <div className="pv">
      <nav className="bnav" aria-label="Navegação principal">
        {barItems.map(([label, icon, href]) => (
          <button
            key={label}
            type="button"
            className={isOn(href) && !open ? "on" : ""}
            aria-label={label}
            aria-current={isOn(href) ? "page" : undefined}
            onClick={() => go(href)}
          >
            <I n={icon} />
            <span>{label}</span>
          </button>
        ))}
        <button
          ref={moreRef}
          type="button"
          className={moreOn ? "on" : ""}
          aria-label="Mais opções"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <I n="more" />
          <span>Mais</span>
        </button>
      </nav>

      <div id="bmore" className={open ? "on" : ""}>
        <div className="bms-bd" onClick={() => setOpen(false)} />
        <div ref={sheetRef} className="bms" role="dialog" aria-modal="true" aria-label="Mais opções" aria-hidden={!open}>
          <div className="bms-gr" aria-hidden="true" />

          {workspaces.length > 0 && (
            <div className="bms-ws">
              <small>Workspace</small>
              {workspaces.map((w, k) => {
                const on = w.id === selectedWorkspace?.id;
                return (
                  <button key={w.id} type="button" className={`bms-w${on ? " on" : ""}`} aria-pressed={on} onClick={() => pick(w)}>
                    <Brand ws={w} index={k} />
                    <div>
                      <b>{w.name}</b>
                      <small>{w.role ? (ROLE_LABEL[w.role] ?? w.role) : ""}</small>
                    </div>
                    {on && (
                      <i aria-hidden="true">
                        <I n="check" cls="sm" />
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {(extraItems.length > 0 || showPlatformAdmin) && (
            <div className="bms-sc">
              <small>Navegação</small>
              <div>
                {extraItems.map(([label, icon, href]) => (
                  <button key={label} type="button" className={`bms-t${isOn(href) ? " on" : ""}`} onClick={() => go(href)}>
                    <span>
                      <I n={icon} cls="sm" />
                    </span>
                    {label}
                  </button>
                ))}
                {showPlatformAdmin &&
                  admin.map(([label, icon, href]) => (
                    <button key={label} type="button" className={`bms-t${isOn(href) ? " on" : ""}`} onClick={() => go(href)}>
                      <span>
                        <I n={icon} cls="sm" />
                      </span>
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="bms-sc">
            <small>Conta</small>
            <div>
              <button type="button" className={`bms-t${isOn("/settings") ? " on" : ""}`} onClick={() => go("/settings")}>
                <span>
                  <I n="user" cls="sm" />
                </span>
                Meu perfil
              </button>
              <button type="button" className={`bms-t${isOn("/workspace/settings") ? " on" : ""}`} onClick={() => go("/workspace/settings")}>
                <span>
                  <I n="gear" cls="sm" />
                </span>
                Workspace
              </button>
              <button type="button" className="bms-t" onClick={() => go("/onboarding/create-workspace")}>
                <span>
                  <I n="plus" cls="sm" />
                </span>
                Novo workspace
              </button>
              <button type="button" className="bms-t out" onClick={() => doLogout()}>
                <span>
                  <I n="logout" cls="sm" />
                </span>
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
