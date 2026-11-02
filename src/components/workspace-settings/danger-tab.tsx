import { I } from "@/components/prototype/ui";

export function DangerTab({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <div className="wkx-cd wkx-dg">
      <div className="wkx-h">
        <div>
          <h3>Zona de risco</h3>
          <p>Ações que afetam toda a equipe.</p>
        </div>
      </div>
      <div className="wkx-dr">
        <div>
          <b>Excluir workspace</b>
          <small>
            {name} deixa de aparecer para a equipe, com as campanhas, os contratos e o financeiro. Só o suporte
            pode restaurar.
          </small>
        </div>
        <button type="button" className="btn dng" onClick={onDelete}>
          <I n="trash" cls="sm" />
          Excluir workspace
        </button>
      </div>
    </div>
  );
}
