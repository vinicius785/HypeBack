import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock());

import { makeDetail, NOW_ISO } from "./test-support";
import { WorkspaceSummaryTab, workspaceMoneyFigures } from "./workspace-summary-tab";

function renderSummary(workspace = makeDetail(), onOpenTab = vi.fn()) {
  render(<WorkspaceSummaryTab workspace={workspace} onOpenTab={onOpenTab} />);
  return { onOpenTab };
}

/** O cartão da seção pelo título. */
const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;
const figureCard = (label: string) => screen.getByText(label, { selector: ".adm-fig-label" }).closest(".adm-fig") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
});
afterEach(() => vi.useRealTimers());

describe("workspaceMoneyFigures", () => {
  it("o dinheiro do detalhe ganha o tipo e a definição do contrato (aporte realizado, custódia posição, comprometido)", () => {
    const figures = workspaceMoneyFigures({ funded_cents: 100, custody_cents: 50, committed_cents: 20 });
    expect(figures.funded).toMatchObject({ value: 100, unit: "brl_cents", kind: "realized" });
    expect(figures.custody).toMatchObject({ value: 50, kind: "stock" });
    expect(figures.committed).toMatchObject({ value: 20, kind: "committed" });
    expect(figures.committed.definition).toMatch(/ainda não é pagamento/);
  });
});

describe("WorkspaceSummaryTab · números", () => {
  it("aportes, custódia e comprometido exatos, cada um com o tipo (realizado, posição atual, comprometido)", () => {
    renderSummary();

    const funded = figureCard("Aportes recebidos");
    expect(within(funded).getByText("R$ 1.234.567,89")).toBeInTheDocument();
    expect(within(funded).getByText("Realizado")).toBeInTheDocument();
    expect(within(funded).getByText("todo o histórico")).toBeInTheDocument();

    const custody = figureCard("Em custódia");
    expect(within(custody).getByText("R$ 45.000,50")).toBeInTheDocument();
    expect(within(custody).getByText("Posição atual")).toBeInTheDocument();

    const committed = figureCard("Comprometido");
    expect(within(committed).getByText("R$ 12.000,25")).toBeInTheDocument();
    expect(committed.querySelector(".adm-kind")).toHaveAttribute("data-kind", "committed");
  });

  it("o 'i' de cada número traz a definição", () => {
    renderSummary();
    expect(screen.getByRole("button", { name: "Como é calculado: Em custódia" })).toHaveAccessibleDescription(
      /Saldo em custódia agora\. O valor comprometido é parte dele/,
    );
  });

  it("contagens: membros, campanhas, campanhas publicadas e criadores", () => {
    renderSummary();
    const numbers = section("Números");
    const count = (label: string) => within(numbers).getByText(label).closest("div")?.querySelector("dd")?.textContent;
    expect(count("Membros")).toBe("6");
    expect(count("Campanhas")).toBe("8");
    expect(count("Campanhas publicadas")).toBe("2");
    expect(count("Criadores")).toBe("41");
  });

  it("última atividade e última sessão aproximada, com a definição de cada uma; sem sessão, '—'", () => {
    renderSummary(makeDetail("active", { last_session_at: null }));
    const numbers = section("Números");
    expect(within(numbers).getByText("há 3 dias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Como é calculado: Última atividade" })).toHaveAccessibleDescription(/updated_at do workspace não conta/);
    expect(screen.getByRole("button", { name: "Como é calculado: Última sessão (aprox.)" })).toHaveAccessibleDescription(/±5 min/);
    const session = within(numbers).getByText("Última sessão (aprox.)").closest("div") as HTMLElement;
    expect(within(session).getByText("—")).toBeInTheDocument();
  });

  it("nunca teve atividade: diz isso em vez de inventar uma data", () => {
    renderSummary(makeDetail("active", { activity: { state: "never", last_activity_at: null, window_days: 30 } }));
    expect(screen.getByText("Nenhuma atividade registrada")).toBeInTheDocument();
  });
});

