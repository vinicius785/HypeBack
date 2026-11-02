import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminPager } from "./admin-pager";

function setup(props: Partial<React.ComponentProps<typeof AdminPager>> = {}) {
  const onPageChange = vi.fn();
  const onPerPageChange = vi.fn();
  const view = render(
    <AdminPager page={1} perPage={25} total={312} onPageChange={onPageChange} onPerPageChange={onPerPageChange} {...props} />,
  );
  return { ...view, onPageChange, onPerPageChange };
}

describe("AdminPager", () => {
  it("mostra 'X–Y de Z' da página atual", () => {
    setup({ page: 2 });
    expect(screen.getByText(/26–50/)).toBeInTheDocument();
    expect(screen.getByText(/de 312/)).toBeInTheDocument();
  });

  it("última página quebrada: 301–312 de 312", () => {
    setup({ page: 13 });
    expect(screen.getByText(/301–312/)).toBeInTheDocument();
  });

  it("separa os milhares", () => {
    setup({ total: 12345, page: 1 });
    expect(screen.getByText(/de 12\.345/)).toBeInTheDocument();
  });

  it("lista vazia não mostra nada", () => {
    const { container } = setup({ total: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it("a página atual é marcada e os botões numerados levam à página", async () => {
    const { onPageChange } = setup({ page: 1 });
    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByRole("button", { name: "Página 1" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(nav).getByRole("button", { name: "Página 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("anterior fica desabilitado na primeira página e próxima na última", () => {
    const { unmount } = setup({ page: 1 });
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
    unmount();
    setup({ page: 13 });
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
  });

  it("anterior e próxima movem uma página", async () => {
    const { onPageChange } = setup({ page: 5 });
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await userEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it("clicar na página em que já está não faz nada", async () => {
    const { onPageChange } = setup({ page: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Página 1" }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("muitas páginas: reticências no lugar dos buracos e a última sempre alcançável", () => {
    setup({ page: 7 });
    expect(screen.getByRole("button", { name: "Página 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 13" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 7" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Página 3" })).not.toBeInTheDocument();
  });

  it("seletor de itens por página chama onPerPageChange com número", async () => {
    const { onPerPageChange } = setup();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    expect(onPerPageChange).toHaveBeenCalledWith(50);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["25 por página", "50 por página", "100 por página"]);
  });

  it("sem onPerPageChange não há seletor", () => {
    setup({ onPerPageChange: undefined });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("tudo numa página e nada a escolher: só o resumo", () => {
    setup({ total: 12, perPage: 25 });
    expect(screen.getByText(/1–12/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("carregando: nada aceita clique repetido", () => {
    setup({ page: 3, disabled: true });
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Página 4" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Itens por página" })).toBeDisabled();
  });

  it("página fora do fim é tratada como a última (a URL pode trazer qualquer número)", () => {
    setup({ page: 99, total: 60 });
    expect(screen.getByText(/51–60/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute("aria-current", "page");
  });

  it("um tamanho de página fora das opções entra no seletor", () => {
    setup({ perPage: 30, total: 300 });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["25 por página", "30 por página", "50 por página", "100 por página"]);
    expect(screen.getByRole("combobox", { name: "Itens por página" })).toHaveValue("30");
  });

  it("para o celular há um 'Página X de Y' compacto", () => {
    setup({ page: 4 });
    expect(screen.getByText("Página 4 de 13")).toBeInTheDocument();
  });
});
