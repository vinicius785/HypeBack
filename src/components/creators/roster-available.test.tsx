import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  canInvite: true,
  pages: [] as unknown[],
  state: {} as Record<string, unknown>,
  query: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({ useWorkspacePermissions: () => ({ influencers_invite: h.canInvite }) }));
vi.mock("@/hooks/use-agency-roster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-agency-roster")>()),
  useAvailableCreators: (q: string) => {
    h.query(q);
    return { data: { pages: h.pages }, isLoading: false, isFetching: false, isFetchingNextPage: false, error: null, refetch: vi.fn(), fetchNextPage: vi.fn(), hasNextPage: false, ...h.state };
  },
}));
vi.mock("@/hooks/use-debounce", () => ({ useDebounce: <T,>(value: T) => value }));
vi.mock("@/styles/agency-roster.css", () => ({}));
vi.mock("./roster-invite-dialog", () => ({ RosterInviteDialog: ({ creator }: { creator: { userId: number; name: string } }) => <div role="dialog" aria-label={`Convite ${creator.name} ${creator.userId}`} /> }));

import { RosterAvailable } from "./roster-available";

const creator = (id: number, name: string, over: Record<string, unknown> = {}) => ({
  user_id: id,
  name,
  username: name.toLowerCase().split(" ")[0],
  photo: null,
  niches: ["Moda", "Beleza"],
  followers_total: 25000,
  networks: [{ type: "instagram", username: "x", members: 20000 }],
  available_since: "2026-11-10T12:00:00Z",
  invite: null,
  ...over,
});
const page = (data: unknown[], over: Record<string, unknown> = {}) => ({ data, meta: { page: 1, per_page: 20, total: data.length, has_more: false }, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  h.canInvite = true;
  h.state = {};
  h.pages = [page([creator(7, "Ana Souza"), creator(8, "Beto Lima", { invite: { roster_id: "r1", status: "invited" } })])];
});

describe("Querendo agência", () => {
  it("mostra nichos, redes, seguidores e desde quando; quem já foi convidado não pode ser convidado de novo", () => {
    render(<RosterAvailable tabs={<div />} />);
    const ana = screen.getByText("Ana Souza").closest("li") as HTMLElement;
    expect(within(ana).getByText("@ana")).toBeInTheDocument();
    expect(within(ana).getByText("Moda")).toBeInTheDocument();
    expect(within(ana).getByText("Disponível desde 10/11/2026")).toBeInTheDocument();
    expect(within(ana).getByRole("button", { name: /Convidar Ana Souza/ })).toBeInTheDocument();
    const beto = screen.getByText("Beto Lima").closest("li") as HTMLElement;
    expect(within(beto).getByText("Convite enviado")).toBeInTheDocument();
    expect(within(beto).queryByRole("button", { name: /Convidar/ })).not.toBeInTheDocument();
  });

  it("Convidar abre o mesmo convite do elenco, com o criador certo", async () => {
    render(<RosterAvailable tabs={<div />} />);
    await userEvent.click(screen.getByRole("button", { name: /Convidar Ana Souza/ }));
    expect(screen.getByRole("dialog", { name: "Convite Ana Souza 7" })).toBeInTheDocument();
  });

  it("sem permissão de convidar, não oferece o botão", () => {
    h.canInvite = false;
    render(<RosterAvailable tabs={<div />} />);
    expect(screen.queryByRole("button", { name: /Convidar/ })).not.toBeInTheDocument();
  });

  it("a busca vai para a API", async () => {
    render(<RosterAvailable tabs={<div />} />);
    await userEvent.type(screen.getByRole("searchbox", { name: /Buscar criadores/ }), "ana");
    expect(h.query).toHaveBeenLastCalledWith("ana");
  });

  it("vazio, sem a rota (404) e erro têm texto próprio", () => {
    h.pages = [page([])];
    const { unmount } = render(<RosterAvailable tabs={<div />} />);
    expect(screen.getByText("Ninguém querendo agência agora")).toBeInTheDocument();
    unmount();
    h.pages = [page([], { unavailable: true })];
    const second = render(<RosterAvailable tabs={<div />} />);
    expect(screen.getByText("Ainda não disponível")).toBeInTheDocument();
    second.unmount();
    h.state = { error: new Error("Falhou") };
    render(<RosterAvailable tabs={<div />} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });
});