describe("WorkspaceSummaryTab · dados cadastrais", () => {
  it("nome, razão social, CNPJ formatado, descrição, endereço completo, nicho e identificador público", () => {
    renderSummary();
    const data = section("Dados cadastrais");

    expect(within(data).getByText("Serra Verde Cafés Ltda")).toBeInTheDocument();
    expect(within(data).getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(within(data).getByText("Cafés especiais da Serra Verde.")).toBeInTheDocument();
    expect(within(data).getByText("Avenida Paulista, 1578 · Sala 4")).toBeInTheDocument();
    expect(within(data).getByText("Bela Vista")).toBeInTheDocument();
    expect(within(data).getByText("São Paulo/SP")).toBeInTheDocument();
    expect(within(data).getByText("CEP 01310-100")).toBeInTheDocument();
    expect(within(data).getByText("Alimentação")).toBeInTheDocument();
    expect(within(data).getByText("7a1e0000-0000-4000-8000-000000000002")).toBeInTheDocument();
    expect(within(data).getByText("12/03/2025 10:00")).toBeInTheDocument();
  });

  it("o que não foi cadastrado aparece como '—', nunca vazio nem inventado", () => {
    renderSummary(
      makeDetail("active", {
        legal_name: null,
        tax_id: null,
        description: null,
        niche: null,
        address: { postal_code: null, street: null, street_number: null, unit: null, neighborhood: null, city: null, state: null },
      }),
    );
    const data = section("Dados cadastrais");
    for (const label of ["Razão social", "CNPJ", "Descrição", "Endereço", "Nicho"]) {
      const row = within(data).getByText(label).closest(".adm-kv-row") as HTMLElement;
      expect(within(row).getByText("—")).toBeInTheDocument();
    }
  });
});

describe("WorkspaceSummaryTab · ciclo de vida", () => {
  it("ativo que nunca mudou de estado: status e '—' nas demais linhas", () => {
    renderSummary();
    const lifecycle = section("Ciclo de vida");
    expect(within(lifecycle).getByText("Ativo", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(lifecycle).getAllByText("—")).toHaveLength(3);
  });

  it("suspenso: desde quando, o motivo e quem fez (com link para a pessoa)", () => {
    renderSummary(makeDetail("suspended"));
    const lifecycle = section("Ciclo de vida");
    expect(within(lifecycle).getByText("Suspenso", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(lifecycle).getByText("20/10/2026 09:00")).toBeInTheDocument();
    expect(within(lifecycle).getByText("Cobrança em aberto")).toBeInTheDocument();
    expect(within(lifecycle).getByRole("link", { name: "Marina Albuquerque" })).toHaveAttribute("href", "/admin/users/1");
  });
});

describe("WorkspaceSummaryTab · responsáveis", () => {
  it("lista os proprietários com e-mail", () => {
    renderSummary(
      makeDetail("active", {
        owners: [
          { user_id: 11, name: "Helena Prado", email: "helena@serraverde.com.br" },
          { user_id: 12, name: "Caio Ramos", email: "caio@serraverde.com.br" },
        ],
      }),
    );
    const owners = section("Responsáveis");
    expect(within(owners).getByText("Helena Prado")).toBeInTheDocument();
    expect(within(owners).getByText("caio@serraverde.com.br")).toBeInTheDocument();
    expect(within(owners).queryByText("Sem responsável")).not.toBeInTheDocument();
  });

  it("sem proprietário: aviso claro e um atalho para a aba Usuários", async () => {
    const { onOpenTab } = renderSummary(makeDetail("active", { owners: [] }));
    const owners = section("Responsáveis");

    expect(within(owners).getByText("Sem responsável")).toBeInTheDocument();
    expect(within(owners).getByText(/inconsistência a investigar/)).toBeInTheDocument();
    await userEvent.click(within(owners).getByRole("button", { name: "Ir para Usuários" }));
    expect(onOpenTab).toHaveBeenCalledWith("usuarios");
  });

  it("sem proprietário e sem poder editar (excluído): o aviso fica, o atalho não", () => {
    renderSummary(makeDetail("deleted", { owners: [] }));
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir para Usuários" })).not.toBeInTheDocument();
  });
});
