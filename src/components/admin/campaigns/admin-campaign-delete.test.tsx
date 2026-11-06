/**
 * Excluir campanha pelo Admin (menu "Mais" do detalhe e "Ações" da linha da lista).
 *
 * O QUE PRECISA FUNCIONAR: o diálogo explica que é permanente e pede motivo E o título digitado; o envio leva `reason` e
 * `confirm_title` com Idempotency-Key; no sucesso avisa, fecha e (no detalhe) volta para a lista; impedimentos do
 * servidor (saldo de criadores) aparecem listados com o diálogo aberto.
 * O QUE NÃO PODE ACONTECER: confirmar sem o título certo; sumir o diálogo quando o servidor recusa.
 */
import { cleanup, screen, within } from "@testing-library/react";
import { useParams } from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminGet: vi.fn(), adminList: vi.fn(), adminPost: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminList: client.adminList, adminPost: client.adminPost };
});
vi.mock("sonner", () => ({ toast: { success: client.toastSuccess, error: vi.fn() } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { AdminCampaignDetail } from "./admin-campaign-detail";
import { AdminCampaignsList } from "./admin-campaigns-list";
import { makeCampaign, makeCampaignDetail, pageOf } from "./campaign-fixtures";

const CAMPAIGN_ID = "ca3b0000-0000-4000-8000-000000000006";
const TITLE = "Festival Café Serra Verde";

function DetailPage() {
  const { campaignId } = useParams({ strict: false }) as { campaignId: string };
  return <AdminCampaignDetail campaignId={campaignId} />;
}

async function openFromDetail() {
  client.adminGet.mockResolvedValue(makeCampaignDetail());
  renderAdminRoute(
    [
      { path: "/admin/campaigns/$campaignId", component: DetailPage },
      { path: "/admin/campaigns", component: () => <p>Lista de campanhas</p> },
      stubRoute("/admin/workspaces/$workspaceId"),
    ],
    `/admin/campaigns/${CAMPAIGN_ID}`,
  );
  await screen.findByRole("heading", { level: 1, name: TITLE });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mais" }));
  await user.click(screen.getByRole("menuitem", { name: /Excluir campanha/ }));
  const dialog = await screen.findByRole("alertdialog", { name: `Excluir a campanha ${TITLE}` });
  return { user, dialog };
}

const confirmButton = () => screen.getByRole("button", { name: "Excluir campanha para sempre" });

async function fill(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, title = TITLE) {
  await user.type(within(dialog).getByLabelText(/Motivo/), "Campanha criada por engano");
  await user.type(within(dialog).getByLabelText(/digite o título da campanha/i), title);
}

beforeEach(() => {
  for (const mock of [client.adminGet, client.adminList, client.adminPost, client.toastSuccess]) mock.mockReset();
});
afterEach(() => cleanup());

describe("excluir campanha: detalhe", () => {
  it("o diálogo diz que é permanente e o que some, e pede motivo e título", async () => {
    const { dialog } = await openFromDetail();
    expect(dialog).toHaveAccessibleDescription(/permanente e não pode ser desfeita/);
    expect(dialog).toHaveTextContent("participações, conteúdos, roteiros e contratos");
    expect(dialog).toHaveTextContent("encerre a campanha");
    expect(within(dialog).getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("só habilita com motivo E o título certo (maiúsculas e espaços nas pontas não contam)", async () => {
    const { user, dialog } = await openFromDetail();
    await fill(user, dialog, "Outro nome");
    expect(confirmButton()).toBeDisabled();
    const title = within(dialog).getByLabelText(/digite o título da campanha/i);
    await user.clear(title);
    await user.type(title, `  ${TITLE.toUpperCase()} `);
    expect(confirmButton()).toBeEnabled();
    expect(client.adminPost).not.toHaveBeenCalled();
  });

  it("confirma: POST /delete com reason, confirm_title e Idempotency-Key; avisa e volta para a lista", async () => {
    client.adminPost.mockResolvedValue({ id: CAMPAIGN_ID, title: TITLE });
    const { user, dialog } = await openFromDetail();
    await fill(user, dialog);
    await user.click(confirmButton());

    expect(client.adminPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = client.adminPost.mock.calls[0];
    expect(path).toBe(`/admin/campaigns/${CAMPAIGN_ID}/delete`);
    expect(body).toEqual({ reason: "Campanha criada por engano", confirm_title: TITLE });
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(client.toastSuccess).toHaveBeenCalledWith("Campanha excluída.", expect.anything());
    expect(await screen.findByText("Lista de campanhas")).toBeInTheDocument();
  });

  it("CAMPAIGN_DELETE_BLOCKED: lista os impedimentos e deixa o diálogo aberto", async () => {
    client.adminPost.mockRejectedValue(
      toAdminApiError(409, {
        message: "Não é possível excluir esta campanha porque ela já movimentou dinheiro dos criadores.",
        error: "CAMPAIGN_DELETE_BLOCKED",
        details: {
          blockers: [{ code: "BALANCE_ENTRIES", message: "Já existem 3 lançamentos de saldo de criadores nesta campanha.", count: 3 }],
        },
      }),
    );
    const { user, dialog } = await openFromDetail();
    await fill(user, dialog);
    await user.click(confirmButton());

    const blockers = await within(dialog).findByRole("group", { name: "Impedimentos da exclusão" });
    expect(blockers).toHaveTextContent("Saldo de criadores movimentado");
    expect(blockers).toHaveTextContent("Já existem 3 lançamentos");
    expect(blockers).toHaveTextContent("Encerre a campanha em vez de excluir");
    expect(client.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("excluir campanha: lista", () => {
  it("a linha tem o menu de ações com Excluir campanha, e o diálogo é o da campanha da linha", async () => {
    const campaign = makeCampaign({ id: CAMPAIGN_ID, title: TITLE });
    client.adminList.mockResolvedValue(pageOf([campaign]));
    client.adminGet.mockResolvedValue(makeCampaignDetail());
    renderAdminRoute([{ path: "/admin/campaigns", component: AdminCampaignsList }, stubRoute("/admin/campaigns/$campaignId"), stubRoute("/admin/workspaces/$workspaceId")], "/admin/campaigns");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Ações da campanha ${TITLE}` }));
    await user.click(screen.getByRole("menuitem", { name: /Excluir campanha/ }));
    expect(await screen.findByRole("alertdialog", { name: `Excluir a campanha ${TITLE}` })).toBeInTheDocument();
  });
});
