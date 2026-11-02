/**
 * Troca de `AdminWorkspacePicker` para os testes (ele tem testes próprios): dois botões que escolhem e limpam, e o
 * valor atual à mostra. Fica num arquivo sem imports da tela de propósito: o `vi.mock` do seletor o importa de
 * dentro da fábrica, e um import da tela (que importa o seletor) travaria esperando a si mesmo.
 */
import { CAFE_ID } from "./financial-fixtures";

export const PICKED_WORKSPACE = { id: CAFE_ID, name: "Café Serra Verde" };

export function WorkspacePickerStub({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (workspace: { id: string; name: string } | null) => void;
}) {
  return (
    <div data-testid="workspace-picker" data-value={value ?? ""}>
      <button type="button" onClick={() => onChange(PICKED_WORKSPACE)}>
        Escolher workspace
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Limpar workspace
      </button>
    </div>
  );
}
