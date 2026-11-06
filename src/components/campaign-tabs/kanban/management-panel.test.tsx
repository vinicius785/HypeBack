/**
 * Painel superior do Gerenciamento: identificação, navegação anterior/próximo, expandir/fechar e o conteúdo/ações
 * conforme a etapa (as ações de cada etapa são componentes existentes, aqui trocados por marcadores).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../shared/selection-panel-actions", () => ({
  SelectionPanelActions: ({ column }: { column: string }) => <div>ACOES-SELECAO {column}</div>,
  isSelectionColumn: (c: string) => ["applications", "pre_selection", "pre_selection_curation", "curation"].includes(c),
}));
vi.mock("../shared/script-panel-actions", () => ({
  ScriptPanelActions: () => <div>ACOES-ROTEIRO</div>,
  isScriptColumn: (c: string) => c === "script_pending",
}));
vi.mock("../shared/content-panel-actions", () => ({
  ContentPanelActions: () => <div>ACOES-CONTEUDO</div>,
  isContentColumn: (c: string) => c === "pending_approval",
}));
vi.mock("../shared/shipment-panel-actions", () => ({
  ShipmentPanelActions: () => <div>ACOES-ENVIO</div>,
  isShipmentColumn: (c: string) => c === "awaiting_shipment",
}));
vi.mock("../shared/price-negotiation-section", () => ({
  PriceNegotiationSection: () => <div>NEGOCIACAO</div>,
}));

import { ManagementPanel } from "./management-panel";
import type { ExtendedInfluencer } from "../management-kanban-config";

function inf(over: Partial<ExtendedInfluencer> = {}): ExtendedInfluencer {
  return {
    id: "5",
    user_id: "55",
    name: "Juliana Reis",
    username: "juliana.reis",
    avatar: "",
    followers: 67800,
    engagement: 2.9,
    status: "applications",
    social_networks: [{ id: 1, type: "instagram", name: "Instagram", username: "juliana", members: 67800 }],
    statusHistory: [{ id: "h1", status: "applications", timestamp: "2026-10-23T17:47:00Z" }],
    ...over,
  } as ExtendedInfluencer;
}

function setup(over: Partial<React.ComponentProps<typeof ManagementPanel>> = {}) {
  const props = {
    inf: inf(),
    column: "applications",
    late: false,
    orderedIds: ["4", "5", "6"],
    expanded: false,
    onToggleExpanded: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    campaignId: "c1",
    paymentType: "paid",
    phasesWithFormats: [],
    highlightContentId: null,
    onChat: vi.fn(),
    onProfile: vi.fn(),
    onStageAction: vi.fn(),
    onReject: vi.fn(),
    onReconsider: vi.fn(),
    ...over,
  };
  render(<ManagementPanel {...props} />);
  return props;
}

describe("ManagementPanel", () => {
  it("mostra quem é, a etapa, as redes com seguidores e a posição na ordem do quadro", () => {
    setup();
    const panel = screen.getByRole("region", { name: "Detalhes de Juliana Reis" });
    expect(within(panel).getByRole("heading", { name: "Juliana Reis" })).toBeInTheDocument();
    expect(within(panel).getByText(/@juliana\.reis/)).toBeInTheDocument();
    expect(within(panel).getAllByText("Inscrições").length).toBeGreaterThan(0); // etapa no selo (e no histórico)
    expect(within(panel).getByText("Instagram")).toBeInTheDocument();
    expect(within(panel).getByText("2 de 3")).toBeInTheDocument();
  });

  it("anterior e próximo trocam o criador sem fechar; nas pontas o botão fica desabilitado", async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole("button", { name: "Próximo criador" }));
    expect(p.onSelect).toHaveBeenLastCalledWith("6");
    await user.click(screen.getByRole("button", { name: "Criador anterior" }));
    expect(p.onSelect).toHaveBeenLastCalledWith("4");
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it("no primeiro criador não há anterior; no último não há próximo", () => {
    setup({ inf: inf({ id: "4" }) });
    expect(screen.getByRole("button", { name: "Criador anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próximo criador" })).toBeEnabled();
  });

  it("expandir, fechar, chat e perfil chamam os callbacks", async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole("button", { name: "Expandir detalhes" }));
    await user.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    await user.click(screen.getByRole("button", { name: /Abrir chat/ }));
    await user.click(screen.getByRole("button", { name: /Perfil completo/ }));
    expect(p.onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(p.onClose).toHaveBeenCalledTimes(1);
    expect(p.onChat).toHaveBeenCalledTimes(1);
    expect(p.onProfile).toHaveBeenCalledTimes(1);
  });

  it("o botão expandir informa o estado (aria-expanded) e vira 'Recolher'", () => {
    setup({ expanded: true });
    expect(screen.getByRole("button", { name: "Recolher detalhes" })).toHaveAttribute("aria-expanded", "true");
  });

  describe("conteúdo por etapa", () => {
    it("Seleção: ações da seleção, e o 'Recusar' fica dentro delas (não há botão geral)", () => {
      setup({ column: "curation" });
      expect(screen.getByText("ACOES-SELECAO curation")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
    });

    it("Roteiros, Conteúdo e Envio usam as ações de cada etapa e oferecem Recusar", async () => {
      const user = userEvent.setup();
      const p = setup({ column: "script_pending" });
      expect(screen.getByText("ACOES-ROTEIRO")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Recusar" }));
      expect(p.onReject).toHaveBeenCalledTimes(1);
    });

    it("Conteúdo: ações do conteúdo", () => {
      setup({ column: "pending_approval" });
      expect(screen.getByText("ACOES-CONTEUDO")).toBeInTheDocument();
    });

    it("Envio: ações do envio", () => {
      setup({ column: "awaiting_shipment" });
      expect(screen.getByText("ACOES-ENVIO")).toBeInTheDocument();
    });

    it("Proposta e contrato: valores da negociação aparecem só quando há negociação", () => {
      setup({
        column: "price_countered",
        inf: inf({ price_negotiation: { proposed_price_cents: 1, counter_price_cents: 2, agreed_price_cents: null, price_status: "countered", origin: null } as never }),
      });
      expect(screen.getByText("NEGOCIACAO")).toBeInTheDocument();
    });

    it("sem negociação não há bloco financeiro vazio", () => {
      setup({ column: "applications" });
      expect(screen.queryByText("NEGOCIACAO")).not.toBeInTheDocument();
      expect(screen.queryByText("Proposta e financeiro")).not.toBeInTheDocument();
    });

    it("etapa com ação própria (ex.: contrato) mostra o botão da etapa e chama onStageAction", async () => {
      const user = userEvent.setup();
      const p = setup({ column: "contract_pending" });
      await user.click(screen.getByRole("button", { name: "Ver contrato" }));
      expect(p.onStageAction).toHaveBeenCalledTimes(1);
    });

    it("Recusados: mostra o motivo registrado e oferece Reconsiderar (sem Recusar)", async () => {
      const user = userEvent.setup();
      const p = setup({
        column: "rejected",
        inf: inf({
          status: "rejected",
          statusHistory: [
            { id: "h1", status: "applications", timestamp: "2026-10-23T17:47:00Z" },
            { id: "h2", status: "rejected", timestamp: "2026-11-03T17:48:00Z", notes: "Perfil fora do nicho" },
          ],
        }),
      });
      expect(screen.getByText("Motivo da recusa").parentElement).toHaveTextContent("Perfil fora do nicho");
      expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Reconsiderar/ }));
      expect(p.onReconsider).toHaveBeenCalledTimes(1);
    });

    it("Recusados sem motivo: avisa que nenhum foi registrado (não inventa)", () => {
      setup({ column: "rejected", inf: inf({ status: "rejected" }) });
      expect(screen.getByText("Nenhum motivo foi registrado.")).toBeInTheDocument();
    });
  });

  it("o histórico compacto mostra só as últimas movimentações, com data, hora e origem", () => {
    setup({
      inf: inf({
        statusHistory: [
          { id: "h1", status: "applications", timestamp: "2026-10-23T17:47:00Z", source: "app" },
          { id: "h2", status: "curation", timestamp: "2026-10-25T10:00:00Z", source: "backoffice" },
          { id: "h3", status: "invited", timestamp: "2026-10-26T10:00:00Z", source: "backoffice" },
          { id: "h4", status: "price_proposed", timestamp: "2026-10-27T10:00:00Z", source: "system" },
        ],
      }),
    });
    const log = screen.getByRole("complementary", { name: "Últimas movimentações" });
    expect(within(log).getAllByRole("listitem")).toHaveLength(3);
    expect(within(log).getByText("Proposta enviada")).toBeInTheDocument();
    expect(within(log).queryByText("Inscrições")).not.toBeInTheDocument(); // a mais antiga fica só no histórico completo
    expect(within(log).getByText(/Automático/)).toBeInTheDocument();
    expect(within(log).getAllByText(/Equipe/)).toHaveLength(2);
    expect(within(log).getByRole("button", { name: /Ver histórico completo \(4\)/ })).toBeInTheDocument();
  });

  it("'Ver histórico completo' expande o painel; expandido mostra tudo e esconde o link", async () => {
    const user = userEvent.setup();
    const history = [1, 2, 3, 4].map((n) => ({ id: `h${n}`, status: "applications", timestamp: `2026-10-2${n}T10:00:00Z` }));
    const p = setup({ inf: inf({ statusHistory: history }) });
    await user.click(screen.getByRole("button", { name: /Ver histórico completo/ }));
    expect(p.onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("expandido: aparece o histórico anterior (sem repetir as últimas) e some o link", () => {
    const history = [1, 2, 3, 4].map((n) => ({ id: `h${n}`, status: "applications", timestamp: `2026-10-2${n}T10:00:00Z` }));
    setup({ expanded: true, inf: inf({ statusHistory: history }) });
    expect(screen.getByRole("region", { name: "Histórico anterior" })).toBeInTheDocument(); // só as mais antigas (as 3 últimas já estão ao lado)
    expect(screen.queryByRole("button", { name: /Ver histórico completo/ })).not.toBeInTheDocument();
  });

  it("fora das etapas de proposta a negociação não aparece no compacto", () => {
    const neg = { proposed_price_cents: 1, counter_price_cents: null, agreed_price_cents: null, price_status: null, origin: null } as never;
    setup({ column: "script_pending", inf: inf({ price_negotiation: neg }) });
    expect(screen.queryByText("NEGOCIACAO")).not.toBeInTheDocument();
  });

  it("expandido mostra a negociação mesmo fora das etapas de proposta", () => {
    const neg = { proposed_price_cents: 1, counter_price_cents: null, agreed_price_cents: null, price_status: null, origin: null } as never;
    setup({ column: "script_pending", expanded: true, inf: inf({ price_negotiation: neg }) });
    expect(screen.getByText("NEGOCIACAO")).toBeInTheDocument();
  });
});
