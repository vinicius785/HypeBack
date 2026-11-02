import { useLocation, useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { Brand, ROLE_LABEL, isCampaignScopedPath } from "@/components/sidebar";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { supportMailto } from "@/lib/workspace-state/support-contact";
import type { Workspace } from "@/shared/types";

import { WorkspaceStatusChip } from "./workspace-status-chip";

import "@/styles/workspace-state.css";

/**
 * Bloqueio do workspace suspenso: ocupa a área de conteúdo (não é um diálogo) no lugar da tela. O servidor
 * recusa tudo do workspace, leitura inclusive (403 WORKSPACE_SUSPENDED), então não há o que mostrar. Explica,
 * leva ao suporte e deixa trocar de workspace (o menu também deixa).
 */
export function WorkspaceSuspendedState() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaces, selectedWorkspace, selectWorkspace } = useWorkspaceContext();

  if (!selectedWorkspace) return null;

  // Os que funcionam primeiro; a cor do círculo segue a posição na lista, como no menu.
  const others = workspaces
    .map((workspace, index) => ({ workspace, index }))
    .filter(({ workspace }) => workspace.id !== selectedWorkspace.id)
    .sort((a, b) => Number(b.workspace.status === "active") - Number(a.workspace.status === "active"));

  const pick = (workspace: Workspace) => {
    selectWorkspace(workspace);
    // Mesma regra do menu: um detalhe de campanha de um workspace não existe no outro.
    if (isCampaignScopedPath(pathname)) navigate({ to: "/campaigns", replace: true });
  };

  const mailto = supportMailto(
    `Workspace suspenso: ${selectedWorkspace.name}`,
    `Olá! O workspace "${selectedWorkspace.name}" (ID ${selectedWorkspace.id}) aparece como suspenso para mim. Pode me ajudar a entender o motivo e a reativá-lo?`,
  );

  return (
    <div className="pv">
      <section className="wst-block" aria-labelledby="wst-block-title">
        <span className="wst-block-icon">
          <I n="lock" />
        </span>
        <h1 id="wst-block-title">Workspace suspenso</h1>
        <p>
          O acesso a <b>{selectedWorkspace.name}</b> está bloqueado por enquanto. Campanhas, criadores, financeiro e
          o restante do workspace ficam indisponíveis para toda a equipe até a reativação.
        </p>
        <p className="wst-muted">Se você acha que isso é um engano, ou quer reativar o workspace, fale com o suporte.</p>
        <a className="btn" href={mailto}>
          Falar com o suporte
        </a>

        {others.length > 0 && (
          <div className="wst-switch">
            <h2>Continuar em outro workspace</h2>
            <ul>
              {others.map(({ workspace, index }) => (
                <li key={workspace.id}>
                  <button type="button" className="wst-pick" onClick={() => pick(workspace)}>
                    <Brand ws={workspace} index={index} />
                    <span className="wst-pick-text">
                      <b>{workspace.name}</b>
                      <small>
                        {workspace.role ? (ROLE_LABEL[workspace.role] ?? workspace.role) : ""}
                        <WorkspaceStatusChip status={workspace.status} />
                      </small>
                    </span>
                    <I n="chev" cls="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
