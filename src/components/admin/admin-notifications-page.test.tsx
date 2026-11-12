/**
 * Página de Notificações: cabeçalho do kit com uma só ação primária, abas com contagem (incluindo "Com falha",
 * que antes ficava escondida dentro de "Enviadas"), a lista em tabela e os estados do kit.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  estimate: vi.fn(),
  cancel: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/shared/services/admin-notifications", () => ({
  fetchAdminNotificationsList: svc.list,
  estimateAdminAudience: svc.estimate,
  cancelAdminNotification: svc.cancel,
  createAdminNotification: svc.create,
  fetchAdminCampaignLookup: vi.fn().mockResolvedValue([]),
  fetchAdminNotificationDetail: vi.fn(),
}));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { renderAdminRoute } from "@/test/render-admin-route";
import type { AdminNotificationListItem, AdminNotificationStatus } from "@/shared/types";

import { AdminNotificationsPage } from "./admin-notifications-page";

function make(id: string, status: AdminNotificationStatus, extra: Partial<AdminNotificationListItem> = {}): AdminNotificationListItem {
  return {
    id,
    title: `Aviso ${id}`,
    body: `Texto do aviso ${id}`,
    cta_url: null,
    channels: ["push"],
    audience: { type: "all" },
    status,
    scheduled_at: status === "scheduled" ? "2099-01-02T13:00:00Z" : null,
    sent_at: ["sent", "sending", "failed", "partially_failed"].includes(status) ? "2026-10-31T15:00:00Z" : null,
    created_at: "2026-10-30T10:00:00Z",
    created_by: { id: 1, name: "Admin" },
    ...extra,
  };
}

const ALL: AdminNotificationListItem[] = [
  make("rascunho", "draft"),
  make("agendada", "scheduled"),
  make("enviada", "sent"),
  make("enviando", "sending"),
  make("parcial", "partially_failed"),
  make("falhou", "failed"),
  make("cancelada", "cancelled", { scheduled_at: "2026-11-01T13:00:00Z" }),
];

function renderPage() {
  return renderAdminRoute([{ path: "/admin/notifications", component: AdminNotificationsPage }], "/admin/notifications");
}

const group = () => within(screen.getByRole("group", { name: "Situação das notificações" }));
const tab = (name: RegExp | string) => group().getByRole("button", { name });
const tabs = () => group().getAllByRole("button");
const titlesInTable = () =>
  within(screen.getByRole("table", { name: "Notificações" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector(".adm-ntf-msg b")?.textContent);

beforeEach(() => {
  Object.values(svc).forEach((fn) => fn.mockReset());
  svc.list.mockResolvedValue(ALL);
  svc.estimate.mockResolvedValue({ total_recipients: 1200, by_channel: { push: 1200 } });
});

afterEach(cleanup);

describe("Notificações: cabeçalho e abas", () => {
  it("usa o cabeçalho do kit (h1) com uma só ação primária, 'Nova notificação'", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Notificações", level: 1 })).toBeInTheDocument();
    const buttons = within(screen.getByRole("banner")).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Nova notificação"]);
    // Sem o segmentado feito à mão: os filtros de situação são as pílulas da ilha (padrão do Gerenciamento).
    expect(document.getElementById("ntseg")).toBeNull();
    expect(screen.getByRole("region", { name: "Resumo das notificações" })).toHaveClass("isl");
  });

  it("as abas, nesta ordem e com a contagem de cada uma (Com falha inclui a entrega parcial)", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");

    expect(tabs().map((t) => t.textContent)).toEqual([
      "Todas7",
      "Agendadas1",
      "Enviadas2",
      "Com falha2",
      "Rascunhos1",
    ]);
    expect(tab(/Todas/)).toHaveAttribute("aria-pressed", "true");
  });

  it("com um envio em andamento, a ilha mostra 'Enviando' (bolinhas até o criador) e some quando não há", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");
    const island = within(screen.getByRole("region", { name: "Resumo das notificações" }));
    const status = island.getByRole("status");
    expect(status).toHaveAccessibleName(/Enviando “Aviso enviando”/);
    expect(status.querySelectorAll(".isl-send-dots i")).toHaveLength(3);
    expect(status.querySelector(".isl-send-who")).not.toBeNull();
  });

  it("a ilha abre (e fecha) uma folha com o resumo dos envios", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");
    const toggle = screen.getByRole("button", { name: "Abrir o resumo" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    const open = screen.getByRole("button", { name: "Fechar o resumo" });
    expect(open).toHaveAttribute("aria-expanded", "true");
    const sheet = within(screen.getByRole("region", { name: "Resumo dos envios" }));
    expect(sheet.getByText("Entregues")).toBeInTheDocument();
    expect(sheet.getByText("Leram no app")).toBeInTheDocument();
    expect(sheet.getByText("Próxima agendada")).toBeInTheDocument();
    await userEvent.click(open);
    expect(screen.getByRole("button", { name: "Abrir o resumo" })).toHaveAttribute("aria-expanded", "false");
  });

  it("Todas mostra tudo, inclusive a cancelada", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");

    expect(titlesInTable()).toEqual([
      "Aviso rascunho",
      "Aviso agendada",
      "Aviso enviada",
      "Aviso enviando",
      "Aviso parcial",
      "Aviso falhou",
      "Aviso cancelada",
    ]);
  });

  it("Enviadas é só enviado e enviando; Com falha é falhou e entrega parcial", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");

    await userEvent.click(tab(/Enviadas/));
    expect(titlesInTable()).toEqual(["Aviso enviada", "Aviso enviando"]);

    await userEvent.click(tab(/Com falha/));
    expect(titlesInTable()).toEqual(["Aviso parcial", "Aviso falhou"]);

    await userEvent.click(tab(/Agendadas/));
    expect(titlesInTable()).toEqual(["Aviso agendada"]);

    await userEvent.click(tab(/Rascunhos/));
    expect(titlesInTable()).toEqual(["Aviso rascunho"]);
  });

  it("a consulta é uma só (sem parâmetros): o agrupamento é no cliente", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");
    await userEvent.click(tab(/Com falha/));

    expect(svc.list).toHaveBeenCalledTimes(1);
    expect(svc.list).toHaveBeenCalledWith({});
  });
});

describe("Notificações: estados do kit", () => {
  it("carregando: contagens ainda sem número e esqueleto anunciado", async () => {
    svc.list.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByText("Carregando…")).toBeInTheDocument();
    expect(tabs().map((t) => t.textContent)).toEqual(["Todas—", "Agendadas—", "Enviadas—", "Com falha—", "Rascunhos—"]);
  });

  it("erro: mostra o estado de erro e 'Tentar de novo' consulta outra vez", async () => {
    // A consulta tenta de novo uma vez sozinha antes de desistir.
    svc.list.mockRejectedValue(new Error("boom"));
    renderPage();

    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    svc.list.mockResolvedValue(ALL);
    await userEvent.click(retry);

    expect(await screen.findByText("Aviso enviada")).toBeInTheDocument();
  });

  it("nada ainda: o vazio é só texto (o 'Nova notificação' é o do cabeçalho, sem botão duplicado)", async () => {
    svc.list.mockResolvedValue([]);
    renderPage();

    const empty = (await screen.findByText("Nenhuma notificação ainda")).closest('[role="status"]') as HTMLElement;
    expect(within(empty).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nova notificação" })).toHaveLength(1);
  });

  it("aba filtrada vazia: a ação é 'Ver todas', não 'Nova notificação'", async () => {
    svc.list.mockResolvedValue([make("enviada", "sent")]);
    renderPage();
    await screen.findByText("Aviso enviada");

    await userEvent.click(tab(/Com falha/));

    const empty = (await screen.findByText("Nenhuma notificação com falha")).closest('[role="status"]') as HTMLElement;
    expect(within(empty).queryByRole("button", { name: "Nova notificação" })).not.toBeInTheDocument();
    await userEvent.click(within(empty).getByRole("button", { name: "Ver todas" }));

    expect(tab(/Todas/)).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Aviso enviada")).toBeInTheDocument();
  });
});

describe("Notificações: formulário", () => {
  it("'Nova notificação' abre o formulário em diálogo", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");

    await userEvent.click(screen.getByRole("button", { name: "Nova notificação" }));

    expect(await screen.findByRole("dialog", { name: "Nova notificação" })).toBeInTheDocument();
  });

  it("Duplicar abre o formulário com o conteúdo da notificação, e Esc o fecha", async () => {
    renderPage();
    await screen.findByText("Aviso enviada");

    await userEvent.click(screen.getByRole("button", { name: "Ações de “Aviso enviada”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova notificação" });
    expect(within(dialog).getByLabelText("Título")).toHaveValue("Aviso enviada");
    expect(within(dialog).getByLabelText("Mensagem")).toHaveValue("Texto do aviso enviada");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
