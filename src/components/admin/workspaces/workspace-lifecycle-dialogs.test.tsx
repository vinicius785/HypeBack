import { screen, waitFor, within } from "@testing-library/react";
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
import type { AdminDeleteBlocker } from "@/shared/admin-platform.types";

import {
  apiError,
  deferred,
  makeDetail,
  makeImpact,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  UUID_V4,
  WS_ID,
} from "./test-support";
import type { WorkspaceAction } from "./workspace-constants";
import { WorkspaceActionDialog } from "./workspace-lifecycle-dialogs";

const IMPACT_PATH = `/admin/workspaces/${WS_ID}/impact`;

const BLOCKERS: AdminDeleteBlocker[] = [
  { code: "HAS_CUSTODY_BALANCE", message: "O workspace tem R$ 45.000,50 em custódia. Resolva o saldo antes de excluir.", amount_cents: 4500050 },
  { code: "HAS_COMMITTED_FUNDS", message: "Há R$ 12.000,25 comprometidos em 4 reservas de criadores.", count: 4, amount_cents: 1200025 },
  { code: "HAS_PENDING_CHARGES", message: "Há 1 cobrança PIX aguardando pagamento (R$ 1.500,00).", count: 1, amount_cents: 150000 },
  { code: "HAS_WITHDRAWALS_IN_FLIGHT", message: "Há 2 saques de criadores em andamento (R$ 300,00).", count: 2, amount_cents: 30000 },
  { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Há 2 campanhas publicadas. Encerre ou despublique antes de excluir.", count: 2 },
];

function renderDialog(
  action: WorkspaceAction,
  { workspace = makeDetail(), onClose = vi.fn(), onSwitch = vi.fn() }: Partial<{ workspace: ReturnType<typeof makeDetail>; onClose: () => void; onSwitch: () => void }> = {},
) {
  const utils = renderWithQuery(
    <WorkspaceActionDialog action={action} workspace={workspace} onClose={onClose} onSwitch={onSwitch} />,
  );
  return { ...utils, onClose, onSwitch };
}

/** Texto da tela com o espaço sem quebra do dinheiro ("R$ 1,00") trocado por espaço comum. */
const pageText = () => (document.body.textContent ?? "").replace(/\u00a0/g, " ");
const reasonBox = () => screen.getByLabelText(/^Motivo/);
const typedBox = () => screen.getByLabelText(/Para confirmar, digite/);
const button = (name: string) => screen.getByRole("button", { name });
const postCall = (index = 0) => {
  const [path, body, options] = api.adminPost.mock.calls[index] as [string, Record<string, unknown>, { idempotencyKey: string }];
  return { path, body, key: options.idempotencyKey };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact() });
  api.adminPost.mockImplementation(async () => makeDetail("suspended"));
});
afterEach(() => vi.useRealTimers());

