import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ users: vi.fn(), workspaces: vi.fn(), navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search, children, ...rest }: { to: string; search?: Record<string, string>; children: React.ReactNode }) => (
    <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({
    buildLocation: ({ to, search }: { to: string; search?: Record<string, string> }) => ({ href: search ? `${to}?${new URLSearchParams(search).toString()}` : to }),
    navigate: h.navigate,
  }),
}));
vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-people.css", () => ({}));
vi.mock("@/hooks/admin/use-admin-users", () => ({ useAdminUsers: (params: unknown, options?: unknown) => h.users(params, options) }));
vi.mock("@/hooks/admin/use-admin-workspaces", () => ({ useAdminWorkspaceList: (params: unknown) => h.workspaces(params) }));

import { PeopleIsland } from "./people-island";

const AGO = (ms: number) => ({ last_session_at: new Date(Date.now() - ms).toISOString() });
/** 2 online (há 1 e 3 min), 1 hoje fora da janela de 5 min (há 1 h) e 1 de ontem, 1 sem sessão. */
const SESSIONS = () => [AGO(60_000), AGO(3 * 60_000), AGO(10 * 60_000), AGO(30 * 3600_000), { last_session_at: null }];
const total = (value: number) => ({ data: { meta: { total: value } } });

beforeEach(() => {
  // "hoje" (fuso de São Paulo) não pode depender da hora em que o teste roda: fixa o relógio ao meio-dia
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-31T15:00:00Z") });
  h.users.mockReset();
  h.workspaces.mockReset();
  h.navigate.mockReset();
  h.users.mockImplementation((params: { status?: string; trust_max?: number; kind?: string; sort_by?: string; created_from?: string; deleted_from?: string }) => {
    // contas excluídas hoje (Usuários: marca; Criadores: kind=creator)
    if (params.deleted_from) return total(params.kind === "creator" ? 2 : 3);
    // lista de atividade (Usuários): 100 contas com sessão mais recente
    if (params.sort_by === "last_session") return { data: { data: SESSIONS(), meta: { total: 120 } } };
    if (params.kind === "creator" && params.created_from) return total(7);
    if (params.kind === "creator" && params.trust_max) return total(4);
    if (params.kind === "creator") return total(3874);
    if (params.status === "pending") return total(3);
    if (params.status === "suspended") return total(5);
    if (params.trust_max) return total(8);
    return total(120);
  });
  h.workspaces.mockImplementation((params: { status?: string }) => (params.status === "suspended" ? total(2) : params.status === "archived" ? total(4) : total(40)));
});

afterEach(() => vi.useRealTimers());

describe("PeopleIsland (Pessoas)", () => {
  it("Usuários, Criadores e Workspaces são links com a contagem; o da tela atual é a página", () => {
    render(<PeopleIsland current="workspaces" />);
    const nav = within(screen.getByRole("navigation", { name: "Pessoas" }));
    expect(nav.getByRole("link", { name: /^Usuários/ })).toHaveAttribute("href", "/admin/users");
    expect(nav.getByRole("link", { name: /^Usuários/ })).toHaveTextContent("120");
    expect(nav.getAllByRole("link").map((l) => l.textContent?.replace(/\d|\./g, ""))).toEqual(["Usuários", "Criadores", "Workspaces"]);
    expect(nav.getByRole("link", { name: /^Criadores/ })).toHaveTextContent("3.874");
    // Criadores é a sua própria aba (a lista de usuários só com criadores), não um filtro
    expect(nav.getByRole("link", { name: /^Criadores/ })).toHaveAttribute("href", "/admin/creators");
    expect(nav.getByRole("link", { name: /^Workspaces/ })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: /^Usuários/ })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: /^Criadores/ })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: /^Workspaces/ })).toHaveTextContent("40");
  });

  it("Usuários e Criadores (a mesma rota) não ficam marcados juntos: só o `current` é a página", () => {
    render(<PeopleIsland current="creators" />);
    expect(screen.getByRole("link", { name: /^Criadores/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Usuários/ })).not.toHaveAttribute("aria-current");
  });

  it("clicar numa pílula navega pelo roteador (com a busca de Criadores); Ctrl+clique deixa o navegador abrir", async () => {
    const user = userEvent.setup();
    render(<PeopleIsland current="users" />);
    await user.click(screen.getByRole("link", { name: /^Criadores/ }));
    expect(h.navigate).toHaveBeenCalledWith({ to: "/admin/creators", search: undefined });
    h.navigate.mockClear();
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: /^Workspaces/ }));
    await user.keyboard("{/Control}");
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("a seta abre a folha com suspensos, suspeitos e workspaces suspensos e arquivados; as contagens pesadas só são pedidas ao abrir", async () => {
    render(<PeopleIsland current="users" />);
    // fechada: a consulta de suspeitos e a de suspensos saem com `enabled: false`
    const calls = h.users.mock.calls.filter(([params]) => (params as { trust_max?: number }).trust_max);
    expect(calls.every(([, options]) => (options as { enabled: boolean }).enabled === false)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Abrir o resumo de pessoas" }));
    const sheet = within(screen.getByRole("region", { name: "Resumo de pessoas" }));
    expect(sheet.getByText("Usuários suspensos").parentElement).toHaveTextContent("5");
    expect(sheet.getByText("Suspeitos de bot").parentElement).toHaveTextContent("8");
    expect(sheet.getByText("Workspaces suspensos").parentElement).toHaveTextContent("2");
    expect(sheet.getByText("Workspaces arquivados").parentElement).toHaveTextContent("4");
    const last = h.users.mock.calls.filter(([params]) => (params as { trust_max?: number }).trust_max).at(-1);
    expect((last?.[1] as { enabled: boolean }).enabled).toBe(true);
  });
});

