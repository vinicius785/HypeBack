import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { toast } from "sonner";

import { workspaceDetailKey } from "@/hooks/admin/use-admin-workspaces";
import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { apiError, deferred, makeDetail, NOW_ISO, renderWithQuery, UUID_V4, WS_ID } from "./test-support";
import { WorkspaceEditDialog } from "./workspace-edit-dialog";

const UPDATED = makeDetail("active", { name: "Café Novo" });

/** O mesmo diálogo sob o mesmo cliente de consultas, para trocar o `workspace` de fora (`rerender`). */
function Harness({ client, workspace }: { client: QueryClient; workspace: AdminWorkspaceDetail }) {
  return (
    <QueryClientProvider client={client}>
      <WorkspaceEditDialog open workspace={workspace} onClose={() => undefined} />
    </QueryClientProvider>
  );
}

function renderDialog(workspace = makeDetail(), onClose = vi.fn()) {
  const utils = renderWithQuery(<WorkspaceEditDialog open workspace={workspace} onClose={onClose} />);
  return { ...utils, onClose };
}

const field = (label: string) => screen.getByLabelText(label);
const save = () => screen.getByRole("button", { name: "Salvar alterações" });
const reason = () => screen.getByLabelText(/^Motivo/);
const patch = (index = 0) => {
  const [path, body, options] = api.adminPatch.mock.calls[index] as [string, Record<string, unknown>, { idempotencyKey: string }];
  return { path, body, key: options.idempotencyKey };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  api.adminPatch.mockResolvedValue(UPDATED);
});
afterEach(() => vi.useRealTimers());

describe("WorkspaceEditDialog · abertura", () => {
  it("vem preenchido com os dados do workspace (CNPJ e CEP com máscara) e o foco no nome", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Editar dados" })).toBeInTheDocument();
    expect(field("Nome")).toHaveValue("Café Serra Verde");
    expect(field("Nome")).toHaveFocus();
    expect(field("Razão social")).toHaveValue("Serra Verde Cafés Ltda");
    expect(field("CNPJ")).toHaveValue("11.222.333/0001-81");
    expect(field("Descrição")).toHaveValue("Cafés especiais da Serra Verde.");
    expect(field("CEP")).toHaveValue("01310-100");
    expect(field("Rua")).toHaveValue("Avenida Paulista");
    expect(field("Número")).toHaveValue("1578");
    expect(field("Complemento")).toHaveValue("Sala 4");
    expect(field("Bairro")).toHaveValue("Bela Vista");
    expect(field("Cidade")).toHaveValue("São Paulo");
    expect(field("UF")).toHaveValue("SP");
  });

  it("só os campos permitidos pelo contrato (o estado do workspace não é editável aqui)", () => {
    renderDialog();
    expect(screen.queryByLabelText(/status|estado do workspace/i)).not.toBeInTheDocument();
    expect(screen.getByText(/O estado do workspace \(ativo, suspenso…\) não muda por aqui\./)).toBeInTheDocument();
  });

  it("sem nenhuma alteração: 'Salvar' desabilitado, com o aviso, mesmo com o motivo preenchido", async () => {
    renderDialog();
    expect(screen.getByText("Nenhum campo foi alterado ainda.")).toBeInTheDocument();
    await userEvent.type(reason(), "Ajuste solicitado pelo cliente");
    expect(save()).toBeDisabled();
  });

  it("no-op não faz nada: nem Enter envia (nenhuma chamada)", async () => {
    const { onClose } = renderDialog();
    await userEvent.type(reason(), "Ajuste solicitado pelo cliente{Enter}");
    expect(api.adminPatch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mudar e desfazer volta ao no-op (a máscara e os espaços não contam como mudança)", async () => {
    renderDialog();
    await userEvent.type(reason(), "Ajuste solicitado pelo cliente");
    await userEvent.clear(field("CNPJ"));
    await userEvent.type(field("CNPJ"), "11222333000181");
    await userEvent.type(field("Nome"), " ");
    expect(save()).toBeDisabled();

    await userEvent.type(field("Nome"), "X");
    expect(save()).toBeEnabled();
    await userEvent.type(field("Nome"), "{Backspace}{Backspace}");
    expect(save()).toBeDisabled();
  });
});

