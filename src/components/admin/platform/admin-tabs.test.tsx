import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AdminTabPanel, AdminTabs, adminTabIds, type AdminTabItem } from "./admin-tabs";

const TABS: AdminTabItem[] = [
  { id: "resumo", label: "Resumo" },
  { id: "membros", label: "Membros", count: 12 },
  { id: "campanhas", label: "Campanhas", disabled: true },
  { id: "financeiro", label: "Financeiro" },
];

function Harness({ onChange }: { onChange?: (id: string) => void }) {
  const [tab, setTab] = useState("resumo");
  return (
    <>
      <AdminTabs
        tabs={TABS}
        value={tab}
        onChange={(id) => {
          setTab(id);
          onChange?.(id);
        }}
        ariaLabel="Seções do workspace"
        idPrefix="ws"
      />
      {TABS.map((t) => (
        <AdminTabPanel key={t.id} idPrefix="ws" id={t.id} active={tab === t.id}>
          Painel {t.label}
        </AdminTabPanel>
      ))}
    </>
  );
}

describe("AdminTabs", () => {
  it("lista de abas acessível com a aba ativa selecionada e a contagem", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Seções do workspace" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Membros/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Membros/ })).toHaveTextContent("12");
  });

  it("só a aba ativa entra na ordem de tabulação", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Membros/ })).toHaveAttribute("tabindex", "-1");
  });

  it("cada aba aponta para o seu painel e o painel para a aba", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: "Resumo" });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(adminTabIds("ws", "resumo")).toEqual({ tabId: tab.id, panelId: panel.id });
    expect(panel).toHaveTextContent("Painel Resumo");
  });

  it("clique troca de aba e de painel", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /Membros/ }));
    expect(onChange).toHaveBeenCalledWith("membros");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Painel Membros");
  });

  it("setas movem a seleção e o foco, pulando abas desabilitadas e dando a volta", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Resumo" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Membros/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /Membros/ })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}"); // pula "Campanhas" (desabilitada)
    expect(screen.getByRole("tab", { name: "Financeiro" })).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // dá a volta
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}"); // volta pelo outro lado
    expect(screen.getByRole("tab", { name: "Financeiro" })).toHaveFocus();
  });

  it("Home e End vão à primeira e à última aba habilitadas", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Resumo" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Financeiro" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveFocus();
  });

  it("aba desabilitada não pode ser escolhida", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Campanhas" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("painéis inativos não são montados", () => {
    render(<Harness />);
    expect(screen.queryByText("Painel Membros")).not.toBeInTheDocument();
  });
});
