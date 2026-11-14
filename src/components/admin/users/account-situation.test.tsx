/**
 * Situação da conta do criador no Admin.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - Suspensa, Reprovada e Em análise não confirmam sem motivo; o aviso diz que o criador lê o texto;
 *   - voltar para Ativa não pede motivo e não envia motivo;
 *   - a ficha mostra a etiqueta, o motivo e quem mudou e quando;
 *   - a lista de situações e a categoria Contestação existem.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminPost: vi.fn() }));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminPost: mocks.adminPost };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABEL } from "@/shared/services/admin-support";

import { ACCOUNT_SITUATIONS, ACCOUNT_SITUATION_LABEL, situationOf } from "./account-situation";
import { AccountSituationDialog } from "./account-situation-dialog";
import { AdminUserSituation } from "./admin-user-info";
import { ADMIN_ACCOUNT_SITUATION_FILTER_OPTIONS } from "./admin-users-config";
import { makeUserDetail } from "./admin-users-test-data";
import { createTestQueryClient, renderRoutes, stubRoute } from "./admin-users-test-utils";


const creator = (over = {}) => makeUserDetail({ kind: "creator", name: "Bia Lima", email: "bia@x.com", ...over });

function renderDialog(target: "active" | "under_review" | "rejected" | "suspended") {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AccountSituationDialog user={creator()} target={target} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return user;
}

beforeEach(() => {
  mocks.adminPost.mockReset();
  mocks.adminPost.mockResolvedValue(creator({ account_status: "suspended" }));
});

describe("diálogo da situação da conta", () => {
  it("Suspender: não confirma sem motivo e avisa que o criador lê o texto", async () => {
    const target = "suspended" as const;
    const confirmLabel = "Suspender conta";
    const user = renderDialog(target);
    expect(screen.getByText("Este texto será mostrado ao criador no app.")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: confirmLabel });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Motivo para o criador/), "Documentos ilegíveis");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    expect(mocks.adminPost.mock.calls[0][1]).toEqual({ status: target, reason: "Documentos ilegíveis" });
  });

  it("o efeito fica claro: o criador perde o acesso, mas pode contestar pelo suporte", () => {
    renderDialog("suspended");
    expect(screen.getAllByText(/contestar pelo suporte/).length).toBeGreaterThan(0);
  });

  it("voltar para Ativa não pede motivo e não envia motivo", async () => {
    const user = renderDialog("active");
    expect(screen.queryByLabelText(/Motivo/)).not.toBeInTheDocument();
    expect(screen.queryByText("Este texto será mostrado ao criador no app.")).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Ativar conta" });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(mocks.adminPost.mock.calls[0][1]).toEqual({ status: "active" });
  });
});

describe("ficha e vocabulário", () => {
  it("mostra a situação, o motivo e quem mudou e quando", async () => {
    const user = creator({
      account_status: "rejected",
      account_status_reason: "Perfil sem conteúdo próprio",
      account_status_changed_at: "2026-11-10T12:00:00.000Z",
      account_status_changed_by: { user_id: 9, name: "Marina" },
    });
    renderRoutes([{ path: "/", component: () => <AdminUserSituation user={user} /> }, stubRoute("/admin/users/$userId")], "/");
    await screen.findByText("Perfil sem conteúdo próprio");
    expect(screen.getAllByText("Reprovada").length).toBeGreaterThan(0);
    expect(screen.getByText("Perfil sem conteúdo próprio")).toBeInTheDocument();
    expect(screen.getByText("Marina")).toBeInTheDocument();
  });

  it("conta ativa e conta que não é de criador não mostram o bloco", () => {
    const { container, rerender } = render(<AdminUserSituation user={creator({ account_status: "active" })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AdminUserSituation user={makeUserDetail({ kind: "brand", account_status: "under_review" })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("as quatro situações, a dedução pelo estado antigo, o filtro e a categoria Contestação", () => {
    expect(ACCOUNT_SITUATIONS.map((s) => ACCOUNT_SITUATION_LABEL[s])).toEqual(["Ativa", "Suspensa"]);
    expect(situationOf({ status: "suspended" })).toBe("suspended");
    expect(situationOf({ status: "active" })).toBe("active");
    expect(situationOf({ status: "active", account_status: "under_review" })).toBe("under_review");
    const values = ADMIN_ACCOUNT_SITUATION_FILTER_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["", "active", "suspended"]);
    expect(SUPPORT_CATEGORIES).toContain("contestation");
    expect(SUPPORT_CATEGORY_LABEL.contestation).toBe("Contestação");
  });
});
