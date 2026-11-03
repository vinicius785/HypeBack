import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(() => "s1"), error: vi.fn(() => "e1"), info: vi.fn(() => "i1"), warning: vi.fn(() => "w1"), dismiss: vi.fn() },
}));

import { toast } from "sonner";

import { AdminApiError } from "@/lib/admin/admin-client";

import { ADMIN_TOAST_DURATION, adminErrorMessage, adminToast, normalizeToastText } from "./admin-toast";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminToast", () => {
  it("success chama toast.success com a duração curta e devolve o id do sonner", () => {
    const id = adminToast.success("Grupo salvo");
    expect(toast.success).toHaveBeenCalledWith("Grupo salvo", { duration: ADMIN_TOAST_DURATION.success });
    expect(id).toBe("s1");
  });

  it("info chama toast.info com a duração de informação", () => {
    adminToast.info("Nada mudou");
    expect(toast.info).toHaveBeenCalledWith("Nada mudou", { duration: ADMIN_TOAST_DURATION.info });
  });

  it("warning chama toast.warning com duração entre a informação e o erro, aceita id e duration e normaliza o texto", () => {
    const id = adminToast.warning("  Entrega parcial..  ");
    expect(toast.warning).toHaveBeenCalledWith("Entrega parcial.", { duration: ADMIN_TOAST_DURATION.warning });
    expect(id).toBe("w1");
    expect(ADMIN_TOAST_DURATION.warning).toBeGreaterThan(ADMIN_TOAST_DURATION.info);
    expect(ADMIN_TOAST_DURATION.warning).toBeLessThan(ADMIN_TOAST_DURATION.error);
    adminToast.warning("Limite perto", { id: "limite", duration: 1000 });
    expect(toast.warning).toHaveBeenLastCalledWith("Limite perto", { id: "limite", duration: 1000 });
  });

  it("error chama toast.error com a duração maior e sem botão quando não há retry", () => {
    adminToast.error("Não foi possível salvar");
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { duration: ADMIN_TOAST_DURATION.error });
    expect(ADMIN_TOAST_DURATION.error).toBeGreaterThan(ADMIN_TOAST_DURATION.success);
  });

  it("error com retry vira ação 'Tentar de novo', fica mais tempo e o clique chama o retry", () => {
    const retry = vi.fn();
    adminToast.error("Não foi possível salvar", { retry });
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    expect(options).toMatchObject({ duration: ADMIN_TOAST_DURATION.errorWithRetry, action: { label: "Tentar de novo" } });
    expect(ADMIN_TOAST_DURATION.errorWithRetry).toBeGreaterThan(ADMIN_TOAST_DURATION.error);
    (options as unknown as { action: { onClick: () => void } }).action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("retryLabel troca o texto do botão", () => {
    adminToast.error("Falhou", { retry: vi.fn(), retryLabel: "Recarregar" });
    expect(vi.mocked(toast.error).mock.calls[0][1]).toMatchObject({ action: { label: "Recarregar" } });
  });

  it("id estável é repassado (o mesmo aviso substitui em vez de empilhar) e duration troca o padrão", () => {
    adminToast.success("Salvo", { id: "save-group", duration: 1000 });
    adminToast.error("Falhou", { id: 7 });
    adminToast.info("Aviso", { id: "x" });
    expect(toast.success).toHaveBeenCalledWith("Salvo", { id: "save-group", duration: 1000 });
    expect(toast.error).toHaveBeenCalledWith("Falhou", { id: 7, duration: ADMIN_TOAST_DURATION.error });
    expect(toast.info).toHaveBeenCalledWith("Aviso", { id: "x", duration: ADMIN_TOAST_DURATION.info });
  });

  it("sem id, a chave id nem é enviada ao sonner", () => {
    adminToast.success("Salvo");
    expect(vi.mocked(toast.success).mock.calls[0][1]).not.toHaveProperty("id");
  });

  it("limpa o texto antes de mostrar", () => {
    adminToast.success("  Grupo   salvo..  ");
    expect(vi.mocked(toast.success).mock.calls[0][0]).toBe("Grupo salvo.");
  });

  it("dismiss fecha um aviso pelo id, ou todos", () => {
    adminToast.dismiss("save-group");
    adminToast.dismiss();
    expect(toast.dismiss).toHaveBeenNthCalledWith(1, "save-group");
    expect(toast.dismiss).toHaveBeenNthCalledWith(2, undefined);
  });
});

