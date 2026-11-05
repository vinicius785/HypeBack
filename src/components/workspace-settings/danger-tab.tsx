import { I } from "@/components/prototype/ui";
import "@/styles/settings-redesign.css";

/** Aba Avançado: um bloco compacto com a única ação destrutiva. A confirmação (digitar o nome) é do diálogo. */
export function DangerTab({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <div className="stg-adv">
      <section className="stg-card stg-danger" aria-labelledby="stg-dl">
        <div className="stg-dl-i" aria-hidden="true">
          <I n="trash" />
        </div>
        <div className="stg-dl-t">
          <h3 id="stg-dl">Excluir workspace</h3>
          <p>Ações que afetam toda a equipe.</p>
          <ul>
            <li>
              {name} deixa de aparecer para a equipe, com as campanhas, os contratos e o financeiro.
            </li>
            <li>Nada é apagado dos nossos registros: só o suporte pode restaurar.</li>
            <li>Para confirmar, você digita o nome do workspace.</li>
          </ul>
        </div>
        <button type="button" className="btn dng stg-del" onClick={onDelete}>
          <I n="trash" cls="sm" />
          Excluir workspace
        </button>
      </section>
    </div>
  );
}
