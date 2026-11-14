/**
 * Faixa e pedido de código da Operação Escudo (montados no layout do Admin).
 *
 * O QUE PRECISA FUNCIONAR:
 *   - a faixa só existe com o Escudo ligado e diz até quando e quanto falta;
 *   - o pedido do código abre quando uma alteração o exige, devolve os 6 dígitos e some; Cancelar devolve `null`;
 *   - o código digitado não vai para o armazenamento do navegador.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminGet: vi.fn(), auth: { user: { id: 1, platform_role: "admin", is_platform_admin: true } as Record<string, unknown> } }));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));

import { askShieldCode, isShieldActive } from "@/lib/admin/shield";

import { createTestQueryClient, renderRoutes, stubRoute } from "../../users/admin-users-test-utils";
import { ShieldBanner } from "./shield-banner";
import { ShieldCodePrompt } from "./shield-code-prompt";

const status = (over: Record<string, unknown> = {}) => ({
  configured: true,
  active: true,
  id: 1,
  activated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 5 * 3_600_000 + 30 * 60_000).toISOString(),
  reason: "Teste",
  activated_by: { user_id: 1, name: "Marina" },
  ...over,
});

beforeEach(() => {
  mocks.adminGet.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe("faixa da Operação Escudo", () => {
  it("com o Escudo ligado mostra até quando e quanto falta", async () => {
    mocks.adminGet.mockResolvedValue(status());
    renderRoutes([{ path: "/", component: ShieldBanner }, stubRoute("/admin/security")], "/");
    expect(await screen.findByText("Operação Escudo ativa")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/até \d{2}\/\d{2} \d{2}:\d{2}/);
    expect(screen.getByRole("status")).toHaveTextContent(/falta 5 h/);
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toBeInTheDocument();
  });

  it("desligado, não existe", async () => {
    mocks.adminGet.mockResolvedValue(status({ active: false }));
    renderRoutes([{ path: "/", component: ShieldBanner }, stubRoute("/admin/security")], "/");
    await waitFor(() => expect(mocks.adminGet).toHaveBeenCalled());
    expect(screen.queryByText("Operação Escudo ativa")).not.toBeInTheDocument();
  });
});

describe("pedido do código", () => {
  function mount() {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <ShieldCodePrompt />
      </QueryClientProvider>,
    );
  }

  it("abre quando alguém pede o código, devolve os 6 dígitos e fecha; o código não é guardado", async () => {
    mocks.adminGet.mockResolvedValue(status());
    mount();
    const user = userEvent.setup();
    const answer = askShieldCode("required");
    const dialog = await screen.findByRole("dialog", { name: "Digite o código do Authenticator" });
    expect(dialog).toHaveTextContent("precisa do código do Authenticator");
    const next = screen.getByRole("button", { name: "Continuar" });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText("Código do Authenticator"), "12ab3456");
    expect(next).toBeEnabled();
    await user.click(next);
    await expect(answer).resolves.toBe("123456");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.stringify({ ...localStorage })).not.toContain("123456");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("123456");
  });

  it("Cancelar devolve null; 'código inválido' avisa de novo", async () => {
    mocks.adminGet.mockResolvedValue(status());
    mount();
    const user = userEvent.setup();
    const answer = askShieldCode("invalid");
    expect(await screen.findByText(/Código inválido ou já usado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(answer).resolves.toBeNull();
  });

  it("mantém o cliente sabendo se o Escudo está ligado (para pedir o código antes da ação)", async () => {
    mocks.adminGet.mockResolvedValue(status());
    mount();
    await waitFor(() => expect(isShieldActive()).toBe(true));
  });
});
