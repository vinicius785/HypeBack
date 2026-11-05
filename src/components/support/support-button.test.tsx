/**
 * "Falar com o suporte" (topo da plataforma).
 * PRECISA: abrir o formulário, validar assunto e mensagem antes de enviar, enviar para `/support/tickets` (com a página e a
 * categoria), mostrar o número do pedido e avisar erro (ex.: limite por hora) mantendo o texto.
 * NÃO PODE: enviar com campo vazio nem perder o que a pessoa digitou quando a API recusa.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiPost: vi.fn() }));
vi.mock("@/lib/http-client", () => ({ apiPost: mocks.apiPost }));

import { SupportButton } from "./support-button";

async function openForm() {
  const user = userEvent.setup();
  render(
    <div className="pv">
      <SupportButton />
    </div>,
  );
  await user.click(screen.getByRole("button", { name: "Falar com o suporte" }));
  return { user, dialog: within(await screen.findByRole("dialog", { name: "Falar com o suporte" })) };
}

beforeEach(() => mocks.apiPost.mockReset());

describe("Falar com o suporte", () => {
  it("exige assunto e mensagem antes de enviar", async () => {
    const { user, dialog } = await openForm();
    await user.click(dialog.getByRole("button", { name: "Enviar pedido" }));
    expect(dialog.getByText("Informe o assunto")).toBeInTheDocument();
    expect(dialog.getByText(/mínimo de 10 caracteres/)).toBeInTheDocument();
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it("envia com categoria e página, e mostra o número do pedido", async () => {
    mocks.apiPost.mockResolvedValue({ id: "u1", number: 1042 });
    const { user, dialog } = await openForm();
    await user.selectOptions(dialog.getByLabelText("Sobre o que é?"), "bug");
    await user.type(dialog.getByLabelText("Assunto"), "  Erro ao convidar criador ");
    await user.type(dialog.getByLabelText("Mensagem"), "Ao clicar em convidar a tela trava.");
    await user.click(dialog.getByRole("button", { name: "Enviar pedido" }));
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1));
    const [path, body] = mocks.apiPost.mock.calls[0];
    expect(path).toBe("/support/tickets");
    expect(body).toMatchObject({ subject: "Erro ao convidar criador", message: "Ao clicar em convidar a tela trava.", category: "bug" });
    expect(body.context.page_url).toContain(window.location.origin);
    expect(await dialog.findByText("Pedido #1042 enviado")).toBeInTheDocument();
    await user.click(dialog.getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("erro da API aparece e o texto digitado continua lá", async () => {
    mocks.apiPost.mockRejectedValueOnce(new Error("Você já abriu 10 pedidos na última hora. Tente de novo mais tarde."));
    const { user, dialog } = await openForm();
    await user.type(dialog.getByLabelText("Assunto"), "Preciso de ajuda");
    await user.type(dialog.getByLabelText("Mensagem"), "Não consigo acessar as campanhas.");
    await user.click(dialog.getByRole("button", { name: "Enviar pedido" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("10 pedidos");
    expect(dialog.getByLabelText("Assunto")).toHaveValue("Preciso de ajuda");
    expect(dialog.getByLabelText("Mensagem")).toHaveValue("Não consigo acessar as campanhas.");
  });
});
