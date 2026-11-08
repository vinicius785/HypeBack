import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ManagementSummary } from "./management-summary";
import type { ExtendedInfluencer } from "../management-kanban-config";

const late = [{ id: "9", name: "Bruno Vaz" } as unknown as ExtendedInfluencer];
const deadlines: Array<[string, Date]> = [
  ["Conteúdos", new Date(2026, 10, 23)],
  ["Publicação", new Date(2026, 10, 27)],
];

function setup(over: Partial<React.ComponentProps<typeof ManagementSummary>> = {}) {
  return render(
    <ManagementSummary
      progress={41.6}
      attentionTotal={2}
      late={late}
      deadlines={deadlines}
      inDays={() => "em 6 dias"}
      {...over}
    />,
  );
}

describe("ManagementSummary (nenhum criador selecionado)", () => {
  it("mostra tudo na pílula fechada: progresso, pendências, atrasos e o próximo prazo", () => {
    setup();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("2 precisam da sua ação")).toBeInTheDocument();
    expect(screen.getByText("1 em atraso")).toBeInTheDocument();
    expect(screen.getByText("Conteúdos 23/11")).toBeInTheDocument();
    expect(screen.queryByText(/Publicação/)).not.toBeInTheDocument(); // só o próximo prazo
  });

  it("não há nada para abrir: sem botões", () => {
    setup();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("estado tranquilo: nada pendente e em dia", () => {
    setup({ attentionTotal: 0, late: [], deadlines: [] });
    expect(screen.getByText("Nada pendente")).toBeInTheDocument();
    expect(screen.getByText("Em dia")).toBeInTheDocument();
  });

  it("singular quando é só um criador", () => {
    setup({ attentionTotal: 1 });
    expect(screen.getByText("1 precisa da sua ação")).toBeInTheDocument();
  });
});
