import { I } from "@/components/prototype/ui";

import "@/styles/workspace-state.css";

/**
 * Faixa fina e permanente do workspace arquivado: a pessoa vê tudo, mas o servidor recusa qualquer escrita
 * (403 WORKSPACE_ARCHIVED, avisado por um toast). Fica fora da área que rola, alinhada ao conteúdo.
 */
export function WorkspaceArchivedBanner() {
  return (
    <div className="pv wst-top">
      <div className="wst-banner-wrap">
        <p className="wst-banner" role="status">
          <I n="lock" cls="sm" />
          <span>
            <b>Workspace arquivado</b> — somente consulta
          </span>
        </p>
      </div>
    </div>
  );
}
