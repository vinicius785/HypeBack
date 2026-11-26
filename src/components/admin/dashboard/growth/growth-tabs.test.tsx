import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ adminGetStamped: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGetStamped: api.adminGetStamped };
});

import { toAdminApiError } from "@/lib/admin/admin-client";

import { CreatorsTab } from "./creators-tab";
import {
  ACTIVE,
  ACTIVE_WITH_HISTORY,
  APPLICATIONS,
  BASE,
  ENGAGEMENT,
  FUNNEL,
  NEVER_APPLIED,
  PROFILE,
  TIMELINE_MONTH,
  TIMELINE_WEEK,
  TREND,
} from "./growth-fixtures";
import { GrowthTab } from "./growth-tab";

const GENERATED = "2026-11-25T17:20:00.000Z";
type Source = Record<string, unknown | (() => unknown)>;

/** Responde por endpoint (`base`, `trend`…); um valor que é função é chamado a cada consulta e pode rejeitar. */
function serve(overrides: Source = {}) {
  const table: Source = {
    base: BASE,
    active: ACTIVE,
    trend: TREND,
    timeline: (params: { granularity: string }) => (params.granularity === "week" ? TIMELINE_WEEK : TIMELINE_MONTH),
    funnel: FUNNEL,
    applications: APPLICATIONS,
    engagement: (params: { days: number }) => ({ ...ENGAGEMENT, days: params.days }),
    "never-applied": NEVER_APPLIED,
    profile: PROFILE,
    ...overrides,
  };
  api.adminGetStamped.mockImplementation(async (path: string, params?: unknown) => {
    const name = path.split("/").pop() as string;
    const entry = table[name];
    const data = typeof entry === "function" ? (entry as (p?: unknown) => unknown)(params) : entry;
    return { data, generated_at: GENERATED, cached: false };
  });
}

