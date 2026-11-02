import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

import { useWorkspaceContext } from "@/contexts/workspace-context";
import { isAccountScopedPath } from "@/lib/workspace-state/paths";

import { WorkspaceArchivedBanner } from "./workspace-archived-banner";
import { WorkspaceSuspendedState } from "./workspace-suspended-state";

/**
 * O que o estado do workspace selecionado muda no layout do app:
 *
 * - suspenso: o conteúdo some atrás da tela de bloqueio e o topo (sino e chat) não monta, porque ele chama a
 *   API do workspace (o sino repete a cada minuto) e o servidor recusa tudo;
 * - arquivado: entra a faixa "somente consulta" e o resto segue (leitura funciona);
 * - ativo: nada muda.
 *
 * Meu perfil (`/settings`) é da conta da pessoa, não do workspace: segue aberto e sem faixa.
 */
function useWorkspaceGate() {
  const { selectedWorkspace } = useWorkspaceContext();
  const { pathname } = useLocation();
  const status = selectedWorkspace?.status ?? "active";
  const accountScoped = isAccountScopedPath(pathname);
  return {
    suspended: status === "suspended",
    blocksContent: status === "suspended" && !accountScoped,
    readOnlyNotice: status === "archived" && !accountScoped,
  };
}

/** Topo do app (título, sino, chat) e, por baixo dele, a faixa de workspace arquivado. */
export function WorkspaceStateTop({ children }: { children?: ReactNode }) {
  const { suspended, readOnlyNotice } = useWorkspaceGate();
  return (
    <>
      {suspended ? null : children}
      {readOnlyNotice ? <WorkspaceArchivedBanner /> : null}
    </>
  );
}

/** Conteúdo da página: a tela de bloqueio no lugar dele quando o workspace está suspenso. */
export function WorkspaceStateContent({ children }: { children: ReactNode }) {
  const { blocksContent } = useWorkspaceGate();
  return blocksContent ? <WorkspaceSuspendedState /> : <>{children}</>;
}
