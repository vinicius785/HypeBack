import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AdminInfoPopover } from "./admin-info-popover";

import {
  ADMIN_PERIOD_CUSTOM,
  AdminPeriodSelect,
  adminPeriodRangeError,
  type AdminPeriodChange,
  type AdminPeriodCustomConfig,
  type AdminPeriodSelectProps,
  type AdminPeriodValue,
} from "./admin-period-select";

const PRESETS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];
const CUSTOM: AdminPeriodCustomConfig = { max: "2026-11-03", maxDays: 366 };

function Harness({
  initial = { preset: "30d" },
  onChange,
  ...rest
}: { initial?: AdminPeriodValue; onChange?: (next: AdminPeriodChange) => void } & Partial<AdminPeriodSelectProps>) {
  const [value, setValue] = useState<AdminPeriodValue>(initial);
  return (
    <AdminPeriodSelect
      presets={PRESETS}
      value={value}
      custom={CUSTOM}
      {...rest}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

const button = (name: string) => screen.getByRole("button", { name });

describe("AdminPeriodSelect: atalhos", () => {
  it("é um grupo com o nome pedido e marca só o atalho ativo", () => {
    render(<Harness ariaLabel="Período do painel" />);
    const group = screen.getByRole("group", { name: "Período do painel" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["7 dias", "30 dias", "90 dias", "Personalizado"]);
    expect(button("30 dias")).toHaveAttribute("aria-pressed", "true");
    expect(button("7 dias")).toHaveAttribute("aria-pressed", "false");
    expect(button("Personalizado")).toHaveAttribute("aria-pressed", "false");
  });

  it("o nome padrão do grupo é 'Período'", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Período" })).toBeInTheDocument();
  });

  it("pede a troca só com o id do atalho; clicar no que já vale não faz nada", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(button("30 dias"));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(button("90 dias"));
    expect(onChange).toHaveBeenCalledWith({ preset: "90d" });
    expect(button("90 dias")).toHaveAttribute("aria-pressed", "true");
  });

  it("funciona só com o teclado: Tab chega aos atalhos e Enter e Espaço escolhem", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();
    await user.tab();
    expect(button("7 dias")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ preset: "7d" });

    await user.tab();
    expect(button("30 dias")).toHaveFocus();
    await user.tab();
    expect(button("90 dias")).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith({ preset: "90d" });
  });

  it("o foco fica no botão clicado (não pula para outro lugar quando o período muda)", async () => {
    render(<Harness />);
    await userEvent.click(button("90 dias"));
    expect(button("90 dias")).toHaveFocus();
  });

  it("sem `custom` não existe 'Personalizado' nem campos de data", () => {
    render(<AdminPeriodSelect presets={PRESETS} value={{ preset: "7d" }} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Personalizado" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
  });

  it("desabilitado trava atalhos e datas", async () => {
    const onChange = vi.fn();
    render(<Harness disabled initial={{ preset: ADMIN_PERIOD_CUSTOM, from: "2026-10-01", to: "2026-10-31" }} onChange={onChange} />);
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("Até")).toBeDisabled();
    await userEvent.click(button("7 dias"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a linha de apoio aparece como região educada (anunciada quando o intervalo muda)", () => {
    render(<Harness summary="01/10/2026 a 31/10/2026 · horário de São Paulo" />);
    const summary = screen.getByText(/horário de São Paulo/);
    expect(summary).toHaveAttribute("aria-live", "polite");
  });

  it("a região viva é um <div> sempre presente: vazia sem apoio, e o primeiro texto entra nela", () => {
    const { container, rerender } = render(<AdminPeriodSelect presets={PRESETS} value={{ preset: "7d" }} onChange={() => {}} />);
    const live = container.querySelector(".adm-period-summary") as HTMLElement;
    expect(live.tagName).toBe("DIV");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    rerender(<AdminPeriodSelect presets={PRESETS} value={{ preset: "7d" }} onChange={() => {}} summary="Últimos 7 dias" />);
    // o mesmo nó (não foi remontado): é isso que faz o leitor anunciar o primeiro texto
    expect(container.querySelector(".adm-period-summary")).toBe(live);
    expect(live).toHaveTextContent("Últimos 7 dias");
  });

  it("o apoio aceita blocos, como um AdminInfoPopover com parágrafos, sem <p> aninhado", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <AdminPeriodSelect
        presets={PRESETS}
        value={{ preset: "7d" }}
        onChange={() => {}}
        summary={
          <>
            <p>Horário de São Paulo</p>
            <AdminInfoPopover label="Período">
              <AdminInfoPopover.Paragraph>Um.</AdminInfoPopover.Paragraph>
              <AdminInfoPopover.Paragraph>Dois.</AdminInfoPopover.Paragraph>
            </AdminInfoPopover>
          </>
        }
      />,
    );
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector(".adm-period-summary p")).toHaveTextContent("Horário de São Paulo");
    expect(screen.getByRole("button", { name: "Como é calculado: Período" })).toBeInTheDocument();
    errors.mockRestore();
  });

  it("compacto marca o componente para o CSS", () => {
    const { container } = render(<Harness compact />);
    expect(container.querySelector(".adm-period")).toHaveAttribute("data-compact", "true");
  });
});

