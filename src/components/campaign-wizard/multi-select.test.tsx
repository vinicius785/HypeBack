import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MultiSelect } from "./fields";

afterEach(cleanup);

const STATES = ["Acre", "Alagoas", "Amapá", "Bahia", "Ceará", "Goiás", "Minas Gerais", "São Paulo"].map((label, i) => ({
  value: `S${i}`,
  label,
}));

function Harness({ initial = [] as string[], onChange = vi.fn() }) {
  const [values, setValues] = useState(initial);
  return (
    <MultiSelect
      ariaLabel="Estados"
      values={values}
      options={STATES}
      onChange={(next) => {
        setValues(next);
        onChange(next);
      }}
      placeholder="Todo o Brasil"
      searchPlaceholder="Buscar estado"
    />
  );
}

describe("MultiSelect", () => {
  it("sem seleção mostra o texto de 'sem filtro'; marcar vários mostra o resumo e chips removíveis", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Estados" })).toHaveTextContent("Todo o Brasil");

    await user.click(screen.getByRole("button", { name: "Estados" }));
    await user.click(screen.getByRole("checkbox", { name: /Bahia/ }));
    await user.click(screen.getByRole("checkbox", { name: /São Paulo/ }));
    expect(onChange).toHaveBeenLastCalledWith(["S3", "S7"]);
    // o painel continua aberto entre um clique e outro
    expect(screen.getByRole("button", { name: "Estados" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Estados" })).toHaveTextContent("Bahia, São Paulo");

    await user.click(screen.getByRole("checkbox", { name: /Goiás/ }));
    expect(screen.getByRole("button", { name: "Estados" })).toHaveTextContent("3 selecionados");

    await user.click(screen.getByRole("button", { name: "Remover Bahia" }));
    expect(onChange).toHaveBeenLastCalledWith(["S7", "S5"]);
  });

  it("a busca ignora acento e caixa, e avisa quando nada combina", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Estados" }));
    await user.type(screen.getByLabelText("Buscar estado em Estados"), "sao");
    expect(screen.getByRole("checkbox", { name: /São Paulo/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Bahia/ })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar estado em Estados"));
    await user.type(screen.getByLabelText("Buscar estado em Estados"), "zzz");
    expect(screen.getByText("Nada encontrado")).toBeInTheDocument();
  });

  it("'Limpar seleção' esvazia tudo; Esc fecha o painel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["S0", "S1"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Estados" }));
    await user.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole("button", { name: "Estados" })).toHaveTextContent("Todo o Brasil");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Estados" })).toHaveAttribute("aria-expanded", "false");
  });

  it("lista curta (até 7 opções) não mostra a busca", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelect
        ariaLabel="Cidades"
        values={[]}
        options={STATES.slice(0, 3)}
        onChange={vi.fn()}
        placeholder="Todas as cidades"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cidades" }));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
