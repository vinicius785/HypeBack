import { describeDeleteBlocker, type DeleteBlocker } from "@/lib/workspace-state/delete-blockers";
import { supportMailto } from "@/lib/workspace-state/support-contact";

import "@/styles/workspace-state.css";

/**
 * Por que o workspace ainda não pode ser excluído (409 WORKSPACE_DELETE_BLOCKED): uma frase por impedimento,
 * com valores exatos, e o que fazer ("resolva ou fale com o suporte"). Aparece dentro do diálogo de exclusão,
 * que continua aberto.
 */
export function DeleteBlockersPanel({ blockers, workspaceName }: { blockers: DeleteBlocker[]; workspaceName: string }) {
  const mailto = supportMailto(
    `Exclusão do workspace ${workspaceName}`,
    `Não consegui excluir o workspace "${workspaceName}". Pode me ajudar?`,
  );
  return (
    <div className="wst-blockers" role="alert">
      <h3>Ainda não dá para excluir</h3>
      {blockers.length > 0 ? (
        <>
          <ul>
            {blockers.map((blocker, index) => (
              <li key={`${blocker.code}-${index}`}>{describeDeleteBlocker(blocker)}</li>
            ))}
          </ul>
          <p>
            Resolva esses itens e tente de novo, ou <a href={mailto}>fale com o suporte</a>.
          </p>
        </>
      ) : (
        <p>
          Há algo pendente neste workspace. Resolva e tente de novo, ou <a href={mailto}>fale com o suporte</a>.
        </p>
      )}
    </div>
  );
}
