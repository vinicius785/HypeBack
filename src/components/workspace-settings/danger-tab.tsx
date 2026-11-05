import { I } from "@/components/prototype/ui";
import "@/styles/settings.css";

/**
 * Exclusão do workspace: uma linha com as consequências e o botão destrutivo. A confirmação (digitar o nome) é do
 * diálogo. O texto não promete destruição: a exclusão é lógica e só o suporte restaura.
 */
export function DangerTab({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <div className="st-danger">
      <div>
        <p>Ações que afetam toda a equipe.</p>
        <ul>
          <li>{name} deixa de aparecer para a equipe, com as campanhas, os contratos e o financeiro.</li>
          <li>Nada é apagado dos nossos registros: só o suporte pode restaurar.</li>
          <li>Para confirmar, você digita o nome do workspace.</li>
        </ul>
      </div>
      <button type="button" className="btn dng st-del" onClick={onDelete}>
        <I n="trash" cls="sm" />
        Excluir workspace
      </button>
    </div>
  );
}
