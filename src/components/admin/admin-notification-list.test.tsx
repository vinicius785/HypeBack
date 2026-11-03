import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminNotificationListItem, AdminNotificationStatus } from "@/shared/types";

import { AdminNotificationList, inAppSummary } from "./admin-notification-list";

const cancel = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/hooks/use-admin-notifications", () => ({
  useCancelAdminNotification: () => ({ mutateAsync: cancel.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [{ id: "7", name: "Moda" }] }) }));
vi.mock("sonner", () => ({ toast: toasts }));

beforeEach(() => {
  cancel.mutateAsync.mockReset().mockResolvedValue(undefined);
  toasts.success.mockReset();
  toasts.error.mockReset();
});

function item(
  id: string,
  channels: AdminNotificationListItem["channels"],
  stats: AdminNotificationListItem["stats"],
): AdminNotificationListItem {
  return {
    id,
    title: `Aviso ${id}`,
    body: "Texto do aviso",
    cta_url: null,
    channels,
    audience: { type: "all" },
    status: "sent",
    scheduled_at: null,
    sent_at: "2026-10-31T15:00:00Z",
    created_at: "2026-10-31T14:59:00Z",
    created_by: { id: 1, name: "Admin" },
    stats,
  };
}

describe("inAppSummary", () => {
  it("mostra quantos leram e a porcentagem sobre os itens criados no sino", () => {
    expect(inAppSummary({ total_recipients: 120, delivered: 118, failed: 2, in_app: { total: 118, read: 43 } })).toBe(
      "43 leram no app (36%)",
    );
  });

  it("concorda no singular e arredonda", () => {
    expect(inAppSummary({ total_recipients: 3, delivered: 3, failed: 0, in_app: { total: 3, read: 1 } })).toBe(
      "1 leu no app (33%)",
    );
  });

  it("com 0 leituras ainda informa (ninguém abriu ainda é informação)", () => {
    expect(inAppSummary({ total_recipients: 10, delivered: 10, failed: 0, in_app: { total: 10, read: 0 } })).toBe(
      "0 leram no app (0%)",
    );
  });

  it("some quando não há itens no sino: sem push, sem dado ou antes do recurso existir", () => {
    expect(inAppSummary(undefined)).toBe("");
    expect(inAppSummary({ total_recipients: 5, delivered: 5, failed: 0 })).toBe("");
    expect(inAppSummary({ total_recipients: 5, delivered: 5, failed: 0, in_app: { total: 0, read: 0 } })).toBe("");
  });
});

const baseProps = {
  isLoading: false,
  onRetry: () => {},
  empty: { title: "Nada aqui" },
  onDuplicate: () => {},
};

function withStatus(id: string, status: AdminNotificationStatus, extra: Partial<AdminNotificationListItem> = {}) {
  return { ...item(id, ["push"], undefined), status, ...extra };
}

