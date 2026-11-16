import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as service from "@/shared/services/campaign-groups";

import { GroupsTab } from "./groups-tab";

vi.mock("@/shared/services/campaign-groups");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const group: service.CampaignCommunityGroup = {
  id: "g1",
  name: "Creators",
  description: "Grupo da campanha",
  cover_url: null,
  members_count: 1,
  auto_join_on_approval: true,
  auto_join_on_application: false,
  remove_on_campaign_exit: false,
  share_url: "https://x.test/g1",
};

const page = (rows: service.CampaignGroupParticipant[]) => ({ data: rows, meta: { page: 1, per_page: 25, total: rows.length, total_pages: 1 } });
const person = (id: number, name: string, campaign_status: string): service.CampaignGroupParticipant => ({
  campaign_user_id: id,
  user_id: id + 100,
  name,
  email: `${name.toLowerCase()}@x.test`,
  campaign_status,
  is_member: false,
  sync_status: null,
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupsTab campaignId="7" canWrite />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  // jsdom não implementa `scrollTo` nos elementos (o chat rola até a última mensagem).
  Element.prototype.scrollTo = vi.fn();
  vi.mocked(service.listCampaignGroups).mockResolvedValue([group]);
  vi.mocked(service.listCampaignGroupPosts).mockResolvedValue({ data: [], meta: { page: 1, per_page: 40, total: 0, total_pages: 0 } });
  vi.mocked(service.listCampaignGroupParticipants).mockResolvedValue(page([person(1, "Ana", "approved"), person(2, "Bia", "applications")]));
});

describe("grupos da campanha", () => {
  it("diz 'participantes' (e não 'aprovados') nos contadores e mostra o modo de entrada", async () => {
    renderTab();
    expect(await screen.findByText("de 2 participantes no grupo")).toBeInTheDocument();
    expect(screen.queryByText(/aprovados no grupo/)).not.toBeInTheDocument();
    // O tile "Entrada" do cartão (o formulário de criar também usa o mesmo rótulo no seletor).
    const tile = screen.getByText("Entrada", { selector: "small" }).closest(".gtile") as HTMLElement;
    expect(within(tile).getByText("Ao aprovar")).toBeInTheDocument();
  });

  it("Editar grupo manda os três campos juntos, derivados do modo escolhido", async () => {
    vi.mocked(service.updateCampaignGroupLink).mockResolvedValue({ ...group, auto_join_on_approval: false });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: /Configurar o grupo Creators/ }));
    await user.click(screen.getByRole("menuitem", { name: /Editar grupo/ }));

    const dialog = await screen.findByRole("dialog", { name: "Editar grupo" });
    expect(within(dialog).getByRole("radio", { name: /Ao aprovar/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Ao se inscrever/ })).toBeEnabled();
    expect(within(dialog).getByText(/TODO inscrito vê esse conteúdo/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("radio", { name: /Só manual/ }));
    await user.click(within(dialog).getByRole("switch"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(service.updateCampaignGroupLink).toHaveBeenCalledWith("7", "g1", { auto_join_on_approval: false, auto_join_on_application: false, remove_on_campaign_exit: true }));
  });

  it("o modo 'ao se inscrever' grava application=true e approval=false", async () => {
    vi.mocked(service.updateCampaignGroupLink).mockResolvedValue({ ...group, auto_join_on_approval: false, auto_join_on_application: true });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: /Configurar o grupo Creators/ }));
    await user.click(screen.getByRole("menuitem", { name: /Editar grupo/ }));
    const dialog = await screen.findByRole("dialog", { name: "Editar grupo" });
    await user.click(within(dialog).getByRole("radio", { name: "Ao se inscrever" }));
    expect(within(dialog).getByText(/Vale só para inscrições novas/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(service.updateCampaignGroupLink).toHaveBeenCalledWith("7", "g1", { auto_join_on_approval: false, auto_join_on_application: true, remove_on_campaign_exit: false }));
  });

  it("avisa quantos dos adicionados não foram aprovados antes de enviar", async () => {
    vi.mocked(service.bulkAddCampaignGroupMembers).mockResolvedValue({
      data: [
        { campaign_user_id: 1, status: "joined" },
        { campaign_user_id: 2, status: "failed", error: "Conta suspensa" },
      ],
      meta: { requested: 2, joined: 1, already_member: 0, failed: 1 },
    });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Adicionar participantes ao grupo" }));
    await user.click(await screen.findByRole("checkbox", { name: "Selecionar todos" }));
    await user.click(screen.getByRole("button", { name: /Adicionar selecionados \(2\)/ }));

    const confirm = await screen.findByRole("dialog", { name: "Adicionar ao grupo" });
    expect(within(confirm).getByText(/Vai adicionar 2 pessoas, 1 dela NÃO aprovada\. Elas verão o conteúdo do grupo\./)).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Adicionar 2" }));

    expect(service.bulkAddCampaignGroupMembers).toHaveBeenCalledWith("7", "g1", [1, 2]);
    const result = await screen.findByRole("dialog", { name: "Resultado" });
    expect(within(result).getByText("Bia")).toBeInTheDocument();
    expect(within(result).getByText("Conta suspensa")).toBeInTheDocument();
  });

  it("criar grupo usa as opções escolhidas e oferece adicionar participantes", async () => {
    vi.mocked(service.createCampaignGroup).mockResolvedValue({ ...group, id: "g2", name: "Novo", auto_join_on_approval: false });
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("de 2 participantes no grupo");
    await user.type(screen.getByLabelText("Nome"), "Novo");
    await user.type(screen.getByLabelText("Descrição"), "Outro grupo");
    const forms = document.querySelector(".gnew.more") as HTMLElement;
    await user.click(within(forms).getByRole("radio", { name: /Só manual/ }));
    await user.click(within(forms).getByRole("button", { name: "Criar e vincular" }));

    await waitFor(() =>
      expect(service.createCampaignGroup).toHaveBeenCalledWith("7", { name: "Novo", description: "Outro grupo", auto_join_on_approval: false, auto_join_on_application: false, remove_on_campaign_exit: false }),
    );
    expect(await screen.findByRole("button", { name: "Adicionar participantes agora" })).toBeInTheDocument();
  });
});