describe("PeopleIsland: números vivos de cada aba", () => {
  it("Usuários: ativos hoje e online agora, com ícones animados (e sem 'Cadastros em dia')", () => {
    render(<PeopleIsland current="users" />);
    expect(screen.queryByText(/Cadastros em dia/)).not.toBeInTheDocument();
    const live = within(screen.getByRole("group", { name: "Agora" }));
    expect(live.getByRole("status", { name: "Ativos hoje: 3" })).toHaveAttribute("data-anim", "bob");
    const online = live.getByRole("status", { name: "Online agora: 2" });
    expect(online).toHaveAttribute("data-anim", "radar");
    expect(online).toHaveAttribute("data-tone", "ok");
    const last = h.users.mock.calls.find(([params]) => (params as { sort_by?: string }).sort_by === "last_session");
    expect(last?.[0]).toMatchObject({ status: "active", per_page: 100, order: "desc" });
    expect((last?.[1] as { refetchInterval: number }).refetchInterval).toBe(30_000);
  });

  it("Criadores: novos de hoje (criados hoje, só criadores) e alertas de confiança (nível 1 e 2)", () => {
    render(<PeopleIsland current="creators" />);
    const live = within(screen.getByRole("group", { name: "Agora" }));
    const novos7 = live.getByRole("status", { name: "Novos hoje: 7" });
    expect(novos7).toHaveAttribute("data-anim", "rise");
    // a seta é verde (tom "ok")
    expect(novos7).toHaveAttribute("data-tone", "ok");
    const alerts = live.getByRole("status", { name: "Alertas de confiança: 4" });
    expect(alerts).toHaveAttribute("data-anim", "alarm");
    expect(alerts).toHaveAttribute("data-tone", "warn");
    const novos = h.users.mock.calls.find(([params]) => (params as { created_from?: string }).created_from);
    expect(novos?.[0]).toMatchObject({ kind: "creator" });
    expect((novos?.[0] as { created_from: string; created_to: string }).created_from).toBe((novos?.[0] as { created_to: string }).created_to);
    expect(h.users.mock.calls.some(([params]) => (params as { trust_max?: number; kind?: string }).trust_max === 2 && (params as { kind?: string }).kind === "creator")).toBe(true);
  });

  it("Workspaces: nenhum número vivo", () => {
    render(<PeopleIsland current="workspaces" />);
    expect(screen.queryByRole("group", { name: "Agora" })).not.toBeInTheDocument();
  });

  it("sem alerta de confiança, o ícone fica verde (e parado)", () => {
    h.users.mockImplementation((params: { kind?: string; trust_max?: number; created_from?: string }) =>
      params.kind === "creator" && params.trust_max ? total(0) : params.created_from ? total(1) : total(10),
    );
    render(<PeopleIsland current="creators" />);
    expect(screen.getByRole("status", { name: "Alertas de confiança: 0" })).toHaveAttribute("data-tone", "ok");
  });

  it("Usuários não tem 'Excluídas hoje' (e nem consulta exclusões)", () => {
    render(<PeopleIsland current="users" />);
    expect(screen.queryByRole("status", { name: /Excluídas hoje/ })).not.toBeInTheDocument();
    expect(h.users.mock.calls.some(([params]) => (params as { deleted_from?: string }).deleted_from)).toBe(false);
  });

  it("Criadores: 'Excluídas hoje' conta pelo dia de exclusão (deleted_from = deleted_to = hoje) e é só de criadores", () => {
    render(<PeopleIsland current="creators" />);
    const stat = within(screen.getByRole("group", { name: "Agora" })).getByRole("status", { name: "Excluídas hoje: 2" });
    expect(stat).toHaveAttribute("data-tone", "bad");
    expect(stat).toHaveAttribute("data-anim", "drop");
    const call = h.users.mock.calls.find(([params]) => (params as { deleted_from?: string }).deleted_from);
    const params = call?.[0] as { deleted_from: string; deleted_to: string };
    expect(call?.[0]).toMatchObject({ kind: "creator", status: "deleted" });
    expect(params.deleted_from).toBe(params.deleted_to);
  });

  it("sem exclusão hoje, o ícone não acende (sem tom)", () => {
    h.users.mockImplementation((params: { deleted_from?: string; sort_by?: string }) =>
      params.sort_by === "last_session" ? { data: { data: [], meta: { total: 0 } } } : params.deleted_from ? total(0) : total(5),
    );
    render(<PeopleIsland current="creators" />);
    const stat = screen.getByRole("status", { name: "Excluídas hoje: 0" });
    expect(stat).not.toHaveAttribute("data-tone");
  });

  it("trocar de aba não repete a entrada: a ilha nova (montada antes de a antiga sair) nasce parada", () => {
    const first = render(<PeopleIsland current="users" />);
    const second = render(<PeopleIsland current="creators" />);
    expect(within(second.container).getByRole("region", { name: "Pessoas" })).toHaveClass("isl-still");
    first.unmount();
    second.unmount();
  });
});
