import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  ...api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock());

import { toast } from "sonner";

import { toAdminApiError } from "@/lib/admin/admin-client";

import { deferred, fakeRouter, UUID_V4 } from "./test-support";
import { WorkspaceCreateDialog } from "./workspace-create-dialog";

const RESULT = {
  workspace: { id: "7a1e0000-0000-4000-8000-000000000099", name: "Marca Nova", account_type: "brand" as const },
  owner: { user_id: 123, name: "Dona Nova", email: "dona@marca.com.br" },
  invite_email: "queued" as const,
};

function renderDialog() {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkspaceCreateDialog onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const create = () => screen.getByRole("button", { name: "Criar conta" });

async function fill({ type = "brand", name = "Marca Nova", owner = "Dona Nova", email = "Dona@Marca.com.br", reason = "Cliente novo, fechado pelo comercial" } = {}) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Tipo da conta"), type);
  await user.type(screen.getByLabelText("Nome da marca ou agência"), name);
  await user.type(screen.getByLabelText("Nome do dono"), owner);
  await user.type(screen.getByLabelText("E-mail do dono"), email);
  await user.type(screen.getByLabelText(/^Motivo/), reason);
  return user;
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  vi.mocked(toast.success).mockClear();
  fakeRouter.set();
  api.adminPost.mockResolvedValue(RESULT);
});

describe("WorkspaceCreateDialog (Nova conta)", () => {
  it("abre com o texto de apoio do convite e o botão travado até tudo estar válido", async () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Nova conta" })).toBeInTheDocument();
    expect(screen.getByText("O dono recebe um e-mail de convite com um código para definir a senha. O código vale 7 dias.")).toBeInTheDocument();
    expect(create()).toBeDisabled();
    const user = await fill();
    expect(create()).toBeEnabled();
    // um campo fora do limite trava de novo
    await user.clear(screen.getByLabelText("Nome do dono"));
    await user.type(screen.getByLabelText("Nome do dono"), "A");
    expect(create()).toBeDisabled();
  });

  it("valida os limites no cliente: nomes de 2 a 100, e-mail válido até 254 (o motivo de 5 a 500 é do próprio diálogo)", async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail do dono"), "isso-nao-e-email");
    await user.tab();
    expect(screen.getByText(/Informe um e-mail válido/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Nome da marca ou agência"));
    await user.tab();
    expect(screen.getByText("O nome deve ter de 2 a 100 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da marca ou agência")).toHaveAttribute("maxlength", "100");
    expect(screen.getByLabelText("E-mail do dono")).toHaveAttribute("maxlength", "254");
  });

  it("envia o corpo do contrato (e-mail aparado e em minúsculas), com Idempotency-Key v4, e no sucesso avisa e abre o workspace", async () => {
    const { onClose } = renderDialog();
    const user = await fill();
    await user.click(create());

    await waitFor(() => expect(api.adminPost).toHaveBeenCalledTimes(1));
    const [path, body, options] = api.adminPost.mock.calls[0] as [string, Record<string, unknown>, { idempotencyKey: string }];
    expect(path).toBe("/admin/workspaces");
    expect(body).toEqual({
      workspace_name: "Marca Nova",
      account_type: "brand",
      owner_name: "Dona Nova",
      owner_email: "dona@marca.com.br",
      reason: "Cliente novo, fechado pelo comercial",
    });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(body).not.toHaveProperty("password");

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0][0]).toBe("Conta criada. Convite enviado para dona@marca.com.br.");
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(fakeRouter.navigations.at(-1)?.to).toBe("/admin/workspaces/$workspaceId"));
  });

  it("enquanto envia, o botão fica travado (sem envio duplo)", async () => {
    const pending = deferred<typeof RESULT>();
    api.adminPost.mockReturnValue(pending.promise);
    renderDialog();
    const user = await fill();
    await user.click(create());
    await waitFor(() => expect(screen.getByRole("button", { name: "Criando…" })).toBeDisabled());
    expect(api.adminPost).toHaveBeenCalledTimes(1);
    pending.resolve(RESULT);
  });

  it("e-mail já cadastrado (409): mostra a frase da tela e deixa o diálogo aberto", async () => {
    api.adminPost.mockRejectedValue(toAdminApiError(409, { statusCode: 409, error: "EMAIL_ALREADY_REGISTERED", message: "Email already registered" }));
    const { onClose } = renderDialog();
    const user = await fill();
    await user.click(create());
    expect(
      await screen.findByText("Este e-mail já está cadastrado. Para dar acesso a quem já tem conta, adicione como membro do workspace."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("o mesmo envio repetido depois de uma falha usa a MESMA chave; depois de um sucesso, a próxima conta usa chave nova", async () => {
    api.adminPost.mockRejectedValueOnce(toAdminApiError(500, { statusCode: 500, message: "x" })).mockResolvedValue(RESULT);
    renderDialog();
    const user = await fill();
    await user.click(create());
    await screen.findByRole("alert");
    await user.click(create());
    await waitFor(() => expect(api.adminPost).toHaveBeenCalledTimes(2));
    const keys = api.adminPost.mock.calls.map((call) => (call[2] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it("400 de validação: a mensagem que cita o campo aparece no campo certo", async () => {
    api.adminPost.mockRejectedValue(toAdminApiError(400, { statusCode: 400, message: ["owner_email must be an email", "workspace_name is too long"] }));
    renderDialog();
    const user = await fill();
    await user.click(create());
    expect(await screen.findByText("owner_email must be an email")).toBeInTheDocument();
    expect(screen.getByText("workspace_name is too long")).toBeInTheDocument();
  });

  it("429: pede para aguardar", async () => {
    api.adminPost.mockRejectedValue(toAdminApiError(429, { statusCode: 429, message: "Too Many Requests" }));
    renderDialog();
    const user = await fill();
    await user.click(create());
    expect(await screen.findByText(/Muitas tentativas em pouco tempo/)).toBeInTheDocument();
  });
});
