import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountTypeRequest } from "@/shared/services/account-type-requests";

const api = vi.hoisted(() => ({ create: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: api.toast }));
vi.mock("@/shared/services/account-type-requests", async (orig) => ({
  ...(await orig<typeof import("@/shared/services/account-type-requests")>()),
  createAccountTypeRequest: api.create,
  listAccountTypeRequests: vi.fn(async () => []),
}));

import { AccountTypeCard } from "./account-type-card";

const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const req = (over: Partial<AccountTypeRequest> = {}): AccountTypeRequest => ({
  id: "r1",
  status: "pending",
  current_type: "brand",
  requested_type: "agency",
  justification: "Atendemos várias marcas",
  requested_at: "2026-11-04T10:00:00Z",
  requested_by: { id: 1, name: "Lúcia", email: "l@x.com" },
  decided_at: null,
  decided_by: null,
  decision_reason: null,
  workspace: { id: "w1", name: "Casa", photo: null, account_type: "brand" },
  ...over,
});

const base = { workspaceId: "w1", current: "brand" as const, requests: [] as AccountTypeRequest[], loading: false, error: false, canRequest: true, onRetry: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe("Tipo de conta", () => {
  it("mostra o tipo atual e as diferenças entre Marca e Agência", () => {
    wrap(<AccountTypeCard {...base} />);
    expect(screen.getByText("Tipo atual")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tipos de conta" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ver diferenças/ }));
    const list = screen.getByRole("list", { name: "Tipos de conta" });
    expect(list.children).toHaveLength(2);
    expect(within(list).getAllByText("Tipo atual").length).toBeGreaterThan(0);
    expect(within(list).getByText(/gerencia campanhas de diferentes marcas/i)).toBeTruthy();
  });

  it("com pedido pendente: mostra o status e não deixa pedir de novo", () => {
    wrap(<AccountTypeCard {...base} requests={[req()]} />);
    expect(screen.getByRole("status").textContent).toMatch(/Pendente/);
    expect((screen.getByRole("button", { name: "Solicitar alteração do tipo de conta" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejeitada: mostra o motivo e libera novo pedido; aprovada: informa", () => {
    const { unmount } = wrap(<AccountTypeCard {...base} requests={[req({ status: "rejected", decided_at: "2026-11-05T10:00:00Z", decision_reason: "Falta contrato" })]} />);
    expect(screen.getByRole("status").textContent).toMatch(/Rejeitada/);
    expect(screen.getByRole("status").textContent).toMatch(/Falta contrato/);
    expect((screen.getByRole("button", { name: "Solicitar alteração do tipo de conta" }) as HTMLButtonElement).disabled).toBe(false);
    unmount();
    wrap(<AccountTypeCard {...base} current="agency" requests={[req({ status: "approved", decided_at: "2026-11-05T10:00:00Z" })]} />);
    expect(screen.getByRole("status").textContent).toMatch(/Aprovada/);
  });

  it("sem permissão não há botão de solicitar", () => {
    wrap(<AccountTypeCard {...base} canRequest={false} />);
    expect(screen.queryByRole("button", { name: /Solicitar alteração/ })).toBeNull();
    expect(screen.getByText(/Só o proprietário e os administradores/)).toBeTruthy();
  });

  it("o fluxo pede justificativa, confirma e só então envia", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(req());
    wrap(<AccountTypeCard {...base} />);
    await user.click(screen.getByRole("button", { name: "Solicitar alteração do tipo de conta" }));

    const next = screen.getByRole("button", { name: "Continuar" });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole("textbox"), "curta");
    expect((next as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole("textbox"), " e agora com mais de dez caracteres");
    await user.click(next);

    expect(screen.getByText(/só muda se a equipe Hype aprovar/)).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("w1", { requested_type: "agency", justification: "curta e agora com mais de dez caracteres" }));
    expect(api.toast.success).toHaveBeenCalled();
  });

  it("erro do servidor (ex.: já existe pendente) fica dentro do modal", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(Object.assign(new Error("Já existe uma solicitação pendente para este workspace."), { status: 409 }));
    wrap(<AccountTypeCard {...base} />);
    await user.click(screen.getByRole("button", { name: "Solicitar alteração do tipo de conta" }));
    await user.type(screen.getByRole("textbox"), "Justificativa com tamanho suficiente");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/solicitação pendente/);
  });
});
