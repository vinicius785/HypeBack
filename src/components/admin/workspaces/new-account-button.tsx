import { useState } from "react";

import { WorkspaceCreateDialog } from "./workspace-create-dialog";

/**
 * "Nova conta" no topo de Pessoas (as três abas: Usuários, Criadores e Workspaces). O Admin inteiro já é só da equipe da
 * plataforma (a rota barra quem não é administrador). O diálogo só existe enquanto aberto.
 */
export function NewAccountButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Nova conta
      </button>
      {open ? <WorkspaceCreateDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