describe("WorkspaceEditDialog · dado digitado", () => {
  it("com um campo alterado o clique fora não fecha e nada se perde; Escape fecha", async () => {
    const { onClose } = renderDialog();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.clear(field("Nome"));
    await user.type(field("Nome"), "Café Novo");

    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(field("Nome")).toHaveValue("Café Novo");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sem nada digitado o clique fora fecha", async () => {
    const { onClose } = renderDialog();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("WorkspaceEditDialog · envio", () => {
  it("manda só o campo que mudou, com o motivo aparado e a Idempotency-Key; grava o workspace novo e avisa", async () => {
    const { client, onClose } = renderDialog();
    await userEvent.clear(field("Nome"));
    await userEvent.type(field("Nome"), "  Café Novo ");
    await userEvent.type(reason(), "  Cliente trocou o nome fantasia  ");
    await userEvent.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patch().path).toBe(`/admin/workspaces/${WS_ID}`);
    expect(patch().body).toEqual({ reason: "Cliente trocou o nome fantasia", name: "Café Novo" });
    expect(patch().key).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Dados do workspace atualizados.");
    expect(client.getQueryData(workspaceDetailKey(WS_ID))).toEqual(UPDATED);
  });

  it("CNPJ e CEP vão só com os dígitos, UF em maiúsculas; campo esvaziado vai como null", async () => {
    const { onClose } = renderDialog();
    await userEvent.clear(field("CNPJ"));
    await userEvent.type(field("CNPJ"), "12.345.678/0001-95");
    await userEvent.clear(field("CEP"));
    await userEvent.type(field("CEP"), "20040-020");
    await userEvent.clear(field("UF"));
    await userEvent.type(field("UF"), "rj");
    await userEvent.clear(field("Complemento"));
    await userEvent.clear(field("Descrição"));
    await userEvent.type(reason(), "Mudança de endereço e CNPJ");
    await userEvent.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patch().body).toEqual({
      reason: "Mudança de endereço e CNPJ",
      tax_id: "12345678000195",
      postal_code: "20040020",
      state: "RJ",
      unit: null,
      description: null,
    });
  });

  it("os campos que não foram tocados NÃO vão no corpo", async () => {
    renderDialog();
    await userEvent.clear(field("Cidade"));
    await userEvent.type(field("Cidade"), "Santos");
    await userEvent.type(reason(), "Mudança de cidade");
    await userEvent.click(save());

    await waitFor(() => expect(api.adminPatch).toHaveBeenCalled());
    expect(Object.keys(patch().body).sort()).toEqual(["city", "reason"]);
  });

  it("enquanto grava tudo trava e o botão mostra o andamento", async () => {
    const pending = deferred<typeof UPDATED>();
    api.adminPatch.mockReturnValue(pending.promise);
    renderDialog();
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "Mudança de nome");
    await userEvent.click(save());

    expect(await screen.findByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(field("Nome")).toHaveAttribute("readonly");
    pending.resolve(UPDATED);
  });

  it("depois de uma falha de rede, reenviar o mesmo conteúdo usa a MESMA Idempotency-Key", async () => {
    api.adminPatch.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Sem rede")).mockResolvedValueOnce(UPDATED);
    const { onClose } = renderDialog();
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "Mudança de nome");
    await userEvent.click(save());
    await screen.findByRole("alert");
    await userEvent.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patch(1).key).toBe(patch(0).key);
  });
});

