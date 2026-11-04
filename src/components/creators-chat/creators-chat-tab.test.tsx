import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  notifications: { data: [] as unknown[], isLoading: false },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/hooks/use-notifications", () => ({ useNotifications: () => h.notifications }));
vi.mock("@/hooks/use-workspace-query-key", () => ({
  useWorkspaceQueryKey: () => "ws-1",
  withWorkspaceKey: (parts: readonly unknown[], ws: string | undefined) => [...parts, ws],
}));
vi.mock("@/shared/services/campaign-users", () => ({ getCampaignUsers: vi.fn().mockResolvedValue([]) }));
// A conversa em si é de outro teste: aqui só interessa a lista e o que acontece ao escolher.
vi.mock("./creator-thread", () => ({
  CreatorThread: ({ conv, onBack }: { conv: { name: string }; onBack: () => void }) => (
    <div role="region" aria-label="Conversa aberta">
      {conv.name}
      <button type="button" onClick={onBack}>
        Voltar às conversas
      </button>
    </div>
  ),
}));

import { CreatorsChatTab } from "./creators-chat-tab";

const note = (over: Record<string, unknown> = {}) => ({
  id: "n1",
  type: "new_message",
  title: "Bia Alves",
  boldText: "Bia Alves",
  message: "Posso enviar o vídeo hoje?",
  created_at: new Date().toISOString(),
  read_at: null,
  metadata: { campaign_id: "camp-1", influencer_id: 901, campaign_title: "Lançamento VideoApp" },
  ...over,
});

function renderTab(props: Partial<Parameters<typeof CreatorsChatTab>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onThreadChange = vi.fn();
  const onRequestClose = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  render(
    <CreatorsChatTab
      top={<h2>Mensagens</h2>}
      request={null}
      extra={null}
      onExtraChange={vi.fn()}
      onThreadChange={onThreadChange}
      onRequestClose={onRequestClose}
      {...props}
    />,
    { wrapper },
  );
  return { onThreadChange, onRequestClose };
}

beforeEach(() => {
  h.navigate.mockReset();
  h.notifications = { data: [], isLoading: false };
});

describe("aba Criadores: lista", () => {
  it("sem nenhuma conversa: explica como começar e leva às campanhas", async () => {
    const user = userEvent.setup();
    const { onRequestClose } = renderTab();
    expect(screen.getByText("Nenhuma conversa com criadores ainda")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ir para as campanhas" }));
    expect(h.navigate).toHaveBeenCalledWith({ to: "/campaigns" });
    expect(onRequestClose).toHaveBeenCalled();
    // Área da conversa vazia também orienta.
    expect(screen.getByText("Nenhuma conversa selecionada")).toBeInTheDocument();
  });

  it("carregando: esqueleto com a frase para o leitor de tela", () => {
    h.notifications = { data: [], isLoading: true };
    renderTab();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando conversas...");
  });

  it("mostra criador, campanha, prévia, horário e contador, e a busca é por criador ou campanha", async () => {
    h.notifications = {
      data: [
        note(),
        note({ id: "n2", title: "Ana Lima", boldText: "Ana Lima", message: "Combinado!", read_at: "2026-11-01T10:00:00Z", metadata: { campaign_id: "camp-2", influencer_id: 902, campaign_title: "Verão 2027" } }),
      ],
      isLoading: false,
    };
    const user = userEvent.setup();
    renderTab();
    const list = screen.getByRole("list", { name: "Conversas com criadores" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Bia Alves");
    expect(rows[0]).toHaveTextContent("Lançamento VideoApp");
    expect(rows[0]).toHaveTextContent("Posso enviar o vídeo hoje?");
    expect(within(rows[0]).getByLabelText("1 não lida")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Buscar conversa" }), "verão");
    expect(within(screen.getByRole("list", { name: "Conversas com criadores" })).getAllByRole("listitem")).toHaveLength(1);
    await user.clear(screen.getByRole("textbox", { name: "Buscar conversa" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar conversa" }), "zzz");
    expect(screen.getByText("Nenhuma conversa encontrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByRole("list", { name: "Conversas com criadores" })).toBeInTheDocument();
  });

  it("'Não lidas' conta e filtra; sem nenhuma não lida diz que está em dia", async () => {
    h.notifications = { data: [note({ read_at: "2026-11-01T10:00:00Z" })], isLoading: false };
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole("button", { name: /^Não lidas/ }));
    expect(screen.getByText("Nenhuma conversa não lida")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todas as conversas" }));
    expect(screen.getByRole("list", { name: "Conversas com criadores" })).toBeInTheDocument();
  });

  it("escolher abre a conversa (avisa a gaveta) e voltar devolve a lista como estava", async () => {
    h.notifications = { data: [note()], isLoading: false };
    const user = userEvent.setup();
    const { onThreadChange } = renderTab();
    await user.type(screen.getByRole("textbox", { name: "Buscar conversa" }), "bia");
    await user.click(screen.getByRole("button", { name: /Bia Alves/ }));
    expect(screen.getByRole("region", { name: "Conversa aberta" })).toBeInTheDocument();
    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Voltar às conversas" }));
    expect(onThreadChange).toHaveBeenLastCalledWith(false);
    // A busca digitada continua lá: a lista nunca saiu da tela (no celular só fica escondida).
    expect(screen.getByRole("textbox", { name: "Buscar conversa" })).toHaveValue("bia");
  });
});