describe("AdminNotificationList · leram no app", () => {
  it("mostra a leitura só nos disparos que geraram itens no sino", () => {
    render(
      <AdminNotificationList
        {...baseProps}
        items={[
          item("a", ["push", "email"], { total_recipients: 120, delivered: 118, failed: 2, in_app: { total: 118, read: 43 } }),
          item("b", ["email"], { total_recipients: 40, delivered: 40, failed: 0 }),
        ]}
      />,
    );

    expect(screen.getByText("43 leram no app (36%)")).toBeInTheDocument();
    expect(screen.getByText("118 de 120 entregues")).toBeInTheDocument(); // o resumo de entrega continua
    expect(screen.getByText("40 de 40 entregues")).toBeInTheDocument();
    expect(screen.getAllByText(/no app \(/)).toHaveLength(1);
  });
});

describe("AdminNotificationList · tabela", () => {
  it("é uma tabela do kit, com cabeçalho de coluna, e o status é uma etiqueta do kit", () => {
    render(<AdminNotificationList {...baseProps} items={[withStatus("a", "failed"), withStatus("b", "sent")]} />);

    const table = screen.getByRole("table", { name: "Notificações" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Notificação",
      "Público",
      "Envio",
      "Status",
      "",
    ]);
    const failed = within(table).getByText("Falhou");
    expect(failed).toHaveClass("adm-badge");
    expect(failed).toHaveAttribute("data-tone", "bad");
    expect(within(table).getByText("Enviada")).toHaveAttribute("data-tone", "ok");
    expect(table.querySelector(".reserved, .awaiting, .available, .fail")).toBeNull();
  });

  it("datas pelo formato do Admin, no fuso de São Paulo", () => {
    render(<AdminNotificationList {...baseProps} items={[withStatus("a", "sent", { sent_at: "2026-10-31T15:00:00Z" })]} />);

    expect(screen.getByText("31/10/2026 12:00")).toBeInTheDocument();
  });

  it("o público mostra o nome do nicho, e o número de criadores quando há entrega", () => {
    render(
      <AdminNotificationList
        {...baseProps}
        items={[
          withStatus("a", "sent", {
            audience: { type: "niche", niche_ids: [7] },
            channels: ["push", "email"],
            stats: { total_recipients: 1200, delivered: 1200, failed: 0 },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Nicho: Moda")).toBeInTheDocument();
    expect(screen.getByText("1.200 criadores · Push, E-mail")).toBeInTheDocument();
  });

  it("a linha abre os detalhes que ela corta: mensagem inteira, link, canais e criador", async () => {
    render(
      <AdminNotificationList
        {...baseProps}
        items={[
          withStatus("a", "partially_failed", {
            title: "Black Friday",
            body: "Texto longo da mensagem\nsegunda linha",
            cta_url: "hypeapp://campanha/9",
            stats: { total_recipients: 10, delivered: 8, failed: 2 },
          }),
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Detalhes de “Black Friday”" }));

    expect(screen.getByText("hypeapp://campanha/9")).toBeInTheDocument();
    expect(screen.getByText("8 de 10 entregues · 2 falharam")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText(/Texto longo da mensagem/, { selector: ".adm-ntf-full" })).toBeInTheDocument();
  });
});

describe("AdminNotificationList · ações de linha (mesmo gate de antes)", () => {
  const menuOf = async (title: string) => {
    await userEvent.click(screen.getByRole("button", { name: `Ações de “${title}”` }));
    return within(screen.getByRole("menu")).getAllByRole("menuitem").map((i) => i.textContent);
  };

  it("enviada, com falha, parcial, enviando e rascunho: só Duplicar", async () => {
    for (const status of ["sent", "failed", "partially_failed", "sending", "draft"] as const) {
      const { unmount } = render(<AdminNotificationList {...baseProps} items={[withStatus("a", status, { title: "Aviso" })]} />);
      expect(await menuOf("Aviso")).toEqual(["Duplicar"]);
      unmount();
    }
  });

  it("agendada: só Cancelar envio, em vermelho", async () => {
    render(<AdminNotificationList {...baseProps} items={[withStatus("a", "scheduled", { title: "Aviso" })]} />);

    expect(await menuOf("Aviso")).toEqual(["Cancelar envio"]);
    expect(screen.getByRole("menuitem", { name: "Cancelar envio" })).toHaveAttribute("data-tone", "danger");
  });

  it("cancelada: sem ação nenhuma", () => {
    render(<AdminNotificationList {...baseProps} items={[withStatus("a", "cancelled", { title: "Aviso" })]} />);

    expect(screen.queryByRole("button", { name: "Ações de “Aviso”" })).not.toBeInTheDocument();
  });

  it("Duplicar entrega a notificação a quem abre o formulário", async () => {
    const onDuplicate = vi.fn();
    const sent = withStatus("a", "sent", { title: "Aviso" });
    render(<AdminNotificationList {...baseProps} items={[sent]} onDuplicate={onDuplicate} />);

    await userEvent.click(screen.getByRole("button", { name: "Ações de “Aviso”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    expect(onDuplicate).toHaveBeenCalledWith(sent);
  });

  it("Cancelar envio pede confirmação em diálogo (sem mexer na linha) e só então cancela", async () => {
    render(<AdminNotificationList {...baseProps} items={[withStatus("n1", "scheduled", { title: "Aviso" })]} />);

    await userEvent.click(screen.getByRole("button", { name: "Ações de “Aviso”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancelar envio" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Cancelar este envio?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Esta ação não pode ser desfeita\./)).toBeInTheDocument();
    expect(within(dialog).queryByText(/backoffice/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(cancel.mutateAsync).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(cancel.mutateAsync).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ações de “Aviso”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancelar envio" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar envio" }));

    await waitFor(() => expect(cancel.mutateAsync).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Envio cancelado", expect.anything()));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("se o cancelamento falha, o diálogo continua aberto com o motivo", async () => {
    cancel.mutateAsync.mockRejectedValue(Object.assign(new Error("Já foi enviada"), { status: 409 }));
    render(<AdminNotificationList {...baseProps} items={[withStatus("n1", "scheduled", { title: "Aviso" })]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ações de “Aviso”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancelar envio" }));

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar envio" }));

    expect(await within(screen.getByRole("alertdialog")).findByText("Já foi enviada")).toBeInTheDocument();
    expect(toasts.success).not.toHaveBeenCalled();
  });
});

describe("AdminNotificationList · estados do kit", () => {
  it("carregando: esqueleto da tabela, anunciado", () => {
    render(<AdminNotificationList {...baseProps} items={undefined} isLoading />);

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' chama onRetry", async () => {
    const onRetry = vi.fn();
    render(<AdminNotificationList {...baseProps} items={undefined} error={new Error("falhou")} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("vazio: o texto e a ação que o chamador mandou", () => {
    render(
      <AdminNotificationList
        {...baseProps}
        items={[]}
        empty={{ title: "Nenhuma notificação agendada", action: <button type="button">Ver todas</button> }}
      />,
    );

    expect(screen.getByText("Nenhuma notificação agendada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver todas" })).toBeInTheDocument();
  });
});