describe("WorkspaceEditDialog · validação", () => {
  it("nome vazio é inválido; o erro aparece ao sair do campo e trava o botão", async () => {
    renderDialog();
    await userEvent.type(reason(), "Mudança de nome");
    await userEvent.clear(field("Nome"));
    await userEvent.tab();

    expect(screen.getByText("Informe o nome do workspace.")).toBeInTheDocument();
    expect(field("Nome")).toHaveAttribute("aria-invalid", "true");
    expect(save()).toBeDisabled();
  });

  it("CNPJ com menos de 14 dígitos é recusado; com os 14 (com ou sem máscara) vale", async () => {
    renderDialog();
    await userEvent.type(reason(), "Correção do CNPJ");
    await userEvent.clear(field("CNPJ"));
    await userEvent.type(field("CNPJ"), "12.345.678/0001");
    await userEvent.tab();
    expect(screen.getByText("CNPJ inválido: informe os 14 dígitos.")).toBeInTheDocument();
    expect(save()).toBeDisabled();

    await userEvent.clear(field("CNPJ"));
    await userEvent.type(field("CNPJ"), "12345678000195");
    expect(save()).toBeEnabled();
    expect(screen.queryByText("CNPJ inválido: informe os 14 dígitos.")).not.toBeInTheDocument();
  });

  it("CNPJ com 14 dígitos mas dígito verificador errado é recusado antes do envio", async () => {
    renderDialog();
    await userEvent.type(reason(), "Correção do CNPJ");
    await userEvent.clear(field("CNPJ"));
    await userEvent.type(field("CNPJ"), "12.345.678/0001-99");
    await userEvent.tab();
    expect(screen.getByText("CNPJ inválido: os dígitos verificadores não conferem.")).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(api.adminPatch).not.toHaveBeenCalled();
  });

  it("CEP precisa de 8 dígitos e UF de 2 letras", async () => {
    renderDialog();
    await userEvent.type(reason(), "Correção do endereço");
    await userEvent.clear(field("CEP"));
    await userEvent.type(field("CEP"), "0131");
    await userEvent.clear(field("UF"));
    await userEvent.type(field("UF"), "S");
    await userEvent.tab();

    expect(screen.getByText("CEP inválido: informe os 8 dígitos.")).toBeInTheDocument();
    expect(screen.getByText("UF inválida: informe 2 letras (ex.: SP).")).toBeInTheDocument();
    expect(save()).toBeDisabled();

    await userEvent.clear(field("CEP"));
    await userEvent.type(field("CEP"), "20040020");
    await userEvent.type(field("UF"), "J");
    expect(screen.queryByText("CEP inválido: informe os 8 dígitos.")).not.toBeInTheDocument();
    expect(screen.queryByText("UF inválida: informe 2 letras (ex.: SP).")).not.toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("limpar o CNPJ é permitido (vira null); a UF aceita só 2 caracteres", async () => {
    renderDialog();
    await userEvent.clear(field("CNPJ"));
    await userEvent.type(reason(), "Remover o CNPJ errado");
    expect(save()).toBeEnabled();
    expect(field("UF")).toHaveAttribute("maxLength", "2");
  });

  it("dado antigo fora do padrão não impede de editar outro campo (só o que muda é conferido)", async () => {
    renderDialog(makeDetail("active", { tax_id: "1234", address: { ...makeDetail().address, postal_code: "99" } }));
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "Mudança de nome");

    expect(save()).toBeEnabled();
    await userEvent.click(save());
    await waitFor(() => expect(api.adminPatch).toHaveBeenCalled());
    expect(Object.keys(patch().body).sort()).toEqual(["name", "reason"]);
  });

  it("motivo continua sendo de 5 a 500 caracteres", async () => {
    renderDialog();
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "curto");
    expect(save()).toBeEnabled();
    await userEvent.clear(reason());
    await userEvent.type(reason(), "1234");
    expect(save()).toBeDisabled();
    expect(reason()).toHaveAttribute("maxLength", "500");
  });
});

describe("WorkspaceEditDialog · erros do servidor", () => {
  async function submitWith(error: unknown) {
    api.adminPatch.mockRejectedValue(error);
    const utils = renderDialog();
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "Mudança de nome");
    await userEvent.click(save());
    return utils;
  }

  it("validação (400): as mensagens do servidor aparecem e o diálogo continua aberto", async () => {
    const { onClose } = await submitWith(
      toAdminApiError(400, { statusCode: 400, message: ["name deve ter entre 1 e 100 caracteres", "tax_id deve ter 14 dígitos (CNPJ)"] }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("name deve ter entre 1 e 100 caracteres · tax_id deve ter 14 dígitos (CNPJ)");
    expect(onClose).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it("workspace mudou por fora (INVALID_STATE_TRANSITION): avisa, fecha e consulta tudo de novo", async () => {
    api.adminPatch.mockRejectedValue(apiError(409, "INVALID_STATE_TRANSITION", "x"));
    const { client, onClose } = renderDialog();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.type(field("Nome"), "!");
    await userEvent.type(reason(), "Mudança de nome");
    await userEvent.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/estado do workspace mudou/));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it("sem permissão", async () => {
    await submitWith(apiError(403, "FORBIDDEN", "x"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão para fazer isso.");
  });
});

describe("WorkspaceEditDialog · valores congelados na abertura", () => {
  it("uma nova consulta do detalhe enquanto edita não mexe no que a pessoa está digitando nem no que conta como mudança", async () => {
    const client = new QueryClient();
    const { rerender } = render(<Harness client={client} workspace={makeDetail()} />);
    await userEvent.clear(field("Cidade"));
    await userEvent.type(field("Cidade"), "Santos");

    // o detalhe foi recarregado com outro nome (outra pessoa salvou algo)
    rerender(<Harness client={client} workspace={makeDetail("active", { name: "Nome alterado por outra pessoa" })} />);

    expect(field("Cidade")).toHaveValue("Santos");
    expect(field("Nome")).toHaveValue("Café Serra Verde");
  });
});
