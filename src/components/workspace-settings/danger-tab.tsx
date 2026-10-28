import { I } from "@/components/prototype/ui";

export function DangerTab({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <div className="wkx-cd wkx-dg">
      <div className="wkx-h">
        <div>
          <h3>Zona de risco</h3>
          <p>Ações que não podem ser desfeitas.</p>
        </div>
      </div>
      <div className="wkx-dr">
        <div>
          <b>Excluir workspace</b>
          <small>
            Apaga {name}, as campanhas, os contratos e o histórico financeiro. Essa ação é permanente.
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
