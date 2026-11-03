import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import type { NavScope } from "@/components/navigation/nav-config";
import { useNavSections } from "@/components/navigation/use-nav-sections";
import { Brand, ROLE_LABEL, isCampaignScopedPath, useLogout } from "@/components/sidebar";
import { WorkspaceStatusChip } from "@/components/workspace-state/workspace-status-chip";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { Workspace } from "@/shared/types";

/** Telas que usam a base da tela (assistentes, estúdio de live): sem barra flutuante. */
const HIDE_ON = [/^\/campaigns\/new\/?$/, /^\/campaigns\/[^/]+\/edit\/?$/, /^\/lives\/new\/?$/, /^\/lives\/(?!new\/?$)[^/]+\/?$/];

/**
 * Navegação do celular (≤ 900px, quando a sidebar some): barra inferior com os
 * atalhos principais e uma gaveta "Mais" com workspaces, demais telas e a conta.
 * O CSS (`.bnav`, `#bmore`) vem do protótipo e só aparece em telas estreitas.
 *
 * Os itens vêm da mesma configuração da sidebar (`navigation/nav-config.ts`): os marcados como `pinned` ficam na
 * barra e o restante vai para a gaveta, agrupado pelas mesmas seções.
 *
 * `scope="platform"` (layout do Admin): a barra e a gaveta levam as áreas do Admin, sem a lista de
 * workspaces (escolher um mexeria no `workspaceId` guardado) e com "Voltar ao app".
 */
export function MobileNav({ scope = "workspace" }: { scope?: NavScope }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaces, selectedWorkspace, selectWorkspace } = useWorkspaceContext();
  const { sections, isOn } = useNavSections(scope);
  const platform = scope === "platform";
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

  const barItems = sections.flatMap((section) => section.items.filter((item) => item.pinned));
  // O que a barra já mostra não repete na gaveta; seção que fica sem itens some.
  const extraSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.pinned) }))
    .filter((section) => section.items.length > 0);
  const extraHrefs = [...extraSections.flatMap((section) => section.items.map((item) => item.href)), "/settings", "/workspace"];
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
        {barItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={isOn(item.href) && !open ? "on" : ""}
            aria-label={item.label}
            aria-current={isOn(item.href) ? "page" : undefined}
            onClick={() => go(item.href)}
          >
            <I n={item.icon} />
            <span>{item.label}</span>
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

          {!platform && workspaces.length > 0 && (
            <div className="bms-ws">
              <small>Workspace</small>
              {workspaces.map((w, k) => {
                const on = w.id === selectedWorkspace?.id;
                return (
                  <button key={w.id} type="button" className={`bms-w${on ? " on" : ""}`} aria-pressed={on} onClick={() => pick(w)}>
                    <Brand ws={w} index={k} />
                    <div>
                      <b>{w.name}</b>
                      <small>
                        {w.role ? (ROLE_LABEL[w.role] ?? w.role) : ""}
                        <WorkspaceStatusChip status={w.status} />
                      </small>
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

          {extraSections.map((section) => (
            <div className="bms-sc" key={section.id}>
              <small>{section.label}</small>
              <div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`bms-t${isOn(item.href) ? " on" : ""}`}
                    aria-current={isOn(item.href) ? "page" : undefined}
                    onClick={() => go(item.href)}
                  >
                    <span>
                      <I n={item.icon} cls="sm" />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="bms-sc">
            <small>Conta</small>
            <div>
              <button type="button" className={`bms-t${isOn("/settings") ? " on" : ""}`} onClick={() => go("/settings")}>
                <span>
                  <I n="user" cls="sm" />
                </span>
                Meu perfil
              </button>
              {platform ? (
                <button type="button" className="bms-t" onClick={() => go("/")}>
                  <span>
                    <I n="back" cls="sm" />
                  </span>
                  Voltar ao app
                </button>
              ) : (
                <>
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
                </>
              )}
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