describe("normalizeToastText", () => {
  it("apara e junta espaços", () => {
    expect(normalizeToastText("  a \n  b  ")).toBe("a b");
  });
  it("não duplica a pontuação final", () => {
    expect(normalizeToastText("Falhou..")).toBe("Falhou.");
    expect(normalizeToastText("Falhou. .")).toBe("Falhou. .");
    expect(normalizeToastText("Certo!!")).toBe("Certo!");
    expect(normalizeToastText("Quê??")).toBe("Quê?");
  });
  it("reticências viram o caractere, e um ponto final só continua só", () => {
    expect(normalizeToastText("Aguarde...")).toBe("Aguarde…");
    expect(normalizeToastText("Salvo.")).toBe("Salvo.");
    expect(normalizeToastText("Salvo")).toBe("Salvo");
  });
});

describe("adminErrorMessage", () => {
  const apiError = (init: Partial<ConstructorParameters<typeof AdminApiError>[0]>) =>
    new AdminApiError({ status: 409, code: "CONFLICT", message: "Já existe um grupo com esse nome.", ...init });

  it("AdminApiError: usa o texto em português que o cliente montou", () => {
    expect(adminErrorMessage(apiError({}), "Falhou")).toBe("Já existe um grupo com esse nome.");
  });

  it("AdminApiError de rede e de servidor usa o texto do cliente", () => {
    const network = apiError({ status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor." });
    expect(adminErrorMessage(network, "Falhou")).toBe("Não foi possível falar com o servidor.");
  });

  it("validação com lista: uma frase para cada item, traduzida e sem repetir", () => {
    const error = apiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "reason must be longer than or equal to 5 characters, reason should not be empty",
      messages: ["reason must be longer than or equal to 5 characters", "reason should not be empty", "Informe o motivo."],
    });
    expect(adminErrorMessage(error, "Falhou")).toBe("O motivo precisa ter pelo menos 5 caracteres. Informe o motivo.");
  });

  it("validação com uma só mensagem usa a mensagem", () => {
    const error = apiError({ status: 422, code: "UNPROCESSABLE", message: "Nome muito longo.", messages: ["Nome muito longo."] });
    expect(adminErrorMessage(error, "Falhou")).toBe("Nome muito longo.");
  });

  it("validação com uma só mensagem em inglês do DTO é traduzida", () => {
    const error = apiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "reason must be longer than or equal to 5 characters",
      messages: ["reason must be longer than or equal to 5 characters"],
    });
    expect(adminErrorMessage(error, "Falhou")).toBe("O motivo precisa ter pelo menos 5 caracteres.");
  });

  it("erro da API do app (Error com status): usa o message do servidor", () => {
    const error = Object.assign(new Error("Este grupo já tem um líder."), { status: 409, code: "GROUP_HAS_LEADER" });
    expect(adminErrorMessage(error, "Falhou")).toBe("Este grupo já tem um líder.");
  });

  it("erro 5xx do app cai no fallback", () => {
    const error = Object.assign(new Error("QueryFailedError: relation x"), { status: 500 });
    expect(adminErrorMessage(error, "Não foi possível salvar")).toBe("Não foi possível salvar");
  });

  it("mensagem que é código ou texto padrão de HTTP cai no fallback", () => {
    for (const message of ["WORKSPACE_SUSPENDED", "Bad Request", "Request failed: /campaigns (500)", "Cannot GET /api/x"]) {
      const error = Object.assign(new Error(message), { status: 400 });
      expect(adminErrorMessage(error, "Não foi possível salvar")).toBe("Não foi possível salvar");
    }
  });

  it("erro técnico de rede/programação não vaza", () => {
    expect(adminErrorMessage(new TypeError("Failed to fetch"), "Não foi possível salvar")).toBe("Não foi possível salvar");
    expect(adminErrorMessage(new Error("x is not a function"), "Não foi possível salvar")).toBe("Não foi possível salvar");
  });

  it("string útil passa; string vazia ou técnica cai no fallback", () => {
    expect(adminErrorMessage("Sem permissão.", "Falhou")).toBe("Sem permissão.");
    expect(adminErrorMessage("  ", "Falhou")).toBe("Falhou");
    expect(adminErrorMessage("FORBIDDEN", "Falhou")).toBe("Falhou");
  });

  it("valor desconhecido usa o fallback; sem fallback, o texto genérico do Admin", () => {
    expect(adminErrorMessage(undefined, "Falhou")).toBe("Falhou");
    expect(adminErrorMessage(null)).toBe("Não foi possível concluir a operação.");
    expect(adminErrorMessage(42, "Falhou..")).toBe("Falhou.");
  });
});
