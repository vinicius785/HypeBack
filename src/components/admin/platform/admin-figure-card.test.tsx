import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import type { AdminFigure, AdminFigureKind } from "@/shared/admin-platform.types";

import { FIGURE_KIND_HELP } from "@/lib/admin/labels";

import { AdminFigureCard, AdminFigureGrid, figureTextUnits } from "./admin-figure-card";

// O testing-library normaliza espaços (inclusive o sem quebra do Intl) para um espaço comum.
const BRL = (text: string) => `R$ ${text}`;

function figure(partial: Partial<AdminFigure> = {}): AdminFigure {
  return { value: 250000, unit: "brl_cents", kind: "realized", definition: "Soma das cobranças pagas (asaas_charges.paid_at).", ...partial };
}

describe("AdminFigureCard", () => {
  it("mostra rótulo, valor exato em reais e o tipo em texto", () => {
    render(<AdminFigureCard label="Aportes pagos" figure={figure()} />);
    expect(screen.getByText("Aportes pagos")).toBeInTheDocument();
    expect(screen.getByText(BRL("2.500,00"))).toBeInTheDocument();
    expect(screen.getByText("Realizado")).toBeInTheDocument();
  });

  it("o conteúdo do popover usa parágrafos <span> em bloco: pode ficar dentro de um <p> sem aninhar", () => {
    const { container } = render(<AdminFigureCard label="Aportes pagos" figure={figure()} hintInfo="Últimos 30 dias." />);
    const paragraphs = container.querySelectorAll(".adm-info-p");
    expect(paragraphs).toHaveLength(3);
    for (const p of paragraphs) expect(p.tagName).toBe("SPAN");
    expect(container.querySelector("p")).toBeNull();
  });

  it.each<[AdminFigureKind, string]>([
    ["realized", "Realizado"],
    ["committed", "Comprometido"],
    ["stock", "Posição atual"],
    ["derived", "Calculado"],
    ["proxy", "Aproximado"],
    ["unavailable", "Não apurado"],
  ])("o tipo %s aparece como '%s'", (kind, text) => {
    const { container } = render(
      <AdminFigureCard label="X" figure={figure({ kind, value: kind === "unavailable" ? null : 10, unit: "count" })} />,
    );
    expect(container.querySelector(".adm-kind")).toHaveTextContent(text);
    expect(container.querySelector(".adm-kind")).toHaveAttribute("data-kind", kind);
  });

  it("número que não existe no banco NUNCA vira zero: é 'Não apurado'", () => {
    const { container } = render(
      <AdminFigureCard
        label="Receita da plataforma"
        figure={figure({ kind: "unavailable", value: null, unit: "brl_cents", definition: "Não há modelo de taxa no banco." })}
      />,
    );
    const value = container.querySelector(".adm-fig-value");
    expect(value).toHaveTextContent("Não apurado");
    expect(value).toHaveAttribute("data-unavailable", "true");
    expect(container.querySelector(".adm-fig")).not.toHaveTextContent("R$");
    expect(value?.textContent).not.toMatch(/\b0\b/);
  });

  it("zero que existe no banco aparece como zero (não é 'não apurado')", () => {
    const { container } = render(<AdminFigureCard label="Custódia" figure={figure({ value: 0, kind: "stock" })} />);
    expect(container.querySelector(".adm-fig-value")).toHaveTextContent(BRL("0,00"));
    expect(container.querySelector(".adm-fig-value")).not.toHaveAttribute("data-unavailable");
  });

  it("contagens e percentuais usam a unidade do contrato", () => {
    const { rerender } = render(<AdminFigureCard label="Workspaces" figure={figure({ unit: "count", value: 1234 })} />);
    expect(screen.getByText("1.234")).toBeInTheDocument();
    rerender(<AdminFigureCard label="Taxa" figure={figure({ unit: "percent", value: 12.5 })} />);
    expect(screen.getByText("12,5%")).toBeInTheDocument();
  });

  it("sem figura (ainda não chegou) mostra '—'", () => {
    render(<AdminFigureCard label="Workspaces" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("carregando: esqueleto no lugar do valor, sem número e sem botão de definição", () => {
    const { container } = render(<AdminFigureCard label="Workspaces" figure={figure()} loading />);
    expect(container.querySelectorAll(".adm-sk").length).toBeGreaterThan(0);
    expect(container.querySelector(".adm-fig-value")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
  });

  it("a definição é acessível: botão com a regra (e o significado do tipo) como descrição", () => {
    render(<AdminFigureCard label="Aportes pagos" figure={figure()} />);
    const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });
    expect(info).toHaveAccessibleDescription(/Soma das cobranças pagas/);
    expect(info).toHaveAccessibleDescription(/Fato consolidado/);
  });

  it("Enter abre o balão com a definição e o significado do tipo; Escape fecha e devolve o foco", async () => {
    const user = userEvent.setup();
    render(<AdminFigureCard label="Aportes pagos" figure={figure()} />);
    const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });

    await user.tab();
    expect(info).toHaveFocus();
    expect(info).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    expect(info).toHaveAttribute("aria-expanded", "true");
    const visible = document.querySelector(".adm-pop") as HTMLElement;
    expect(visible).toHaveTextContent("Soma das cobranças pagas");
    expect(visible).toHaveTextContent("Fato consolidado");

    await user.keyboard("{Escape}");
    expect(document.querySelector(".adm-pop")).toBeNull();
    expect(info).toHaveFocus();
  });

  it("clicar fora fecha o balão e Espaço abre", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AdminFigureCard label="Aportes pagos" figure={figure()} />
        <button type="button">fora</button>
      </div>,
    );
    const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });
    info.focus();
    await user.keyboard(" ");
    expect(document.querySelector(".adm-pop")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "fora" }));
    expect(document.querySelector(".adm-pop")).toBeNull();
  });

  it("com destino, o cartão inteiro é um link com nome acessível; o botão de definição continua ali", () => {
    render(
      <AdminFigureCard
        label="Workspaces suspensos"
        figure={figure({ unit: "count", value: 3 })}
        to={{ to: "/admin/workspaces", search: { status: "suspended" } }}
      />,
    );
    const link = screen.getByRole("link", { name: "Ver Workspaces suspensos" });
    expect(link).toHaveAttribute("href", "/admin/workspaces");
    expect(screen.getByRole("button", { name: /Como é calculado/ })).toBeInTheDocument();
  });

  it("sem destino não há link", () => {
    render(<AdminFigureCard label="X" figure={figure()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("texto de apoio ao lado do tipo", () => {
    render(<AdminFigureCard label="X" figure={figure()} hint="no período" />);
    expect(screen.getByText("no período")).toBeInTheDocument();
  });

  it("valor comprido sai por inteiro, sem abreviar, e avisa o CSS o tamanho do texto para caber no cartão", () => {
    const { container } = render(
      <AdminFigureCard label="Aportes pagos" figure={figure({ value: 123456789 })} />,
    );
    const value = container.querySelector(".adm-fig-value") as HTMLElement;
    expect(value).toHaveTextContent(BRL("1.234.567,89"));
    // "R$ 1.234.567,89": R + 9 dígitos = 10 unidades; $, espaço e 3 separadores = 5 × ½
    expect(value.style.getPropertyValue("--adm-fig-units")).toBe("12.5");
  });

  it("figureTextUnits: letras e dígitos valem 1; pontuação, espaço e símbolo, ½", () => {
    expect(figureTextUnits("87")).toBe(2);
    expect(figureTextUnits("12,5%")).toBe(4); // 3 dígitos + vírgula e % (½ cada)
    expect(figureTextUnits("—")).toBe(0.5);
    expect(figureTextUnits("")).toBe(0);
    expect(figureTextUnits(`R$ 45.000,00`)).toBeLessThan(figureTextUnits(`R$ 1.234.567,89`));
  });

  it("a grade só agrupa", () => {
    const { container } = render(
      <AdminFigureGrid>
        <AdminFigureCard label="A" figure={figure()} />
        <AdminFigureCard label="B" figure={figure()} />
      </AdminFigureGrid>,
    );
    expect(within(container.querySelector(".adm-figs") as HTMLElement).getAllByText(/^[AB]$/)).toHaveLength(2);
  });

  describe("showKind e hintInfo", () => {
    it("padrão: o selo de tipo aparece no cartão e o popover não repete 'Tipo:'", () => {
      const { container } = render(<AdminFigureCard label="Aportes pagos" figure={figure()} />);
      expect(container.querySelector(".adm-kind")).toHaveTextContent("Realizado");
      expect(screen.getByRole("button", { name: "Como é calculado: Aportes pagos" })).not.toHaveAccessibleDescription(/Tipo:/);
    });

    it("showKind={false}: o selo sai do cartão e o tipo passa a ser uma linha do popover do 'i'", async () => {
      const user = userEvent.setup();
      const { container } = render(<AdminFigureCard label="Aportes pagos" figure={figure()} showKind={false} />);
      expect(container.querySelector(".adm-kind")).toBeNull();
      expect(screen.queryByText("Realizado")).not.toBeInTheDocument();

      const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });
      // leitor de tela: a descrição do botão traz a regra, o tipo e o significado do tipo
      expect(info).toHaveAccessibleDescription(/Soma das cobranças pagas/);
      expect(info).toHaveAccessibleDescription(/Tipo: Realizado/);
      expect(info).toHaveAccessibleDescription(/Fato consolidado/);

      await user.click(info);
      const pop = document.querySelector(".adm-pop") as HTMLElement;
      expect(pop.querySelector(".adm-fig-kindline")).toHaveTextContent("Tipo: Realizado");
    });

    it.each<[AdminFigureKind, string]>([
      ["committed", "Comprometido"],
      ["stock", "Posição atual"],
      ["unavailable", "Não apurado"],
    ])("showKind={false}: o tipo %s vira 'Tipo: %s' no popover", (kind, text) => {
      render(<AdminFigureCard label="X" figure={figure({ kind, value: kind === "unavailable" ? null : 10, unit: "count" })} showKind={false} />);
      const info = screen.getByRole("button", { name: "Como é calculado: X" });
      expect(info).toHaveAccessibleDescription(new RegExp(`Tipo: ${text}`));
      expect(info).toHaveAccessibleDescription(new RegExp(FIGURE_KIND_HELP[kind].slice(0, 20)));
    });

    it("sem selo e sem texto de apoio nem link, o rodapé nem existe (o cartão não ganha uma linha vazia)", () => {
      const { container } = render(<AdminFigureCard label="X" figure={figure()} showKind={false} />);
      expect(container.querySelector(".adm-fig-foot")).toBeNull();
    });

    it("sem selo, o cartão com link mantém o rodapé só para a seta", () => {
      const { container } = render(<AdminFigureCard label="X" figure={figure()} showKind={false} to={{ to: "/admin/x" }} />);
      expect(container.querySelector(".adm-kind")).toBeNull();
      expect(container.querySelector(".adm-fig-foot .adm-fig-go")).not.toBeNull();
    });

    it("hintInfo entra no popover do rótulo: o texto de apoio não ganha um segundo 'i'", async () => {
      const user = userEvent.setup();
      render(<AdminFigureCard label="Aportes pagos" figure={figure()} showKind={false} hint="no período" hintInfo="Período = últimos 30 dias." />);
      expect(screen.getByText("no período")).toBeInTheDocument();
      expect(screen.getAllByRole("button")).toHaveLength(1);

      const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });
      expect(info).toHaveAccessibleDescription(/Período = últimos 30 dias\./);
      await user.click(info);
      expect(document.querySelector(".adm-pop")).toHaveTextContent("Período = últimos 30 dias.");
    });

    it("hintInfo também funciona com o selo visível (vai para o popover do mesmo jeito)", () => {
      render(<AdminFigureCard label="X" figure={figure()} hint="no período" hintInfo="Últimos 30 dias." />);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Como é calculado: X" })).toHaveAccessibleDescription(/Últimos 30 dias\./);
    });

    it("sem número ainda (sem 'i' do rótulo), o texto de apoio com hintInfo ganha o seu próprio 'i'", () => {
      render(<AdminFigureCard label="Aportes pagos" hint="no período" hintInfo="Últimos 30 dias." />);
      const info = screen.getByRole("button", { name: "Como é calculado: Aportes pagos" });
      expect(info).toHaveAccessibleDescription("Últimos 30 dias.");
    });

    it("hintInfo sem hint não cria nada solto", () => {
      render(<AdminFigureCard label="X" figure={figure()} hintInfo="Só no popover." />);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button")).toHaveAccessibleDescription(/Só no popover\./);
    });

    it("grade quiet: nenhum cartão filho mostra o selo, sem repetir a prop; todos mantêm o tipo no popover", () => {
      const { container } = render(
        <AdminFigureGrid quiet>
          <AdminFigureCard label="A" figure={figure()} />
          <AdminFigureCard label="B" figure={figure({ kind: "stock" })} />
        </AdminFigureGrid>,
      );
      expect(container.querySelector(".adm-kind")).toBeNull();
      expect(container.querySelector(".adm-figs")).toHaveAttribute("data-quiet", "true");
      expect(screen.getByRole("button", { name: "Como é calculado: A" })).toHaveAccessibleDescription(/Tipo: Realizado/);
      expect(screen.getByRole("button", { name: "Como é calculado: B" })).toHaveAccessibleDescription(/Tipo: Posição atual/);
    });

    it("grade quiet: um cartão pode voltar a mostrar o selo com showKind", () => {
      const { container } = render(
        <AdminFigureGrid quiet>
          <AdminFigureCard label="A" figure={figure()} showKind />
          <AdminFigureCard label="B" figure={figure()} />
        </AdminFigureGrid>,
      );
      expect(container.querySelectorAll(".adm-kind")).toHaveLength(1);
    });

    it("grade comum (sem quiet) segue mostrando o selo", () => {
      const { container } = render(
        <AdminFigureGrid>
          <AdminFigureCard label="A" figure={figure()} />
        </AdminFigureGrid>,
      );
      expect(container.querySelector(".adm-kind")).not.toBeNull();
      expect(container.querySelector(".adm-figs")).not.toHaveAttribute("data-quiet");
    });

    it("o cartão carregando não vaza o hintInfo nem o 'i'", () => {
      render(<AdminFigureCard label="X" figure={figure()} loading showKind={false} hint="no período" hintInfo="Últimos 30 dias." />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
