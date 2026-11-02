import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSearchInput } from "./admin-search-input";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const input = () => screen.getByRole("searchbox", { name: "Buscar" }) as HTMLInputElement;

function type(text: string) {
  fireEvent.change(input(), { target: { value: text } });
}

describe("AdminSearchInput", () => {
  it("só busca depois de a pessoa parar de digitar (uma consulta, não uma por tecla)", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="" onSearch={onSearch} />);

    type("a");
    act(() => vi.advanceTimersByTime(200));
    type("ac");
    act(() => vi.advanceTimersByTime(200));
    type("acm");
    act(() => vi.advanceTimersByTime(399));
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("acm");
  });

  it("manda o texto aparado", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="" onSearch={onSearch} />);
    type("  acme  ");
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenCalledWith("acme");
  });

  it("Enter busca na hora, sem esperar o atraso, e não repete depois", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="" onSearch={onSearch} />);
    type("acme");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("acme");
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("o × limpa o campo e busca na hora (texto vazio)", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="acme" onSearch={onSearch} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(input()).toHaveValue("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("o × só aparece com texto", () => {
    render(<AdminSearchInput value="" onSearch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Limpar busca" })).not.toBeInTheDocument();
    type("a");
    expect(screen.getByRole("button", { name: "Limpar busca" })).toBeInTheDocument();
  });

  it("Escape limpa quando há texto", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="acme" onSearch={onSearch} />);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("não busca o que já está sendo usado (voltar ao mesmo texto não é uma busca nova)", () => {
    const onSearch = vi.fn();
    render(<AdminSearchInput value="acme" onSearch={onSearch} />);
    type("acmex");
    type("acme");
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("mudança vinda de fora (limpar filtros, botão voltar) troca o que está digitado", () => {
    const { rerender } = render(<AdminSearchInput value="acme" onSearch={vi.fn()} />);
    expect(input()).toHaveValue("acme");
    rerender(<AdminSearchInput value="" onSearch={vi.fn()} />);
    expect(input()).toHaveValue("");
    rerender(<AdminSearchInput value="beta" onSearch={vi.fn()} />);
    expect(input()).toHaveValue("beta");
  });

  it("o texto que o próprio campo mandou buscar e voltou pela URL NÃO apaga o que a pessoa já digitou depois", () => {
    function Harness({ onSearch }: { onSearch: (v: string) => void }) {
      const [value, setValue] = useState("");
      return (
        <AdminSearchInput
          value={value}
          onSearch={(v) => {
            onSearch(v);
            setValue(v); // a URL devolve o texto buscado
          }}
        />
      );
    }
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);

    type("ab");
    act(() => vi.advanceTimersByTime(400)); // busca "ab" e a URL devolve "ab"
    type("abc"); // a pessoa seguiu digitando
    expect(input()).toHaveValue("abc");
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenLastCalledWith("abc");
    expect(input()).toHaveValue("abc");
  });

  it("digitar de novo, dentro do atraso, o mesmo texto de antes de uma limpeza de fora ainda busca", () => {
    function Harness({ onSearch }: { onSearch: (v: string) => void }) {
      const [value, setValue] = useState("");
      return (
        <>
          <button type="button" onClick={() => setValue("")}>
            limpar de fora
          </button>
          <AdminSearchInput
            value={value}
            onSearch={(v) => {
              onSearch(v);
              setValue(v);
            }}
          />
        </>
      );
    }
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    type("ab");
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "limpar de fora" }));
    expect(input()).toHaveValue("");
    type("ab");
    act(() => vi.advanceTimersByTime(400));
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith("ab");
  });

  it("um onSearch novo a cada render não reenvia texto antigo", () => {
    const calls: string[] = [];
    function Harness() {
      const [value, setValue] = useState("");
      const [, force] = useState(0);
      return (
        <>
          <button type="button" onClick={() => force((n) => n + 1)}>
            render
          </button>
          <AdminSearchInput
            value={value}
            onSearch={(v) => {
              calls.push(v);
              setValue(v);
            }}
          />
        </>
      );
    }
    render(<Harness />);
    type("ab");
    fireEvent.keyDown(input(), { key: "Enter" });
    type("abc");
    fireEvent.keyDown(input(), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "render" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(calls).toEqual(["ab", "abc"]);
  });

  it("limita o texto a 100 caracteres (limite do contrato) e aceita rótulo e placeholder", () => {
    render(<AdminSearchInput value="" onSearch={vi.fn()} label="Buscar workspaces" placeholder="Nome, dono, CNPJ…" />);
    const field = screen.getByRole("searchbox", { name: "Buscar workspaces" });
    expect(field).toHaveAttribute("maxlength", "100");
    expect(field).toHaveAttribute("placeholder", "Nome, dono, CNPJ…");
  });
});