describe("AdminPeriodSelect: Personalizado", () => {
  it("abre os campos com rótulo de verdade e manda o período atual como ponto de partida", async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: "30d", from: "2026-10-05", to: "2026-11-03" }} onChange={onChange} />);
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();

    await userEvent.click(button("Personalizado"));
    expect(onChange).toHaveBeenCalledWith({ preset: "custom", from: "2026-10-05", to: "2026-11-03" });
    expect(button("Personalizado")).toHaveAttribute("aria-pressed", "true");
    expect(button("Personalizado")).toHaveFocus();

    const range = screen.getByRole("group", { name: "Período personalizado" });
    expect(within(range).getByLabelText("De")).toHaveValue("2026-10-05");
    expect(within(range).getByLabelText("Até")).toHaveValue("2026-11-03");
    expect(within(range).getByLabelText("De")).toHaveAttribute("type", "date");
    expect(within(range).getByLabelText("Até")).toHaveAttribute("max", "2026-11-03");
  });

  it("abre mesmo quando quem usa não troca o preset (as datas coincidem com um atalho)", async () => {
    // Parente que ignora o pedido: o campo precisa abrir do mesmo jeito.
    render(<AdminPeriodSelect presets={PRESETS} value={{ preset: "30d", from: "2026-10-05", to: "2026-11-03" }} custom={CUSTOM} onChange={() => {}} />);
    await userEvent.click(button("Personalizado"));
    expect(screen.getByLabelText("De")).toBeInTheDocument();
    await userEvent.click(button("7 dias"));
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
  });

  it("começa aberto quando o período de fora já é personalizado (preset null ou 'custom')", () => {
    const { rerender } = render(
      <AdminPeriodSelect presets={PRESETS} value={{ preset: null, from: "2026-10-01", to: "2026-10-10" }} custom={CUSTOM} onChange={() => {}} />,
    );
    expect(screen.getByLabelText("De")).toHaveValue("2026-10-01");
    expect(button("Personalizado")).toHaveAttribute("aria-pressed", "true");
    rerender(
      <AdminPeriodSelect presets={PRESETS} value={{ preset: "custom", from: "2026-10-01", to: "2026-10-10" }} custom={CUSTOM} onChange={() => {}} />,
    );
    expect(screen.getByLabelText("Até")).toHaveValue("2026-10-10");
  });

  it("usa o texto de botão pedido", () => {
    render(<Harness custom={{ ...CUSTOM, label: "Intervalo" }} />);
    expect(button("Intervalo")).toBeInTheDocument();
  });

  it("intervalo válido sobe pelo onChange com as duas datas", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-10" } });
    expect(onChange).toHaveBeenCalledWith({ preset: "custom", from: "2026-10-10", to: "2026-10-31" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("início depois do fim: mostra o aviso ligado aos campos, não pede a troca e some ao corrigir", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} onChange={onChange} />);
    const from = screen.getByLabelText("De");
    const to = screen.getByLabelText("Até");

    fireEvent.change(from, { target: { value: "2026-11-02" } });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("A data inicial não pode ser depois da data final.");
    expect(onChange).not.toHaveBeenCalled();
    for (const field of [from, to]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-describedby", alert.id);
    }
    // o que foi digitado fica no campo (a pessoa corrige em cima dele)
    expect(from).toHaveValue("2026-11-02");

    fireEvent.change(to, { target: { value: "2026-11-03" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(from).not.toHaveAttribute("aria-invalid");
    expect(from).not.toHaveAttribute("aria-describedby");
    expect(onChange).toHaveBeenCalledWith({ preset: "custom", from: "2026-11-02", to: "2026-11-03" });
  });

  it("data depois do limite máximo é recusada com a data por extenso", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-20" } });
    expect(screen.getByRole("alert")).toHaveTextContent("As datas não podem passar de 03/11/2026.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("período acima do máximo de dias é recusado", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} custom={{ maxDays: 31 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-02" } });
    expect(screen.getByRole("alert")).toHaveTextContent("O período pode ter no máximo 31 dias.");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-31" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("campo apagado: pede as duas datas, sem mandar nada", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Informe as duas datas.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("abrir o Personalizado sem datas não mostra erro antes de a pessoa mexer", async () => {
    render(<Harness />);
    await userEvent.click(button("Personalizado"));
    expect(screen.getByLabelText("De")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("quando o período de fora muda, os campos acompanham e o erro some", () => {
    const props = { presets: PRESETS, custom: CUSTOM, onChange: () => {} };
    const { rerender } = render(<AdminPeriodSelect {...props} value={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} />);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-11-02" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<AdminPeriodSelect {...props} value={{ preset: null, from: "2026-09-01", to: "2026-09-30" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("De")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-09-30");
  });

  it("os campos se alcançam pelo teclado, na ordem: atalhos, De, Até", async () => {
    render(<Harness initial={{ preset: null, from: "2026-10-01", to: "2026-10-31" }} />);
    const user = userEvent.setup();
    await user.click(button("Personalizado"));
    await user.tab();
    expect(screen.getByLabelText("De")).toHaveFocus();
    // o campo de data nativo tem partes (dia, mês, ano): o Tab percorre as partes e termina no campo seguinte
    let steps = 0;
    while (document.activeElement !== screen.getByLabelText("Até") && steps < 8) {
      await user.tab();
      steps += 1;
    }
    expect(screen.getByLabelText("Até")).toHaveFocus();
  });
});