function renderTab(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const calls = (name: string) => api.adminGetStamped.mock.calls.filter(([path]) => String(path).endsWith(`/${name}`));

beforeEach(() => {
  api.adminGetStamped.mockReset();
  serve();
});

describe("aba Crescimento", () => {
  it("base: contas criadas, concluídas e ativas, com os percentuais da API", async () => {
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Base de criadores" })).closest("section")!;
    await waitFor(() => expect(within(section).getByText("12.345")).toBeInTheDocument());
    expect(within(section).getByText("9.800")).toBeInTheDocument();
    expect(within(section).getByText("8.000")).toBeInTheDocument();
    expect(within(section).getByText("64,8% das criadas")).toBeInTheDocument();
    expect(within(section).getByText("25,1% das contas")).toBeInTheDocument();
    expect(calls("base")[0][0]).toBe("/admin/dashboard/growth/base");
  });

  it("ativos: as 5 janelas (24 horas, não 1 dia) e quem esfriou; sem histórico diz que ele começa hoje", async () => {
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Quem usa o app" })).closest("section")!;
    await within(section).findByText("Ativos em 24 horas");
    for (const label of ["Ativos em 7 dias", "Ativos em 15 dias", "Ativos em 30 dias", "Ativos em 90 dias", "Esfriaram"]) {
      expect(within(section).getByText(label)).toBeInTheDocument();
    }
    expect(within(section).getByText("O histórico começa hoje")).toBeInTheDocument();
    expect(within(section).queryByRole("table")).toBeNull();
  });

  it("ativos com histórico: a linha ganha uma tabela para leitor de tela e some o aviso", async () => {
    serve({ active: ACTIVE_WITH_HISTORY });
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Quem usa o app" })).closest("section")!;
    const table = await within(section).findByRole("table", { name: /ativos por dia/i });
    expect(within(table).getByText("24/11/2026")).toBeInTheDocument();
    expect(within(section).queryByText("O histórico começa hoje")).toBeNull();
  });

  it("tendência: o veredito da API, a regra no popover e variação nula vira traço (não 0%)", async () => {
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Melhorando ou piorando?" })).closest("section")!;
    expect(await within(section).findByText("Piorando")).toBeInTheDocument();
    expect(within(section).getByText("-23,8%")).toBeInTheDocument();
    expect(within(section).getByText("-4 p.p.")).toBeInTheDocument();
    const deltas = within(section).getByRole("list", { name: /contra a anterior/i });
    expect(within(deltas).getByText("Campanhas novas").parentElement).toHaveTextContent("—");
    await userEvent.click(within(section).getByRole("button", { name: /como o veredito é calculado/i }));
    expect((await screen.findAllByText(/2 de 3 na mesma direção/)).length).toBeGreaterThan(0);
    expect(within(section).getAllByRole("row")).toHaveLength(5);
  });

  it("ao longo do tempo: o último período aparece como em andamento e trocar para semana refaz a consulta", async () => {
    const user = userEvent.setup();
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Ao longo do tempo" })).closest("section")!;
    const table = await within(section).findByRole("table", { name: "Contas novas por período" });
    expect(within(table).getByText("nov/2026 (em andamento)")).toBeInTheDocument();
    expect(within(table).getByText("out/2026")).toBeInTheDocument();
    expect(within(section).getAllByText(/Tracejado: período em andamento/).length).toBeGreaterThan(0);
    expect(calls("timeline")[0][1]).toEqual({ granularity: "month", periods: 12 });

    await user.selectOptions(within(section).getByLabelText("Agrupar por"), "week");
    const weekTable = await within(section).findByRole("table", { name: "Contas novas por período" });
    await within(weekTable).findByText("Semana de 23/11/2026 (em andamento)");
    expect(calls("timeline").at(-1)![1]).toEqual({ granularity: "week", periods: 12 });
  });

  it("confirmação de e-mail por coorte vem com a nota de leitura", async () => {
    renderTab(<GrowthTab />);
    expect(await screen.findByText(/Por coorte: das contas criadas em cada período/)).toBeInTheDocument();
  });

  it("funil: rótulos em português, % sobre a etapa anterior e as 3 saídas fora do funil", async () => {
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Funil de cadastro" })).closest("section")!;
    const funnel = await within(section).findByRole("list", { name: /funil de cadastro de criadores/i });
    expect(within(funnel).getByText("Cadastros")).toBeInTheDocument();
    expect(within(funnel).getByText("Usaram o app em 30 dias")).toBeInTheDocument();
    expect(within(funnel).getByText("79,4% da etapa anterior")).toBeInTheDocument();
    for (const label of ["Não concluíram", "Excluíram a conta", "Sem e-mail confirmado"]) {
      expect(within(section).getByText(label)).toBeInTheDocument();
    }
    expect(within(section).getByText("2.100")).toBeInTheDocument();
  });

  it("candidaturas: média com 1 casa e % dos concluídos", async () => {
    renderTab(<GrowthTab />);
    const section = (await screen.findByRole("heading", { name: "Candidaturas" })).closest("section")!;
    await within(section).findByText("6.400");
    expect(within(section).getByText("2,6")).toBeInTheDocument();
    expect(within(section).getByText("31,3%")).toBeInTheDocument();
  });

  it("uma consulta que falha mostra o próprio erro e não derruba as outras", async () => {
    serve({
      trend: () => {
        throw toAdminApiError(403, { error: "FORBIDDEN" });
      },
    });
    renderTab(<GrowthTab />);
    const trend = (await screen.findByRole("heading", { name: "Melhorando ou piorando?" })).closest("section")!;
    expect(await within(trend).findByText("Sem permissão")).toBeInTheDocument();
    const base = screen.getByRole("heading", { name: "Base de criadores" }).closest("section")!;
    expect(await within(base).findByText("12.345")).toBeInTheDocument();
  });
});

describe("aba Criadores", () => {
  it("engajamento: barras ordenadas da maior para a menor, com os rótulos do produto e a base de contas", async () => {
    renderTab(<CreatorsTab />);
    const section = (await screen.findByRole("heading", { name: "Engajamento" })).closest("section")!;
    const list = await within(section).findByRole("list", { name: /criadores por tipo de ação/i });
    const labels = within(list).getAllByRole("listitem").map((li) => li.querySelector("span")!.textContent);
    expect(labels).toHaveLength(14);
    expect(labels.slice(0, 3)).toEqual(["Abriu o app", "Candidatura", "Curtida"]);
    expect(labels.at(-1)).toBe("Saque");
    expect(within(section).getByText("Live (ver, comentar ou curtir)")).toBeInTheDocument();
    expect(within(section).getByText("31,6% das contas")).toBeInTheDocument();
    expect(calls("engagement")[0][1]).toEqual({ days: 30 });
  });

  it("engajamento: histórico vazio avisa que começa hoje; em outro período a linha nem é oferecida", async () => {
    const user = userEvent.setup();
    renderTab(<CreatorsTab />);
    const section = (await screen.findByRole("heading", { name: "Engajamento" })).closest("section")!;
    expect(await within(section).findByText("O histórico começa hoje")).toBeInTheDocument();

    await user.selectOptions(within(section).getByLabelText("Período do engajamento"), "7");
    await waitFor(() => expect(calls("engagement").at(-1)![1]).toEqual({ days: 7 }));
    await waitFor(() => expect(within(section).queryByText("O histórico começa hoje")).toBeNull());
  });

  it("quem nunca se candidatou: só contagens, perfil empilhado, subnicho marcado e cidade com UF", async () => {
    renderTab(<CreatorsTab />);
    const section = (await screen.findByRole("heading", { name: "Quem nunca se candidatou" })).closest("section")!;
    await within(section).findByText("6.000");
    expect(within(section).getByText("Completo:")).toBeInTheDocument();
    expect(within(section).getByText("Subnicho · Maquiagem")).toBeInTheDocument();
    expect(within(section).getByText("São Paulo/SP")).toBeInTheDocument();
    expect(within(section).getByText("Instagram")).toBeInTheDocument();
    expect(within(section).queryByRole("link")).toBeNull();
  });

  it("perfil: gênero traduzido (chave nova como veio), sem nicho/endereço, e as 8 faixas de seguidores por rede", async () => {
    renderTab(<CreatorsTab />);
    const section = (await screen.findByRole("heading", { name: "Perfil dos criadores" })).closest("section")!;
    await within(section).findByText("Feminino");
    expect(within(section).getByText("Não informado")).toBeInTheDocument();
    expect(within(section).getByText("nao-binario")).toBeInTheDocument();
    expect(within(section).getByText("Sem nicho informado")).toBeInTheDocument();
    expect(within(section).getByText("Sem endereço")).toBeInTheDocument();
    expect(within(section).getByText("66,3% das contas")).toBeInTheDocument();
    const insta = within(section).getByRole("list", { name: /faixa de seguidores no instagram/i });
    expect(within(insta).getAllByRole("listitem").map((li) => li.querySelector("span")!.textContent)).toEqual([
      "0–1 mil",
      "1–5 mil",
      "5–10 mil",
      "10–50 mil",
      "50–100 mil",
      "100–500 mil",
      "500 mil–1 mi",
      "1 mi+",
    ]);
  });
});
