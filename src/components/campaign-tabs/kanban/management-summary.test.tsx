import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ManagementSummary } from "./management-summary";
import type { ExtendedInfluencer } from "../management-kanban-config";

const late = [
  {
    id: "9",
    name: "Bruno Vaz",
    username: "bruno",
    avatar: "",
    statusHistory: [{ id: "h", status: "content_pending", timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString() }],
  } as unknown as ExtendedInfluencer,
];

function setup() {
  const onAttention = vi.fn();
  const onCharge = vi.fn();
  render(
    <ManagementSummary
      progress={41.6}
      attention={[{ n: 2, label: "Roteiros para aprovar", stage: "rot" }]}
      attentionTotal={2}
      late={late}
      deadlines={[["Conteúdos", new Date(Date.now() + 6 * 86_400_000)]]}
      inDays={() => "em 6 dias"}
      onAttention={onAttention}
      onCharge={onCharge}
    />,
  );
  return { onAttention, onCharge };
}

describe("ManagementSummary (nenhum criador selecionado)", () => {
  it("mostra progresso, pendências, atrasos e prazos", () => {
    setup();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roteiros para aprovar/ })).toBeInTheDocument();
    expect(screen.getByText("Conteúdos", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("em 6 dias")).toBeInTheDocument();
  });

  it("clicar numa pendência leva à etapa", async () => {
    const user = userEvent.setup();
    const { onAttention } = setup();
    await user.click(screen.getByRole("button", { name: /Roteiros para aprovar/ }));
    expect(onAttention).toHaveBeenCalledWith("rot");
  });

  it("os atrasados ficam recolhidos, abrem sob demanda e dão 'Cobrar'", async () => {
    const user = userEvent.setup();
    const { onCharge } = setup();
    expect(screen.queryByRole("list", { name: "Criadores em atraso" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ver o criador/ }));
    expect(screen.getByText("Bruno Vaz")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(onCharge).toHaveBeenCalledWith(late[0]);
  });
});
