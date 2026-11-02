import type { WorkspaceStatus } from "@/shared/types";

import "@/styles/workspace-state.css";

const LABEL: Record<Exclude<WorkspaceStatus, "active">, string> = {
  suspended: "Suspenso",
  archived: "Arquivado",
};

/**
 * Etiqueta de estado ao lado do nome do workspace nos menus (seletor da sidebar e gaveta do celular).
 * Workspace ativo (ou sem estado, de um servidor antigo) não leva etiqueta. Quem tem o estado sempre pode
 * selecionar o workspace, até para ler a explicação do bloqueio.
 */
export function WorkspaceStatusChip({ status }: { status?: WorkspaceStatus }) {
  if (!status || status === "active") return null;
  return (
    <span className="wst-chip" data-status={status}>
      {LABEL[status]}
    </span>
  );
}
