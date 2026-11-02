/** Peças simples do estado do workspace: etiqueta, faixa de somente consulta, aviso de conta suspensa e impedimentos. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountSuspendedNotice } from "./account-suspended-notice";
import { DeleteBlockersPanel } from "./delete-blockers-panel";
import { WorkspaceArchivedBanner } from "./workspace-archived-banner";
import { WorkspaceStatusChip } from "./workspace-status-chip";

const NBSP = " ";

describe("WorkspaceStatusChip", () => {
  it("suspenso e arquivado levam a etiqueta, com o estado no atributo que o CSS usa", () => {
    const { rerender } = render(<WorkspaceStatusChip status="suspended" />);
    expect(screen.getByText("Suspenso")).toHaveAttribute("data-status", "suspended");
    rerender(<WorkspaceStatusChip status="archived" />);
    expect(screen.getByText("Arquivado")).toHaveAttribute("data-status", "archived");
    expect(screen.queryByText("Suspenso")).not.toBeInTheDocument();
  });

  it("ativo, ou sem estado (servidor antigo), não leva etiqueta", () => {
    const { container, rerender } = render(<WorkspaceStatusChip status="active" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<WorkspaceStatusChip />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WorkspaceArchivedBanner", () => {
  it("faixa fina e permanente com o texto pedido, anunciada com calma (status, não alerta)", () => {
    render(<WorkspaceArchivedBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Workspace arquivado — somente consulta");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não é um diálogo nem tem botão: só informa (a escrita é barrada pelo servidor)", () => {
    render(<WorkspaceArchivedBanner />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("não herda a altura de 100% do protótipo (ela é um item de coluna): classe própria que zera a altura", () => {
    const { container } = render(<WorkspaceArchivedBanner />);
    expect(container.firstElementChild).toHaveClass("pv", "wst-top");
  });
});

describe("AccountSuspendedNotice", () => {
  it("mostra o texto do servidor como alerta e leva ao suporte pelo e-mail que o produto já usa", () => {
    render(<AccountSuspendedNotice message="Conta suspensa. Entre em contato com o suporte." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Conta suspensa. Entre em contato com o suporte.");
    const link = within(alert).getByRole("link", { name: "Falar com o suporte" });
    expect(link).toHaveAttribute("href", "mailto:suporte@hypeapp.com.br?subject=Conta%20suspensa");
  });
});

describe("DeleteBlockersPanel", () => {
  const blockers = [
    { code: "HAS_CUSTODY_BALANCE", message: "Saldo em custódia", amount_cents: 125000 },
    { code: "HAS_PENDING_CHARGES", message: "Cobranças pendentes", count: 2 },
  ];

  it("lista uma frase por impedimento, com valor exato, e diz o que fazer", () => {
    render(<DeleteBlockersPanel blockers={blockers} workspaceName="Acme" />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Ainda não dá para excluir" })).toBeInTheDocument();
    const items = within(alert).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      `Há R$${NBSP}1.250,00 de saldo no workspace.`,
      "Há 2 cobranças PIX aguardando pagamento.",
    ]);
    expect(alert).toHaveTextContent("Resolva esses itens e tente de novo, ou fale com o suporte.");
  });

  it("o link do suporte leva o nome do workspace no assunto", () => {
    render(<DeleteBlockersPanel blockers={blockers} workspaceName="Acme & Filhos" />);
    const link = screen.getByRole("link", { name: "fale com o suporte" });
    expect(link.getAttribute("href")).toBe(
      "mailto:suporte@hypeapp.com.br?subject=Exclus%C3%A3o%20do%20workspace%20Acme%20%26%20Filhos&body=N%C3%A3o%20consegui%20excluir%20o%20workspace%20%22Acme%20%26%20Filhos%22.%20Pode%20me%20ajudar%3F",
    );
  });

  it("sem lista (o servidor não detalhou), ainda explica que há algo pendente e leva ao suporte", () => {
    render(<DeleteBlockersPanel blockers={[]} workspaceName="Acme" />);
    const alert = screen.getByRole("alert");
    expect(within(alert).queryByRole("list")).not.toBeInTheDocument();
    expect(alert).toHaveTextContent("Há algo pendente neste workspace. Resolva e tente de novo, ou fale com o suporte.");
    expect(within(alert).getByRole("link", { name: "fale com o suporte" })).toBeInTheDocument();
  });

  it("código novo do servidor aparece pelo texto dele", () => {
    render(<DeleteBlockersPanel blockers={[{ code: "HAS_NEW_THING", message: "Há uma pendência nova." }]} workspaceName="Acme" />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Há uma pendência nova.");
  });
});