describe("AdminPeriodSelect: mudança de fora", () => {
  it("o pai volta para um atalho (reset): o Personalizado fecha e o atalho aparece marcado", () => {
    const props = { presets: PRESETS, custom: CUSTOM, onChange: () => {} };
    const { rerender } = render(<AdminPeriodSelect {...props} value={{ preset: "30d" }} />);
    fireEvent.click(button("Personalizado"));
    expect(screen.getByLabelText("De")).toBeInTheDocument();
    rerender(<AdminPeriodSelect {...props} value={{ preset: "7d", from: "2026-10-28", to: "2026-11-03" }} />);
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
    expect(button("7 dias")).toHaveAttribute("aria-pressed", "true");
    expect(button("Personalizado")).toHaveAttribute("aria-pressed", "false");
  });

  it("as datas digitadas viram um atalho no pai (eco): o Personalizado continua aberto", () => {
    render(<Harness initial={{ preset: "custom", from: "2026-10-01", to: "2026-10-10" }} />);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-04" } });
    expect(screen.getByLabelText("De")).toHaveValue("2026-10-04");
    expect(button("Personalizado")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("adminPeriodRangeError", () => {
  it("valida na ordem: faltou data, ordem, limites e tamanho", () => {
    expect(adminPeriodRangeError({ from: "", to: "2026-10-01" })).toBe("Informe as duas datas.");
    expect(adminPeriodRangeError({ from: "2026-10-02", to: "2026-10-01" })).toBe("A data inicial não pode ser depois da data final.");
    expect(adminPeriodRangeError({ from: "2026-10-01", to: "2026-10-02" }, { max: "2026-10-01" })).toBe("As datas não podem passar de 01/10/2026.");
    expect(adminPeriodRangeError({ from: "2026-09-01", to: "2026-10-02" }, { min: "2026-09-15" })).toBe("As datas não podem ser antes de 15/09/2026.");
    expect(adminPeriodRangeError({ from: "2026-01-01", to: "2026-01-03" }, { maxDays: 2 })).toBe("O período pode ter no máximo 2 dias.");
  });

  it("conta as duas pontas e aceita o limite exato", () => {
    expect(adminPeriodRangeError({ from: "2026-10-01", to: "2026-10-01" }, { maxDays: 1 })).toBeNull();
    // 2025-11-04 a 2026-11-03 = 365 dias; um ano bissexto inteiro (2024) tem 366
    expect(adminPeriodRangeError({ from: "2024-01-01", to: "2024-12-31" }, { maxDays: 366 })).toBeNull();
    expect(adminPeriodRangeError({ from: "2023-12-31", to: "2024-12-31" }, { maxDays: 366 })).not.toBeNull();
  });

  it("ano ainda incompleto (digitando) conta como data faltando", () => {
    expect(adminPeriodRangeError({ from: "0002-10-01", to: "2026-10-02" })).toBe("Informe as duas datas.");
    expect(adminPeriodRangeError({ from: "0202-10-01", to: "2026-10-02" })).toBe("Informe as duas datas.");
  });

  it("sem limites aceita qualquer intervalo ordenado", () => {
    expect(adminPeriodRangeError({ from: "2020-01-01", to: "2030-01-01" })).toBeNull();
  });
});

describe("CSS do AdminPeriodSelect", () => {
  // O Vitest entrega CSS vazio por import: lê do disco.
  const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-period-select.css"), "utf8");

  it("dentro de um cartão o trilho usa o cinza da página (o branco sumia)", () => {
    expect(css).toMatch(/\.pv \.adm-card \.adm-period \.adm-period-seg \{ background: var\(--bg\); \}/);
  });

  it("a região viva vazia não ocupa linha", () => {
    expect(css).toMatch(/\.adm-period-summary:empty \{ margin-top: -8px; \}/);
  });
});