describe("Suspender, reativar, desarquivar e restaurar", () => {
  it("Suspender mostra o que acontece (texto do impacto) e exige motivo de 5 a 500 caracteres", async () => {
    renderDialog("suspend");

    expect(screen.getByRole("dialog", { name: "Suspender workspace" })).toBeInTheDocument();
    expect(await screen.findByText("O time do cliente perde todo o acesso até a reativação.")).toBeInTheDocument();
    expect(screen.getByText("O dinheiro não para: aportes e saques continuam.")).toBeInTheDocument();

    expect(button("Suspender")).toBeDisabled();
    await userEvent.type(reasonBox(), "abc");
    expect(button("Suspender")).toBeDisabled();
    await userEvent.type(reasonBox(), "d");
    expect(button("Suspender")).toBeDisabled(); // 4 caracteres ainda não bastam
    await userEvent.type(reasonBox(), "e");
    expect(button("Suspender")).toBeEnabled();
    expect(reasonBox()).toHaveAttribute("maxLength", "500");
  });

  it("motivo só de espaços não vale", async () => {
    renderDialog("suspend");
    await userEvent.type(reasonBox(), "          ");
    expect(button("Suspender")).toBeDisabled();
  });

  it("envia o motivo aparado com uma Idempotency-Key v4, avisa, fecha e grava o workspace novo no detalhe", async () => {
    const { client, onClose } = renderDialog("suspend");
    await userEvent.type(reasonBox(), "  Cobrança em aberto há 60 dias  ");
    await userEvent.click(button("Suspender"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { path, body, key } = postCall();
    expect(path).toBe(`/admin/workspaces/${WS_ID}/suspend`);
    expect(body).toEqual({ reason: "Cobrança em aberto há 60 dias" });
    expect(key).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Workspace suspenso.");
    expect(client.getQueryData(workspaceDetailKey(WS_ID))).toEqual(makeDetail("suspended"));
  });

  it("depois de um sucesso, invalida tudo do Admin (listas, usuários, atividade, visão geral…)", async () => {
    const { client, onClose } = renderDialog("suspend");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Suspender"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it("se o texto do que acontece não carregar, ainda dá para confirmar (suspender não usa o token)", async () => {
    api.adminGet.mockRejectedValue(apiError(403, "FORBIDDEN", "x"));
    const { onClose } = renderDialog("suspend");

    expect(await screen.findByText(/Não foi possível carregar o que acontece com a suspensão/)).toBeInTheDocument();
    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Suspender"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it.each([
    ["reactivate", "Reativar", "reactivate", "Workspace reativado."],
    ["unarchive", "Desarquivar", "unarchive", "Workspace desarquivado."],
    ["restore", "Restaurar", "restore", "Workspace restaurado."],
  ] as const)("%s: só o motivo, no caminho certo, sem consultar o impacto", async (action, label, route, done) => {
    const { onClose } = renderDialog(action);
    expect(screen.getByRole("dialog", { name: new RegExp(label) })).toBeInTheDocument();

    await userEvent.type(reasonBox(), "Cliente regularizou o pagamento");
    await userEvent.click(button(label));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(postCall().path).toBe(`/admin/workspaces/${WS_ID}/${route}`);
    expect(postCall().body).toEqual({ reason: "Cliente regularizou o pagamento" });
    expect(toast.success).toHaveBeenCalledWith(done);
    expect(api.adminGet).not.toHaveBeenCalled();
  });

  it("erro de validação do servidor aparece no diálogo, que continua aberto para corrigir", async () => {
    api.adminPost.mockRejectedValue(
      Object.assign(apiError(400, "BAD_REQUEST", "reason deve ter entre 5 e 500 caracteres"), {}),
    );
    const { onClose } = renderDialog("reactivate");
    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Reativar"));

    expect(await screen.findByRole("alert")).toHaveTextContent("reason deve ter entre 5 e 500 caracteres");
    expect(onClose).not.toHaveBeenCalled();
    expect(button("Reativar")).toBeEnabled();
  });

  it("estado que mudou por fora (INVALID_STATE_TRANSITION): avisa, fecha e consulta tudo de novo", async () => {
    api.adminPost.mockRejectedValue(apiError(409, "INVALID_STATE_TRANSITION", "Não é possível suspender um workspace suspenso."));
    const { client, onClose } = renderDialog("suspend");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Suspender"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/estado do workspace mudou/));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it("enquanto grava, tudo trava e o botão mostra o andamento", async () => {
    const pending = deferred<ReturnType<typeof makeDetail>>();
    api.adminPost.mockReturnValue(pending.promise);
    renderDialog("reactivate");
    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Reativar"));

    expect(await screen.findByRole("button", { name: "Reativando…" })).toBeDisabled();
    expect(button("Cancelar")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    pending.resolve(makeDetail("active"));
  });

  it("reenviar depois de uma queda de rede usa a MESMA chave; motivo diferente, chave nova", async () => {
    api.adminPost
      .mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Sem rede"))
      .mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Sem rede"))
      .mockResolvedValue(makeDetail("active"));
    renderDialog("reactivate");

    await userEvent.type(reasonBox(), "Motivo de teste");
    await userEvent.click(button("Reativar"));
    await screen.findByRole("alert");
    await userEvent.click(button("Reativar"));
    await waitFor(() => expect(api.adminPost).toHaveBeenCalledTimes(2));
    expect(postCall(1).key).toBe(postCall(0).key);

    await screen.findByRole("alert");
    await userEvent.type(reasonBox(), " outro");
    await userEvent.click(button("Reativar"));
    await waitFor(() => expect(api.adminPost).toHaveBeenCalledTimes(3));
    expect(postCall(2).key).not.toBe(postCall(0).key);
    expect(postCall(2).key).toMatch(UUID_V4);
  });
});

describe("Arquivar e excluir · resumo de impacto", () => {
  it("abre buscando o impacto e mostra contagens, dinheiro exato, avisos e o que acontece", async () => {
    const pending = deferred<ReturnType<typeof makeImpact>>();
    api.adminGet.mockReturnValue(pending.promise);
    renderDialog("archive");

    expect(screen.getByRole("status")).toHaveTextContent("Carregando o resumo de impacto…");
    expect(button("Arquivar")).toBeDisabled();

    pending.resolve(makeImpact());
    expect(await screen.findByText("O que existe hoje")).toBeInTheDocument();

    const text = pageText();
    expect(text).toContain("R$ 45.000,50"); // custódia
    expect(text).toContain("R$ 12.000,25"); // comprometido
    expect(text).toContain("R$ 1.234.567,89"); // aportado no total
    expect(text).toContain("2 publicadas · 3 rascunhos · 3 finalizadas");
    expect(text).toContain("90 participações");
    expect(text).toContain("1 cobrança"); // pendentes
    expect(text).toContain("2 saques");
    expect(text).toContain("4 reservados · 2 em carência · 7 sacados");
    expect(text).toMatch(/Resumo calculado em 31\/10\/2026 12:00/);
    expect(screen.getByText("O time do cliente passa a ver o workspace somente em modo leitura.")).toBeInTheDocument();
    expect(screen.getByText("6 pessoas da equipe do cliente perdem o acesso ao workspace.")).toBeInTheDocument();
    expect(api.adminGet).toHaveBeenCalledWith(IMPACT_PATH, undefined, expect.anything());
  });

  it("o resumo é sempre fresco: reabrir o diálogo consulta de novo e volta ao carregando (sem token velho)", async () => {
    const first = renderDialog("archive");
    await screen.findByText("O que existe hoje");
    first.unmount();

    api.adminGet.mockReturnValue(deferred<never>().promise);
    renderDialog("archive");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando o resumo de impacto…");
    expect(screen.queryByText("O que existe hoje")).not.toBeInTheDocument();
    expect(api.adminGet).toHaveBeenCalledTimes(2);
  });

  it("sem permissão para ver o resumo: erro claro e excluir fica desabilitado", async () => {
    api.adminGet.mockRejectedValue(apiError(403, "FORBIDDEN", "x"));
    renderDialog("delete");

    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
    expect(button("Excluir workspace")).toBeDisabled();
  });

  it("erro do servidor no resumo: 'Tentar de novo' recarrega e o diálogo passa a funcionar", async () => {
    api.adminGet.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    renderDialog("archive");

    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    expect(button("Arquivar")).toBeDisabled();

    routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact() });
    await userEvent.click(retry);
    expect(await screen.findByText("O que existe hoje")).toBeInTheDocument();
  });

  it("workspace que não existe mais: 'Não encontrado'", async () => {
    api.adminGet.mockRejectedValue(apiError(404, "NOT_FOUND", "Não encontramos este registro."));
    renderDialog("archive");
    expect(await screen.findByText("Não encontrado")).toBeInTheDocument();
  });
});

describe("Arquivar", () => {
  it("só confirma com o resumo na tela, o motivo e o nome digitado (sem diferenciar caixa nem espaços das pontas)", async () => {
    renderDialog("archive");
    await screen.findByText("O que existe hoje");

    expect(button("Arquivar")).toBeDisabled();
    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    expect(button("Arquivar")).toBeDisabled(); // falta o nome

    await userEvent.type(typedBox(), "Café Serra");
    expect(button("Arquivar")).toBeDisabled(); // nome incompleto

    await userEvent.clear(typedBox());
    await userEvent.type(typedBox(), "  café serra verde ");
    expect(button("Arquivar")).toBeEnabled();
  });

  it("manda motivo, o nome como foi digitado e o impact_token que a pessoa viu", async () => {
    api.adminPost.mockResolvedValue(makeDetail("archived"));
    const { onClose } = renderDialog("archive");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    await userEvent.type(typedBox(), " café serra verde ");
    await userEvent.click(button("Arquivar"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { path, body, key } = postCall();
    expect(path).toBe(`/admin/workspaces/${WS_ID}/archive`);
    expect(body).toEqual({ reason: "Cliente pediu pausa", confirm_name: "café serra verde", impact_token: "token-1" });
    expect(key).toMatch(UUID_V4);
    expect(toast.success).toHaveBeenCalledWith("Workspace arquivado.");
  });

  it("arquivar NÃO é travado por impedimentos de exclusão (a saída é justamente arquivar)", async () => {
    routeReads(api.adminGet, { [IMPACT_PATH]: makeImpact({ blockers: BLOCKERS, can: { delete: false } }) });
    renderDialog("archive");
    await screen.findByText("O que existe hoje");
    expect(screen.queryByText("A exclusão está bloqueada")).not.toBeInTheDocument();

    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    await userEvent.type(typedBox(), "Café Serra Verde");
    expect(button("Arquivar")).toBeEnabled();
  });
});

describe("Excluir · impedimentos", () => {
  beforeEach(() => {
    routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact({ blockers: BLOCKERS, can: { delete: false } }) });
  });

  it("com impedimentos o botão fica desabilitado e cada um é explicado com quantidade e valor exatos", async () => {
    renderDialog("delete");
    const group = await screen.findByRole("group", { name: "Impedimentos da exclusão" });

    expect(button("Excluir workspace")).toBeDisabled();
    expect(within(group).getByText("Saldo em custódia")).toBeInTheDocument();
    expect(within(group).getByText("R$ 45.000,50")).toBeInTheDocument();
    expect(within(group).getByText("Valor comprometido")).toBeInTheDocument();
    expect(within(group).getByText("4 · R$ 12.000,25")).toBeInTheDocument();
    expect(within(group).getByText("Cobranças pendentes")).toBeInTheDocument();
    expect(within(group).getByText("1 · R$ 1.500,00")).toBeInTheDocument();
    expect(within(group).getByText("Saques em andamento")).toBeInTheDocument();
    expect(within(group).getByText("2 · R$ 300,00")).toBeInTheDocument();
    expect(within(group).getByText("Campanhas publicadas")).toBeInTheDocument();
    expect(within(group).getByText("Há 2 campanhas publicadas. Encerre ou despublique antes de excluir.")).toBeInTheDocument();
    expect(within(group).getByText(/Resolva os impedimentos acima para poder excluir, ou arquive o workspace em vez de excluir\./)).toBeInTheDocument();
  });

  it("bloqueado, não há motivo nem nome para digitar; o botão de cancelar vira 'Fechar' e nada é enviado", async () => {
    const { onClose } = renderDialog("delete");
    await screen.findByRole("group", { name: "Impedimentos da exclusão" });

    expect(screen.queryByLabelText(/^Motivo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Para confirmar, digite/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    // o "x" do cabeçalho e o botão do rodapé têm o mesmo nome; o do rodapé vem por último
    await userEvent.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);
    expect(onClose).toHaveBeenCalled();
    expect(api.adminPost).not.toHaveBeenCalled();
  });

  it("'Arquivar em vez de excluir' leva ao diálogo de arquivar (quando o estado permite)", async () => {
    const { onSwitch } = renderDialog("delete");
    await screen.findByRole("group", { name: "Impedimentos da exclusão" });
    await userEvent.click(button("Arquivar em vez de excluir"));
    expect(onSwitch).toHaveBeenCalledWith("archive");
  });

  it("workspace que já está arquivado: sem o atalho de arquivar", async () => {
    renderDialog("delete", { workspace: makeDetail("archived") });
    await screen.findByRole("group", { name: "Impedimentos da exclusão" });
    expect(screen.queryByRole("button", { name: "Arquivar em vez de excluir" })).not.toBeInTheDocument();
    expect(screen.getByText(/Resolva os impedimentos acima para poder excluir\./)).toBeInTheDocument();
  });
});

describe("Excluir · confirmação", () => {
  it("sem impedimentos: motivo + nome digitado habilitam; é um alertdialog (ação destrutiva)", async () => {
    api.adminPost.mockResolvedValue(makeDetail("deleted"));
    const { onClose } = renderDialog("delete");
    await screen.findByText("O que existe hoje");

    expect(screen.getByRole("alertdialog", { name: "Excluir workspace" })).toBeInTheDocument();
    expect(screen.getByText("O workspace some para o time do cliente (exclusão lógica).")).toBeInTheDocument();
    await userEvent.type(reasonBox(), "Cliente encerrou o contrato");
    expect(button("Excluir workspace")).toBeDisabled();
    await userEvent.type(typedBox(), "Café Serra Verde");
    expect(button("Excluir workspace")).toBeEnabled();
    await userEvent.click(button("Excluir workspace"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(postCall().path).toBe(`/admin/workspaces/${WS_ID}/delete`);
    expect(postCall().body).toEqual({ reason: "Cliente encerrou o contrato", confirm_name: "Café Serra Verde", impact_token: "token-1" });
    expect(toast.success).toHaveBeenCalledWith("Workspace excluído.");
  });

  it("nome digitado errado (CONFIRMATION_MISMATCH do servidor): mensagem clara, diálogo aberto", async () => {
    api.adminPost.mockRejectedValue(apiError(422, "CONFIRMATION_MISMATCH", "x"));
    const { onClose } = renderDialog("delete");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente encerrou o contrato");
    await userEvent.type(typedBox(), "Café Serra Verde");
    await userEvent.click(button("Excluir workspace"));

    expect(await screen.findByRole("alert")).toHaveTextContent("O nome digitado não confere com o nome do workspace.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("estado que mudou por fora: fecha e avisa", async () => {
    api.adminPost.mockRejectedValue(apiError(409, "INVALID_STATE_TRANSITION", "x"));
    const { onClose } = renderDialog("delete");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente encerrou o contrato");
    await userEvent.type(typedBox(), "Café Serra Verde");
    await userEvent.click(button("Excluir workspace"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/estado do workspace mudou/));
  });

  it("WORKSPACE_DELETE_BLOCKED na recusa: os impedimentos entram na tela e excluir trava", async () => {
    api.adminPost.mockRejectedValue(apiError(409, "WORKSPACE_DELETE_BLOCKED", "x", { blockers: BLOCKERS.slice(0, 2) }));
    const { onClose } = renderDialog("delete");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente encerrou o contrato");
    await userEvent.type(typedBox(), "Café Serra Verde");

    // o servidor passa a apontar os impedimentos; o resumo recarregado concorda
    routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact({ blockers: BLOCKERS.slice(0, 2), can: { delete: false }, impact_token: "token-2" }) });
    await userEvent.click(button("Excluir workspace"));

    const group = await screen.findByRole("group", { name: "Impedimentos da exclusão" });
    expect(within(group).getByText("Saldo em custódia")).toBeInTheDocument();
    expect(within(group).getByText("Valor comprometido")).toBeInTheDocument();
    expect(button("Excluir workspace")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/A exclusão está bloqueada: resolva os impedimentos/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("enquanto o resumo recarrega depois da recusa, vale o que o servidor apontou", async () => {
    api.adminPost.mockRejectedValue(apiError(409, "WORKSPACE_DELETE_BLOCKED", "x", { blockers: BLOCKERS.slice(0, 1) }));
    renderDialog("delete");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente encerrou o contrato");
    await userEvent.type(typedBox(), "Café Serra Verde");

    const refetch = deferred<ReturnType<typeof makeImpact>>();
    api.adminGet.mockReturnValue(refetch.promise);
    await userEvent.click(button("Excluir workspace"));

    expect(await screen.findByRole("group", { name: "Impedimentos da exclusão" })).toBeInTheDocument();
    expect(screen.getByText("Atualizando o resumo…")).toBeInTheDocument();
    refetch.resolve(makeImpact({ blockers: BLOCKERS.slice(0, 1), can: { delete: false } }));
    await waitFor(() => expect(screen.queryByText("Atualizando o resumo…")).not.toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Impedimentos da exclusão" })).toBeInTheDocument();
  });
});

describe("Token de impacto", () => {
  it("IMPACT_TOKEN_MISMATCH: recarrega o resumo, avisa que mudou, preserva o digitado e reenvia com o token novo e chave nova", async () => {
    api.adminPost.mockRejectedValueOnce(apiError(409, "IMPACT_TOKEN_MISMATCH", "x")).mockResolvedValueOnce(makeDetail("archived"));
    const { onClose } = renderDialog("archive");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    await userEvent.type(typedBox(), "Café Serra Verde");

    // o workspace mudou desde que o resumo foi mostrado: outro dinheiro, outro token
    routeReads(api.adminGet, {
      [IMPACT_PATH]: () =>
        makeImpact({ impact_token: "token-2", money: { ...makeImpact().money, custody_cents: 9999900 } }),
    });
    await userEvent.click(button("Arquivar"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Os números do workspace mudaram desde que o resumo foi mostrado");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(pageText()).toContain("R$ 99.999,00"));
    expect(api.adminGet).toHaveBeenCalledTimes(2);
    expect(reasonBox()).toHaveValue("Cliente pediu pausa");
    expect(typedBox()).toHaveValue("Café Serra Verde");

    await waitFor(() => expect(button("Arquivar")).toBeEnabled());
    await userEvent.click(button("Arquivar"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(postCall(0).body.impact_token).toBe("token-1");
    expect(postCall(1).body.impact_token).toBe("token-2");
    expect(postCall(1).key).toMatch(UUID_V4);
    expect(postCall(1).key).not.toBe(postCall(0).key);
  });

  it("token vencido (passou dos 10 minutos): nem envia, avisa, recarrega o resumo e deixa confirmar de novo", async () => {
    routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact({ impact_token_expires_at: "2026-10-31T14:59:00.000Z" }) });
    api.adminPost.mockResolvedValue(makeDetail("archived"));
    const { onClose } = renderDialog("archive");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    await userEvent.type(typedBox(), "Café Serra Verde");

    routeReads(api.adminGet, { [IMPACT_PATH]: () => makeImpact({ impact_token: "token-novo" }) });
    await userEvent.click(button("Arquivar"));

    expect(await screen.findByRole("alert")).toHaveTextContent("O resumo de impacto expirou (ele vale 10 minutos)");
    expect(api.adminPost).not.toHaveBeenCalled();
    expect(api.adminGet).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(button("Arquivar")).toBeEnabled());
    await userEvent.click(button("Arquivar"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(postCall().body.impact_token).toBe("token-novo");
  });

  it("repetir o mesmo envio (queda de rede) reaproveita a Idempotency-Key", async () => {
    api.adminPost.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Sem rede")).mockResolvedValueOnce(makeDetail("archived"));
    const { onClose } = renderDialog("archive");
    await screen.findByText("O que existe hoje");
    await userEvent.type(reasonBox(), "Cliente pediu pausa");
    await userEvent.type(typedBox(), "Café Serra Verde");

    await userEvent.click(button("Arquivar"));
    await screen.findByRole("alert");
    await userEvent.click(button("Arquivar"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(postCall(1).key).toBe(postCall(0).key);
    expect(postCall(1).body).toEqual(postCall(0).body);
  });
});
